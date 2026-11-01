namespace Soffia.Core;

public static class UploadValidation
{
    public const int MaxMarkdownBytes = 2 * 1024 * 1024;
    public const int MaxAssets = 20;
    public const int MaxAssetBytes = 10 * 1024 * 1024;
    public const long MaxTotalAssetBytes = 20L * 1024 * 1024;
    public const int MaxSourceNameLength = 200;

    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".webp"] = "image/webp",
        [".gif"] = "image/gif",
        [".avif"] = "image/avif",
        [".svg"] = "image/svg+xml",
    };

    public static List<ValidationMessage> Validate(DeckUpload upload)
    {
        upload.Markdown = upload.Markdown ?? "";
        upload.SourceName = string.IsNullOrWhiteSpace(upload.SourceName)
            ? "documento.md"
            : upload.SourceName.Trim();
        upload.Assets = upload.Assets ?? [];

        var errors = new List<ValidationMessage>();
        if (string.IsNullOrWhiteSpace(upload.Markdown))
            errors.Add(new(null, "El archivo Markdown está vacío.", "error"));
        else if (System.Text.Encoding.UTF8.GetByteCount(upload.Markdown) > MaxMarkdownBytes)
            errors.Add(new(null, "El Markdown supera el límite de 2 MB.", "error"));

        if (upload.SourceName.Length > MaxSourceNameLength)
            errors.Add(new(null, "El nombre del archivo supera los 200 caracteres.", "error"));

        if (upload.Assets.Count > MaxAssets)
        {
            errors.Add(new(null, $"El deck no puede tener más de {MaxAssets} imágenes.", "error"));
            return errors;
        }

        var totalBytes = 0L;
        foreach (var asset in upload.Assets)
        {
            if (string.IsNullOrWhiteSpace(asset.Key) || asset.Key.Length > 200)
            {
                errors.Add(new(null, "Una imagen tiene un nombre vacío o demasiado largo.", "error"));
                continue;
            }

            if (!IsSafeAssetKey(asset.Key))
            {
                errors.Add(new(null, $"La imagen {asset.Key} tiene un nombre de archivo no permitido.", "error"));
                continue;
            }

            var extension = Path.GetExtension(asset.Key);
            if (!AllowedTypes.TryGetValue(extension, out var inferred))
            {
                errors.Add(new(null, $"Formato de imagen no permitido: {asset.Key}.", "error"));
                continue;
            }

            asset.ContentType = inferred;

            if (string.IsNullOrWhiteSpace(asset.Base64))
            {
                errors.Add(new(null, $"La imagen {asset.Key} está vacía.", "error"));
                continue;
            }

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(asset.Base64);
            }
            catch (FormatException)
            {
                errors.Add(new(null, $"La imagen {asset.Key} no contiene base64 válido.", "error"));
                continue;
            }

            if (bytes.Length > MaxAssetBytes)
                errors.Add(new(null, $"La imagen {asset.Key} supera el límite de 10 MB.", "error"));

            totalBytes += bytes.Length;
            if (totalBytes > MaxTotalAssetBytes)
            {
                errors.Add(new(null, "Las imágenes del deck superan el límite total de 20 MB.", "error"));
                break;
            }
        }

        return errors;
    }

    private static bool IsSafeAssetKey(string key)
    {
        var clean = key.Replace('\\', '/').Trim();
        if (clean.Length == 0 || clean.Length > 200 || clean.StartsWith('/')) return false;
        if (clean.IndexOfAny(['<', '>', ':', '"', '|', '?', '*']) >= 0) return false;
        if (clean.Any(char.IsControl)) return false;
        return clean.Split('/').All(part => part is not ("" or "." or ".."));
    }
}
