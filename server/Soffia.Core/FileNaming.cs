using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Soffia.Core;

public static partial class FileNaming
{
    private static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase)
    {
        "CON", "PRN", "AUX", "NUL",
        "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
        "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    };

    public static string ShortId()
    {
        return Guid.NewGuid().ToString("N")[..4];
    }

    public static string Create(string sourceName, string shortId)
    {
        var id = shortId.Trim().ToLowerInvariant();
        if (!ShortIdPattern().IsMatch(id))
            throw new ArgumentException("El short ID debe tener 4 caracteres hexadecimales.", nameof(shortId));

        var baseName = Path.GetFileName(sourceName).Trim();
        if (baseName.EndsWith(".md", StringComparison.OrdinalIgnoreCase))
            baseName = baseName[..^3];
        if (baseName.EndsWith(".markdown", StringComparison.OrdinalIgnoreCase))
            baseName = baseName[..^9];
        if (baseName.EndsWith(".txt", StringComparison.OrdinalIgnoreCase))
            baseName = baseName[..^4];

        var slug = Slugify(baseName);
        var maxSlug = Math.Max(1, 120 - "soffia--.md".Length - id.Length);
        if (slug.Length > maxSlug) slug = slug[..maxSlug].TrimEnd('-');
        if (string.IsNullOrWhiteSpace(slug)) slug = "deck";

        return $"soffia-{slug}-{id}.md";
    }

    public static string Slugify(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark) continue;
            var lower = char.ToLowerInvariant(character);
            if ((lower >= 'a' && lower <= 'z') || (lower >= '0' && lower <= '9')) builder.Append(lower);
            else builder.Append('-');
        }

        var slug = Regex.Replace(builder.ToString(), "-+", "-").Trim('-');
        if (Reserved.Contains(slug)) slug += "-file";
        return slug;
    }

    [GeneratedRegex("^[0-9a-f]{4}$")]
    private static partial Regex ShortIdPattern();
}
