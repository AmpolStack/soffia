using System.Text.Json;
using Soffia.Core;

namespace Soffia.Api.Storage;

public sealed class DeckStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
    };

    private readonly IObjectStorage _storage;
    private readonly SemaphoreSlim _indexLock = new(1, 1);

    public DeckStore(IObjectStorage storage)
    {
        _storage = storage;
    }

    private static string MetaKey(string id) => $"decks/{id}/meta.json";
    private const string IndexKey = "index.json";

    public async Task<IReadOnlyList<DeckMeta>> ListAsync(CancellationToken cancellationToken = default)
    {
        var index = await ReadIndexAsync(cancellationToken);
        return index.OrderByDescending(deck => deck.LastOpenedAt ?? deck.UpdatedAt).ToArray();
    }

    public async Task<(DeckMeta Meta, string Markdown)?> GetAsync(string id, CancellationToken cancellationToken = default)
    {
        if (!DeckValidator.IsValidId(id)) return null;
        var meta = await ReadJsonAsync<DeckMeta>(MetaKey(id), cancellationToken);
        if (meta is null) return null;
        var markdownObject = await _storage.GetAsync($"decks/{id}/{meta.FileName}", cancellationToken);
        if (markdownObject is null) return null;
        using var reader = new StreamReader(markdownObject.Content);
        return (meta, await reader.ReadToEndAsync(cancellationToken));
    }

    public async Task<DeckMeta> SaveAsync(
        DeckUpload upload,
        DeckValidationResult validation,
        CancellationToken cancellationToken = default)
    {
        var id = validation.Id!;
        if (!DeckValidator.IsValidId(id))
            throw new ArgumentException("El id del deck no es válido.", nameof(validation));
        await _indexLock.WaitAsync(cancellationToken);
        try
        {
            var index = await ReadIndexAsync(cancellationToken);
            var existing = index.FirstOrDefault(deck => deck.Id == id);
            var shortId = existing?.ShortId ?? UniqueShortId(index);
            var fileName = existing?.FileName ?? FileNaming.Create(upload.SourceName, shortId);

            if (existing is not null && existing.FileName != fileName)
                await _storage.DeleteAsync($"decks/{id}/{existing.FileName}", cancellationToken);

            await using (var markdown = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(upload.Markdown)))
                await _storage.PutAsync($"decks/{id}/{fileName}", markdown, "text/markdown; charset=utf-8", cancellationToken);

            var assetKeys = new List<string>(existing?.AssetKeys ?? []);
            foreach (var asset in upload.Assets)
            {
                if (string.IsNullOrWhiteSpace(asset.Key)) continue;
                var key = NormalizeAssetKey(asset.Key);
                if (key is null) continue;
                var bytes = Convert.FromBase64String(asset.Base64);
                await using var stream = new MemoryStream(bytes);
                await _storage.PutAsync($"decks/{id}/assets/{key}", stream, asset.ContentType, cancellationToken);
                if (!assetKeys.Contains(key, StringComparer.OrdinalIgnoreCase)) assetKeys.Add(key);
            }

            var now = DateTimeOffset.UtcNow;
            var meta = new DeckMeta
            {
                Id = id,
                Title = validation.Title ?? id,
                Subtitle = validation.Subtitle,
                Description = validation.Description,
                Tags = validation.Tags.ToList(),
                Language = validation.Language,
                Author = validation.Author,
                SourceName = upload.SourceName,
                FileName = fileName,
                ShortId = shortId,
                AssetKeys = assetKeys,
                CreatedAt = existing?.CreatedAt ?? now,
                UpdatedAt = now,
                LastOpenedAt = existing?.LastOpenedAt,
                Summary = validation.Summary,
            };

            await WriteJsonAsync(MetaKey(id), meta, cancellationToken);
            index.RemoveAll(deck => deck.Id == id);
            index.Add(meta);
            await WriteJsonAsync(IndexKey, index, cancellationToken);
            return meta;
        }
        finally
        {
            _indexLock.Release();
        }
    }

    public async Task<DeckMeta?> TouchAsync(string id, CancellationToken cancellationToken = default)
    {
        if (!DeckValidator.IsValidId(id)) return null;
        await _indexLock.WaitAsync(cancellationToken);
        try
        {
            var index = await ReadIndexAsync(cancellationToken);
            var meta = index.FirstOrDefault(deck => deck.Id == id);
            if (meta is null) return null;
            meta.LastOpenedAt = DateTimeOffset.UtcNow;
            await WriteJsonAsync(MetaKey(id), meta, cancellationToken);
            await WriteJsonAsync(IndexKey, index, cancellationToken);
            return meta;
        }
        finally
        {
            _indexLock.Release();
        }
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        if (!DeckValidator.IsValidId(id)) return false;
        await _indexLock.WaitAsync(cancellationToken);
        try
        {
            var index = await ReadIndexAsync(cancellationToken);
            var meta = index.FirstOrDefault(deck => deck.Id == id);
            if (meta is null) return false;

            await _storage.DeleteAsync($"decks/{id}/{meta.FileName}", cancellationToken);
            foreach (var key in meta.AssetKeys)
                await _storage.DeleteAsync($"decks/{id}/assets/{key}", cancellationToken);
            await _storage.DeleteAsync(MetaKey(id), cancellationToken);
            index.RemoveAll(deck => deck.Id == id);
            await WriteJsonAsync(IndexKey, index, cancellationToken);
            return true;
        }
        finally
        {
            _indexLock.Release();
        }
    }

    public async Task<StoredObject?> GetAssetAsync(string id, string key, CancellationToken cancellationToken = default)
    {
        if (!DeckValidator.IsValidId(id)) return null;
        var normalized = NormalizeAssetKey(key);
        return normalized is null
            ? null
            : await _storage.GetAsync($"decks/{id}/assets/{normalized}", cancellationToken);
    }

    public async Task<bool> DeleteAssetAsync(string id, string key, CancellationToken cancellationToken = default)
    {
        if (!DeckValidator.IsValidId(id)) return false;
        var normalized = NormalizeAssetKey(key);
        if (normalized is null) return false;

        await _indexLock.WaitAsync(cancellationToken);
        try
        {
            var index = await ReadIndexAsync(cancellationToken);
            var meta = index.FirstOrDefault(deck => deck.Id == id);
            if (meta is null) return false;

            var storedKey = meta.AssetKeys.FirstOrDefault(
                asset => string.Equals(asset, normalized, StringComparison.OrdinalIgnoreCase));
            if (storedKey is null) return false;

            meta.AssetKeys.Remove(storedKey);
            await WriteJsonAsync(MetaKey(id), meta, cancellationToken);
            await WriteJsonAsync(IndexKey, index, cancellationToken);
            await _storage.DeleteAsync($"decks/{id}/assets/{storedKey}", cancellationToken);
            return true;
        }
        finally
        {
            _indexLock.Release();
        }
    }

    public async Task<StoredObject?> GetMarkdownAsync(string id, CancellationToken cancellationToken = default)
    {
        if (!DeckValidator.IsValidId(id)) return null;
        var meta = await ReadJsonAsync<DeckMeta>(MetaKey(id), cancellationToken);
        return meta is null ? null : await _storage.GetAsync($"decks/{id}/{meta.FileName}", cancellationToken);
    }

    public async Task<StoredObject?> GetProgressAsync(string id, CancellationToken cancellationToken = default)
    {
        if (!DeckValidator.IsValidId(id)) return null;
        return await _storage.GetAsync($"progress/{id}.json", cancellationToken);
    }

    public async Task PutProgressAsync(string id, string json, CancellationToken cancellationToken = default)
    {
        if (!DeckValidator.IsValidId(id))
            throw new ArgumentException("El id del deck no es válido.", nameof(id));
        await using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json));
        await _storage.PutAsync($"progress/{id}.json", stream, "application/json", cancellationToken);
    }

    private static string UniqueShortId(List<DeckMeta> index)
    {
        var used = index.Select(deck => deck.ShortId).ToHashSet(StringComparer.OrdinalIgnoreCase);
        for (var attempt = 0; attempt < 64; attempt++)
        {
            var id = FileNaming.ShortId();
            if (used.Add(id)) return id;
        }
        throw new InvalidOperationException("No se pudo generar un short ID único.");
    }

    private static string? NormalizeAssetKey(string key)
    {
        var clean = key.Replace('\\', '/').TrimStart('/');
        if (clean.Split('/').Any(part => part is ".." or "" or ".")) return null;
        if (clean.IndexOfAny(['<', '>', ':', '"', '|', '?', '*']) >= 0) return null;
        if (clean.Any(char.IsControl)) return null;
        var safe = string.Join('/', clean.Split('/'));
        return string.IsNullOrWhiteSpace(safe) ? null : safe;
    }

    private async Task<List<DeckMeta>> ReadIndexAsync(CancellationToken cancellationToken)
    {
        var data = await ReadJsonAsync<List<DeckMeta>>(IndexKey, cancellationToken);
        return data ?? [];
    }

    private async Task<T?> ReadJsonAsync<T>(string key, CancellationToken cancellationToken)
    {
        var stored = await _storage.GetAsync(key, cancellationToken);
        if (stored is null) return default;
        using var reader = new StreamReader(stored.Content);
        return JsonSerializer.Deserialize<T>(await reader.ReadToEndAsync(cancellationToken), JsonOptions);
    }

    private async Task WriteJsonAsync<T>(string key, T value, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(value, JsonOptions);
        await using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json));
        await _storage.PutAsync(key, stream, "application/json; charset=utf-8", cancellationToken);
    }
}
