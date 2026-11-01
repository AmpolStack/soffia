using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;

namespace Soffia.Api.Storage;

public sealed record StoredObject(Stream Content, string ContentType, long Length);

public interface IObjectStorage
{
    Task<StoredObject?> GetAsync(string key, CancellationToken cancellationToken = default);
    Task PutAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default);
    Task DeleteAsync(string key, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<string>> ListAsync(string prefix, CancellationToken cancellationToken = default);
}

public sealed class StorageOptions
{
    public string? AccountId { get; set; } = Environment.GetEnvironmentVariable("R2_ACCOUNT_ID");
    public string? AccessKeyId { get; set; } = Environment.GetEnvironmentVariable("R2_ACCESS_KEY_ID");
    public string? SecretAccessKey { get; set; } = Environment.GetEnvironmentVariable("R2_SECRET_ACCESS_KEY");
    public string? Bucket { get; set; } = Environment.GetEnvironmentVariable("R2_BUCKET");
    public string? DataDirectory { get; set; } = Environment.GetEnvironmentVariable("DATA_DIR");

    public bool HasR2 =>
        !string.IsNullOrWhiteSpace(AccountId) &&
        !string.IsNullOrWhiteSpace(AccessKeyId) &&
        !string.IsNullOrWhiteSpace(SecretAccessKey) &&
        !string.IsNullOrWhiteSpace(Bucket);
}

public sealed class LocalObjectStorage : IObjectStorage
{
    private readonly string _root;

    public LocalObjectStorage(IOptions<StorageOptions> options)
    {
        _root = Path.GetFullPath(options.Value.DataDirectory
            ?? Path.Combine(Directory.GetCurrentDirectory(), "data"));
        Directory.CreateDirectory(_root);
    }

    private string PathFor(string key)
    {
        var clean = key.Replace('\\', '/').TrimStart('/');
        var full = Path.GetFullPath(Path.Combine(_root, clean));
        var root = _root.EndsWith(Path.DirectorySeparatorChar)
            ? _root
            : _root + Path.DirectorySeparatorChar;
        if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(full, _root, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Ruta de almacenamiento no permitida.");
        return full;
    }

    public Task<StoredObject?> GetAsync(string key, CancellationToken cancellationToken = default)
    {
        var path = PathFor(key);
        if (!File.Exists(path)) return Task.FromResult<StoredObject?>(null);
        var content = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<StoredObject?>(new StoredObject(content, ContentTypeFor(path), content.Length));
    }

    public async Task PutAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        var path = PathFor(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var output = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(output, cancellationToken);
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        var path = PathFor(key);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<string>> ListAsync(string prefix, CancellationToken cancellationToken = default)
    {
        var root = PathFor(prefix);
        if (!Directory.Exists(root)) return Task.FromResult<IReadOnlyList<string>>([]);
        var keys = Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories)
            .Select(path => Path.GetRelativePath(_root, path).Replace('\\', '/'))
            .OrderBy(key => key)
            .ToArray();
        return Task.FromResult<IReadOnlyList<string>>(keys);
    }

    private static string ContentTypeFor(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".json" => "application/json",
        ".svg" => "image/svg+xml",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".webp" => "image/webp",
        ".gif" => "image/gif",
        ".avif" => "image/avif",
        _ => "text/markdown; charset=utf-8",
    };
}

public sealed class R2ObjectStorage : IObjectStorage
{
    private readonly IAmazonS3 _client;
    private readonly string _bucket;

    public R2ObjectStorage(IOptions<StorageOptions> options)
    {
        var value = options.Value;
        _bucket = value.Bucket!;
        var config = new AmazonS3Config
        {
            ServiceURL = $"https://{value.AccountId}.r2.cloudflarestorage.com",
            ForcePathStyle = true,
            AuthenticationRegion = "auto",
            // R2 no acepta el trailer aws-chunked que el SDK v4 añade por
            // defecto. Con WhenRequired se mantiene la compatibilidad S3.
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
            Timeout = TimeSpan.FromSeconds(60),
            MaxErrorRetry = 3,
        };
        _client = new AmazonS3Client(
            new BasicAWSCredentials(value.AccessKeyId, value.SecretAccessKey),
            config);
    }

    public async Task<StoredObject?> GetAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _client.GetObjectAsync(_bucket, key, cancellationToken);
            return new StoredObject(response.ResponseStream, response.Headers.ContentType ?? "application/octet-stream", response.ContentLength);
        }
        catch (AmazonS3Exception error) when (error.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task PutAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        await _client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            ContentType = contentType,
            AutoCloseStream = false,
            // R2 no implementa la firma SigV4 en streaming ni el checksum
            // por defecto del SDK v4. Sin estos flags, PutObject falla con
            // "STREAMING-AWS4-HMAC-SHA256-PAYLOAD not implemented".
            DisablePayloadSigning = true,
            DisableDefaultChecksumValidation = true,
        }, cancellationToken);
    }

    public async Task DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        await _client.DeleteObjectAsync(_bucket, key, cancellationToken);
    }

    public async Task<IReadOnlyList<string>> ListAsync(string prefix, CancellationToken cancellationToken = default)
    {
        var keys = new List<string>();
        string? token = null;
        do
        {
            var response = await _client.ListObjectsV2Async(new ListObjectsV2Request
            {
                BucketName = _bucket,
                Prefix = prefix,
                ContinuationToken = token,
            }, cancellationToken);
            keys.AddRange(response.S3Objects.Select(item => item.Key));
            token = response.IsTruncated == true ? response.NextContinuationToken : null;
        } while (token is not null);
        return keys;
    }
}
