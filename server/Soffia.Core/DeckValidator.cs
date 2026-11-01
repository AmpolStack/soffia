using System.Text.RegularExpressions;
using YamlDotNet.Serialization;

namespace Soffia.Core;

public static partial class DeckValidator
{
    private static readonly HashSet<string> KnownDirectives = new(StringComparer.OrdinalIgnoreCase)
    {
        "callout", "note", "quote", "grid", "steps", "quiz", "flashcards", "qa",
        "references", "keypoints", "gallery", "figure",
    };

    private static readonly Regex IdPattern = new(
        @"^[\p{L}\p{N}][\p{L}\p{N}._-]{0,63}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly HashSet<string> ReservedWindowsNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "con", "prn", "aux", "nul",
        "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
        "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
    };

    public static bool IsValidId(string? id)
    {
        if (string.IsNullOrWhiteSpace(id) || !IdPattern.IsMatch(id)) return false;
        if (id.Contains("..", StringComparison.Ordinal) || id.EndsWith('.')) return false;
        var stem = id.Split('.')[0];
        return !ReservedWindowsNames.Contains(stem);
    }

    public static DeckValidationResult Validate(string markdown)
    {
        var errors = new List<ValidationMessage>();
        var warnings = new List<ValidationMessage>();
        var normalized = markdown.Replace("\r\n", "\n").Replace('\r', '\n');
        var lines = normalized.Split('\n');
        var bodyStart = 0;
        Dictionary<string, object?>? frontmatter = null;

        if (lines.Length == 0 || lines[0].Trim() != "---")
        {
            errors.Add(new(null, "Falta el frontmatter YAML: el archivo debe empezar por ---.", "error"));
        }
        else
        {
            var close = -1;
            for (var i = 1; i < lines.Length; i++)
            {
                if (lines[i].Trim() == "---") { close = i; break; }
            }
            if (close < 0)
            {
                errors.Add(new(1, "El frontmatter no tiene cierre ---.", "error"));
            }
            else
            {
                bodyStart = close + 1;
                try
                {
                    var yaml = string.Join("\n", lines.Skip(1).Take(close - 1));
                    var raw = new DeserializerBuilder().Build().Deserialize<Dictionary<object, object?>>(yaml) ?? [];
                    frontmatter = raw.ToDictionary(
                        pair => pair.Key?.ToString() ?? "",
                        pair => pair.Value,
                        StringComparer.OrdinalIgnoreCase);
                }
                catch (Exception error)
                {
                    errors.Add(new(1, "No se pudo leer el YAML: " + error.Message, "error"));
                }
            }
        }

        var id = GetString(frontmatter, "id");
        var title = GetString(frontmatter, "title");
        var subtitle = GetString(frontmatter, "subtitle");
        var description = GetString(frontmatter, "description");
        var language = GetString(frontmatter, "language") ?? "es";
        var author = GetString(frontmatter, "author");
        var tags = GetList(frontmatter, "tags");
        if (string.IsNullOrWhiteSpace(id)) errors.Add(new(1, "Falta id en el frontmatter.", "error"));
        else if (!IsValidId(id))
            errors.Add(new(1, "El id no es válido: usa letras, números, guiones, puntos o guiones bajos (máximo 64), sin barras, espacios ni secuencias '..'.", "error"));
        if (string.IsNullOrWhiteSpace(title)) errors.Add(new(1, "Falta title en el frontmatter.", "error"));
        if (frontmatter is not null && !frontmatter.ContainsKey("description"))
            warnings.Add(new(1, "Falta description en el frontmatter.", "warning"));

        var body = string.Join("\n", lines.Skip(bodyStart));
        var fence = false;
        var h1Count = 0;
        var h2Count = 0;
        var h3Count = 0;
        var seenH2 = false;
        var headings = new List<(int Line, int Level, string Text)>();
        var directives = new List<DirectiveBlock>();
        var stack = new List<DirectiveBlock>();

        for (var i = bodyStart; i < lines.Length; i++)
        {
            var line = lines[i];
            var lineNumber = i + 1;
            if (Fence().IsMatch(line)) { fence = !fence; continue; }
            if (fence) continue;

            var open = DirectiveOpen().Match(line);
            if (open.Success)
            {
                var name = open.Groups[1].Value.ToLowerInvariant();
                if (!KnownDirectives.Contains(name))
                    warnings.Add(new(lineNumber, $"Bloque desconocido :::{name}.", "warning"));
                var block = new DirectiveBlock(name, lineNumber, line, new List<string>());
                directives.Add(block);
                stack.Add(block);
                continue;
            }
            if (DirectiveClose().IsMatch(line))
            {
                if (stack.Count == 0) errors.Add(new(lineNumber, "Hay un cierre ::: sin bloque abierto.", "error"));
                else stack.RemoveAt(stack.Count - 1);
                continue;
            }
            if (stack.Count > 0) { stack[^1].Lines.Add(line); continue; }

            var heading = Heading().Match(line);
            if (!heading.Success) continue;
            var level = heading.Groups[1].Value.Length;
            var text = heading.Groups[2].Value.Trim();
            headings.Add((lineNumber, level, text));
            if (level == 1) h1Count++;
            if (level == 2) { h2Count++; seenH2 = true; }
            if (level == 3)
            {
                h3Count++;
                if (!seenH2) errors.Add(new(lineNumber, "Hay una subsección H3 antes de la primera H2.", "error"));
            }
            if (level <= 3 && ManualNumbering().IsMatch(text))
                warnings.Add(new(lineNumber, "El encabezado incluye numeración manual.", "warning"));
        }

        if (stack.Count > 0)
        {
            foreach (var block in stack)
                errors.Add(new(block.Line, $"El bloque :::{block.Name} no tiene cierre :::.", "error"));
        }
        if (h1Count != 1) errors.Add(new(null, "Debe haber exactamente un H1.", "error"));
        if (h2Count == 0) errors.Add(new(null, "No hay secciones H2.", "error"));

        var quizCount = 0;
        var cardCount = 0;
        var questionCount = 0;
        var referenceCount = 0;
        var imageCount = 0;

        foreach (var block in directives)
        {
            switch (block.Name)
            {
                case "quiz":
                    quizCount++;
                    ValidateQuiz(block, errors, warnings);
                    break;
                case "flashcards":
                    cardCount += ValidateCards(block, errors, warnings, isQuestion: false);
                    break;
                case "qa":
                    questionCount += ValidateCards(block, errors, warnings, isQuestion: true);
                    break;
                case "references":
                    referenceCount += ValidateReferences(block, errors, warnings);
                    break;
                case "keypoints":
                    ValidateKeypoints(block, errors, warnings);
                    break;
                case "figure":
                    imageCount++;
                    ValidateFigure(block, errors, warnings);
                    break;
                case "gallery":
                    imageCount += ValidateGallery(block, errors, warnings);
                    break;
            }
        }

        fence = false;
        foreach (var (line, lineNumber) in lines.Skip(bodyStart).Select((text, index) => (text, index + bodyStart + 1)))
        {
            if (Fence().IsMatch(line)) { fence = !fence; continue; }
            if (fence) continue;
            foreach (Match match in Image().Matches(line))
            {
                imageCount++;
                var alt = match.Groups[1].Value.Trim();
                var src = match.Groups[2].Value.Trim();
                if (string.IsNullOrWhiteSpace(alt))
                    warnings.Add(new(lineNumber, "La imagen no tiene texto alternativo.", "warning"));
                if (src.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                    warnings.Add(new(lineNumber, "La imagen usa http:// sin cifrar.", "warning"));
            }
            if (Html().IsMatch(line))
                warnings.Add(new(lineNumber, "El HTML crudo no se renderiza; usa Markdown.", "warning"));
        }

        var words = Word().Matches(body).Count;
        var estimated = GetInt(frontmatter, "estimatedMinutes");
        var minutes = estimated is > 0 and <= 240
            ? estimated.Value
            : (words == 0 ? 1 : Math.Max(1, (int)Math.Ceiling(words / 200.0)));
        var summary = new DeckSummary(h2Count, h3Count, quizCount, cardCount, questionCount, referenceCount, imageCount, words, minutes);

        return new DeckValidationResult(errors.Count == 0, errors, warnings, summary, id, title, subtitle, description, tags, language, author);
    }

    private static void ValidateQuiz(DirectiveBlock block, List<ValidationMessage> errors, List<ValidationMessage> warnings)
    {
        var options = block.Lines.Where(line => QuizOption().IsMatch(line)).ToList();
        if (options.Count < 2) errors.Add(new(block.Line, "El quiz necesita al menos dos opciones.", "error"));
        if (!options.Any(line => QuizOption().Match(line).Groups[1].Value.Equals("x", StringComparison.OrdinalIgnoreCase)))
            errors.Add(new(block.Line, "El quiz no tiene ninguna opción correcta [x].", "error"));
        var last = block.Lines.FindLastIndex(line => QuizOption().IsMatch(line));
        if (last >= 0 && string.IsNullOrWhiteSpace(string.Join(" ", block.Lines.Skip(last + 1))))
            warnings.Add(new(block.Line, "El quiz no tiene explicación.", "warning"));
    }

    private static int ValidateCards(DirectiveBlock block, List<ValidationMessage> errors, List<ValidationMessage> warnings, bool isQuestion)
    {
        var cards = SplitCards(block.Lines);
        foreach (var card in cards)
        {
            if (card.Count == 0) continue;
            var front = card.FirstOrDefault(line => line.TrimStart().StartsWith("###", StringComparison.Ordinal))?.TrimStart('#', ' ', '\t').Trim();
            var rest = card.SkipWhile(line => !line.TrimStart().StartsWith("###", StringComparison.Ordinal)).Skip(1).ToList();
            if (front is null)
            {
                var pipe = string.Join("\n", card).Split("||", 2);
                front = pipe[0].Trim();
                rest = pipe.Length > 1 ? [pipe[1].Trim()] : [];
            }
            if (string.IsNullOrWhiteSpace(front) || string.IsNullOrWhiteSpace(string.Join("", rest)))
                errors.Add(new(block.Line, isQuestion ? "Una pregunta no tiene frente o respuesta." : "Una tarjeta no tiene frente o reverso.", "error"));
            else if (isQuestion && front is not null && !front.EndsWith('?') && !front.EndsWith('¿'))
                warnings.Add(new(block.Line, "La pregunta abierta no termina en signo de interrogación.", "warning"));
        }
        return cards.Count(card => card.Count > 0);
    }

    private static int ValidateReferences(DirectiveBlock block, List<ValidationMessage> errors, List<ValidationMessage> warnings)
    {
        var count = 0;
        foreach (var line in block.Lines)
        {
            var match = ReferenceLink().Match(line);
            if (!match.Success) continue;
            count++;
            var url = match.Groups[2].Value;
            if (!url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase))
                warnings.Add(new(block.Line, "La referencia debe usar https://: " + url, "warning"));
        }
        if (count == 0) errors.Add(new(block.Line, "El bloque references no contiene referencias.", "error"));
        return count;
    }

    private static void ValidateKeypoints(DirectiveBlock block, List<ValidationMessage> errors, List<ValidationMessage> warnings)
    {
        var points = block.Lines.Count(line => Regex.IsMatch(line, @"^\s*[-*+]\s+\S"));
        if (points == 0) errors.Add(new(block.Line, "Keypoints no contiene elementos de lista.", "error"));
        if (points > 10) warnings.Add(new(block.Line, "Keypoints tiene más de 10 puntos.", "warning"));
    }

    private static void ValidateFigure(DirectiveBlock block, List<ValidationMessage> errors, List<ValidationMessage> warnings)
    {
        var all = block.Header + "\n" + string.Join("\n", block.Lines);
        var src = Attr(all, "src") ?? Image().Match(all).Groups[2].Value;
        if (string.IsNullOrWhiteSpace(src)) errors.Add(new(block.Line, "La figura no tiene src.", "error"));
        if (string.IsNullOrWhiteSpace(Attr(all, "alt") ?? Image().Match(all).Groups[1].Value))
            warnings.Add(new(block.Line, "La figura no tiene texto alternativo.", "warning"));
        if (string.IsNullOrWhiteSpace(Attr(all, "caption")))
            warnings.Add(new(block.Line, "La figura no tiene pie de foto.", "warning"));
        if (src?.StartsWith("https://", StringComparison.OrdinalIgnoreCase) == true && string.IsNullOrWhiteSpace(Attr(all, "credit")))
            warnings.Add(new(block.Line, "La figura usa una imagen web y no indica crédito.", "warning"));
    }

    private static int ValidateGallery(DirectiveBlock block, List<ValidationMessage> errors, List<ValidationMessage> warnings)
    {
        var count = 0;
        foreach (var line in block.Lines)
        {
            var match = Image().Match(line);
            if (!match.Success) continue;
            count++;
            if (string.IsNullOrWhiteSpace(match.Groups[1].Value))
                warnings.Add(new(block.Line, "La imagen de la galería no tiene alt.", "warning"));
        }
        if (count == 0) errors.Add(new(block.Line, "La galería no contiene imágenes.", "error"));
        return count;
    }

    private static List<List<string>> SplitCards(List<string> lines)
    {
        var cards = new List<List<string>>();
        var current = new List<string>();
        foreach (var line in lines)
        {
            if (line.Trim() == "---")
            {
                cards.Add(current);
                current = [];
            }
            else current.Add(line);
        }
        if (current.Any(line => !string.IsNullOrWhiteSpace(line))) cards.Add(current);
        return cards;
    }

    private static string? GetString(Dictionary<string, object?>? data, string key)
    {
        return data is not null && data.TryGetValue(key, out var value) ? value?.ToString() : null;
    }

    private static int? GetInt(Dictionary<string, object?>? data, string key)
    {
        return data is not null && data.TryGetValue(key, out var value) && int.TryParse(value?.ToString(), out var result) ? result : null;
    }

    private static List<string> GetList(Dictionary<string, object?>? data, string key)
    {
        if (data is null || !data.TryGetValue(key, out var value) || value is null) return [];
        if (value is IEnumerable<object?> items) return items.Select(item => item?.ToString() ?? "").Where(item => item.Length > 0).ToList();
        return value.ToString()?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() ?? [];
    }

    private static string? Attr(string text, string name)
    {
        var match = Regex.Match(text, name + @"\s*=\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }

    private sealed record DirectiveBlock(string Name, int Line, string Header, List<string> Lines);

    [GeneratedRegex(@"^\s*(```|~~~)")]
    private static partial Regex Fence();
    [GeneratedRegex(@"^\s*:::\s*([A-Za-z][\w-]*)")]
    private static partial Regex DirectiveOpen();
    [GeneratedRegex(@"^\s*:::\s*$")]
    private static partial Regex DirectiveClose();
    [GeneratedRegex(@"^\s*(#{1,6})\s+(.+?)\s*$")]
    private static partial Regex Heading();
    [GeneratedRegex(@"^\s*\d+(?:\.\d+)*[.)]?\s")]
    private static partial Regex ManualNumbering();
    [GeneratedRegex(@"^\s*[-*+]\s+\[([ xX])\]\s+(.+)")]
    private static partial Regex QuizOption();
    [GeneratedRegex(@"\[([^\]]+)\]\(([^)]+)\)")]
    private static partial Regex ReferenceLink();
    [GeneratedRegex(@"!\[([^\]]*)\]\(([^)\s]+)")]
    private static partial Regex Image();
    [GeneratedRegex(@"<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>")]
    private static partial Regex Html();
    [GeneratedRegex(@"\b[\p{L}\p{N}][\p{L}\p{N}'-]*\b")]
    private static partial Regex Word();
}

