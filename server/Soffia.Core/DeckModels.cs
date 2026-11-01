namespace Soffia.Core;

public sealed record DeckSummary(
    int Sections,
    int Subsections,
    int Quizzes,
    int Cards,
    int Questions,
    int References,
    int Images,
    int Words,
    int Minutes);

public sealed record ValidationMessage(int? Line, string Message, string Severity);

public sealed record DeckValidationResult(
    bool Ok,
    IReadOnlyList<ValidationMessage> Errors,
    IReadOnlyList<ValidationMessage> Warnings,
    DeckSummary Summary,
    string? Id,
    string? Title,
    string? Subtitle,
    string? Description,
    IReadOnlyList<string> Tags,
    string Language,
    string? Author);

public sealed class DeckAssetUpload
{
    public string Key { get; set; } = "";
    public string ContentType { get; set; } = "application/octet-stream";
    public string Base64 { get; set; } = "";
}

public sealed class DeckUpload
{
    public string Markdown { get; set; } = "";
    public string SourceName { get; set; } = "documento.md";
    public List<DeckAssetUpload> Assets { get; set; } = [];
    public string? ShortId { get; set; }
}

public sealed class DeckMeta
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Subtitle { get; set; }
    public string? Description { get; set; }
    public List<string> Tags { get; set; } = [];
    public string Language { get; set; } = "es";
    public string? Author { get; set; }
    public string SourceName { get; set; } = "documento.md";
    public string FileName { get; set; } = "";
    public string ShortId { get; set; } = "";
    public List<string> AssetKeys { get; set; } = [];
    public string? BaseUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset? LastOpenedAt { get; set; }
    public DeckSummary Summary { get; set; } = new(0, 0, 0, 0, 0, 0, 0, 0, 0);
    public string? StorageWarning { get; set; }
}

public sealed class ImportedDeckResult
{
    public string File { get; set; } = "";
    public bool Ok { get; set; }
    public DeckMeta? Deck { get; set; }
    public List<ValidationMessage> Errors { get; set; } = [];
    public List<ValidationMessage> Warnings { get; set; } = [];
}
