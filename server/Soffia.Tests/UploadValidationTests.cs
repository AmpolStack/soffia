using Soffia.Core;

namespace Soffia.Tests;

public class UploadValidationTests
{
    private const string TinyPng =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

    [Fact]
    public void Validate_AceptaMarkdownEImagenPng()
    {
        var upload = new DeckUpload
        {
            Markdown = "---\nid: x\ntitle: X\n---\n# X\n\n## Sección\n",
            SourceName = "deck.md",
            Assets =
            [
                new DeckAssetUpload
                {
                    Key = "imagen.png",
                    ContentType = "application/octet-stream",
                    Base64 = TinyPng,
                },
            ],
        };

        var errors = UploadValidation.Validate(upload);

        Assert.Empty(errors);
        Assert.Equal("image/png", upload.Assets[0].ContentType);
    }

    [Fact]
    public void Validate_RechazaExtensionNoPermitida()
    {
        var upload = new DeckUpload
        {
            Markdown = "# Deck",
            SourceName = "deck.md",
            Assets =
            [
                new DeckAssetUpload
                {
                    Key = "script.html",
                    ContentType = "text/html",
                    Base64 = TinyPng,
                },
            ],
        };

        var errors = UploadValidation.Validate(upload);
        Assert.Contains(errors, error => error.Message.Contains("Formato de imagen no permitido"));
    }

    [Fact]
    public void Validate_RechazaBase64Invalido()
    {
        var upload = new DeckUpload
        {
            Markdown = "# Deck",
            SourceName = "deck.md",
            Assets =
            [
                new DeckAssetUpload
                {
                    Key = "imagen.png",
                    ContentType = "image/png",
                    Base64 = "no-es-base64",
                },
            ],
        };

        var errors = UploadValidation.Validate(upload);
        Assert.Contains(errors, error => error.Message.Contains("base64"));
    }

    [Theory]
    [InlineData("../imagen.png")]
    [InlineData("carpeta/../../imagen.png")]
    [InlineData("imagen?.png")]
    [InlineData("imagen:alternativa.png")]
    public void Validate_RechazaNombresDeAssetPeligrosos(string key)
    {
        var upload = new DeckUpload
        {
            Markdown = "# Deck",
            SourceName = "deck.md",
            Assets =
            [
                new DeckAssetUpload
                {
                    Key = key,
                    ContentType = "image/png",
                    Base64 = TinyPng,
                },
            ],
        };

        var errors = UploadValidation.Validate(upload);
        Assert.Contains(errors, error => error.Message.Contains("nombre de archivo no permitido"));
    }

    [Fact]
    public void Validate_NormalizaCamposNulos()
    {
        var upload = new DeckUpload
        {
            Markdown = "# Deck",
            SourceName = null!,
            Assets = null!,
        };

        var errors = UploadValidation.Validate(upload);

        Assert.Empty(errors);
        Assert.Equal("documento.md", upload.SourceName);
        Assert.Empty(upload.Assets);
    }
}
