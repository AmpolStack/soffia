using Soffia.Core;

namespace Soffia.Tests;

public class FileNamingTests
{
    [Theory]
    [InlineData("seminario.md", "a1b2", "soffia-seminario-a1b2.md")]
    [InlineData("Mi archivo de prueba.md", "0f3c", "soffia-mi-archivo-de-prueba-0f3c.md")]
    [InlineData("Impétigo (clínico).md", "beef", "soffia-impetigo-clinico-beef.md")]
    [InlineData("CON.md", "cafe", "soffia-con-file-cafe.md")]
    public void Create_GeneraNombresRfc(string source, string shortId, string expected)
    {
        Assert.Equal(expected, FileNaming.Create(source, shortId));
    }

    [Fact]
    public void Create_RecortaNombresLargos()
    {
        var name = new string('a', 300) + ".md";
        var result = FileNaming.Create(name, "1234");
        Assert.True(result.Length <= 120);
        Assert.EndsWith("-1234.md", result);
    }

    [Theory]
    [InlineData("")]
    [InlineData("123")]
    [InlineData("xyz1")]
    [InlineData("12345")]
    public void Create_RechazaShortIdsInvalidos(string shortId)
    {
        Assert.Throws<ArgumentException>(() => FileNaming.Create("deck.md", shortId));
    }

    [Fact]
    public void Slugify_EliminaAcentosYSignos()
    {
        Assert.Equal("anatomia-del-corazon", FileNaming.Slugify("Anatomía del corazón"));
        Assert.Equal("", FileNaming.Slugify("   "));
    }
}
