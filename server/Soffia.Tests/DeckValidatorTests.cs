using Soffia.Core;

namespace Soffia.Tests;

public class DeckValidatorTests
{
    private const string ValidDeck = """
        ---
        id: prueba-validator
        title: "Deck de prueba"
        subtitle: Una prueba del validador
        description: Un deck mínimo para comprobar el contrato del servidor.
        tags: [Prueba, Validación]
        language: es
        author: soffia
        estimatedMinutes: 7
        ---

        # Deck de prueba

        Introducción breve.

        :::keypoints
        - Una idea.
        - Otra idea.
        :::

        ## Concepto

        Texto del concepto con una imagen web.

        :::figure{src="https://example.com/imagen.png" alt="Esquema" caption="Esquema de prueba" credit="Ejemplo"}
        :::

        :::quiz{id=q-1}
        **Pregunta:** ¿Qué etiqueta crea una sección?

        - [ ] H1.
        - [x] H2.

        > **Explicación:** Los H2 crean secciones.
        :::

        ## Repaso

        :::flashcards{id=fc-1}
        ### ¿Qué crea un H2?
        Una sección principal.
        :::

        :::references
        1. [Documentación](https://example.com/docs) — Fuente.
        :::
        """;

    [Fact]
    public void Validate_AceptaUnDeckCompleto()
    {
        var result = DeckValidator.Validate(ValidDeck);

        Assert.True(result.Ok);
        Assert.Empty(result.Errors);
        Assert.Equal("prueba-validator", result.Id);
        Assert.Equal("Deck de prueba", result.Title);
        Assert.Equal(["Prueba", "Validación"], result.Tags);
        Assert.Equal("es", result.Language);
        Assert.Equal(7, result.Summary.Minutes);
        Assert.Equal(2, result.Summary.Sections);
        Assert.Equal(1, result.Summary.Quizzes);
        Assert.Equal(1, result.Summary.Cards);
        Assert.Equal(1, result.Summary.Images);
    }

    [Fact]
    public void Validate_RechazaFrontmatterAusente()
    {
        var result = DeckValidator.Validate("# Solo Markdown\n\n## Sección\n");
        Assert.False(result.Ok);
        Assert.Contains(result.Errors, error => error.Message.Contains("frontmatter"));
    }

    [Fact]
    public void Validate_RechazaBloquesSinCerrar()
    {
        var broken = ValidDeck.Replace("""
            :::references
            1. [Documentación](https://example.com/docs) — Fuente.
            :::
            """, """
            :::references
            1. [Documentación](https://example.com/docs) — Fuente.
            """);
        var result = DeckValidator.Validate(broken);
        Assert.False(result.Ok);
        Assert.Contains(result.Errors, error => error.Message.Contains("no tiene cierre"));
    }

    [Fact]
    public void Validate_RechazaQuizSinRespuestaCorrecta()
    {
        var broken = ValidDeck.Replace("- [x] H2.", "- [ ] H2.");
        var result = DeckValidator.Validate(broken);
        Assert.False(result.Ok);
        Assert.Contains(result.Errors, error => error.Message.Contains("opción correcta"));
    }

    [Fact]
    public void Validate_AvisaDeFiguraSinCredito()
    {
        var withoutCredit = ValidDeck.Replace(" credit=\"Ejemplo\"", "");
        var result = DeckValidator.Validate(withoutCredit);
        Assert.True(result.Ok);
        Assert.Contains(result.Warnings, warning => warning.Message.Contains("crédito"));
    }

    [Theory]
    [InlineData("mi-deck")]
    [InlineData("deck_2")]
    [InlineData("deck.v2")]
    [InlineData("anatomía-del-corazón")]
    public void IsValidId_AceptaSlugsSeguros(string id)
    {
        Assert.True(DeckValidator.IsValidId(id));
    }

    [Theory]
    [InlineData("../otro")]
    [InlineData("a/b")]
    [InlineData("a\\b")]
    [InlineData("..")]
    [InlineData(".oculto")]
    [InlineData("con")]
    [InlineData("CON.txt")]
    [InlineData("deck.")]
    [InlineData("deck con espacios")]
    [InlineData("")]
    public void IsValidId_RechazaIdsPeligrosos(string id)
    {
        Assert.False(DeckValidator.IsValidId(id));
    }

    [Fact]
    public void Validate_RechazaIdConTravesiaDeRutas()
    {
        var broken = ValidDeck.Replace("id: prueba-validator", "id: ../otro");
        var result = DeckValidator.Validate(broken);
        Assert.False(result.Ok);
        Assert.Contains(result.Errors, error => error.Message.Contains("id no es válido"));
    }
}
