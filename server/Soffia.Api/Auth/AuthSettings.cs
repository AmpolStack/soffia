using System.Security.Cryptography;
using System.Text;

namespace Soffia.Api.Auth;

public sealed class AuthSettings
{
    public string Name { get; init; } = "";
    public string Username { get; init; } = "";
    public string Password { get; init; } = "";
    public string SessionSecret { get; init; } = "";

    public static AuthSettings FromEnvironment()
    {
        var settings = new AuthSettings
        {
            Name = Environment.GetEnvironmentVariable("APP_AUTHENTICATION_NAME") ?? "",
            Username = Environment.GetEnvironmentVariable("APP_AUTHENTICATION_USERNAME") ?? "",
            Password = Environment.GetEnvironmentVariable("APP_AUTHENTICATION_PASSWORD") ?? "",
            SessionSecret = Environment.GetEnvironmentVariable("APP_SESSION_SECRET") ?? "",
        };
        settings.Validate();
        return settings;
    }

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(Username))
            throw new InvalidOperationException("Falta APP_AUTHENTICATION_USERNAME.");
        if (string.IsNullOrWhiteSpace(Password))
            throw new InvalidOperationException("Falta APP_AUTHENTICATION_PASSWORD.");
        if (Encoding.UTF8.GetByteCount(Username) > 70 || Username.Length > 15)
            throw new InvalidOperationException("APP_AUTHENTICATION_USERNAME supera el límite de 15 caracteres o 70 bytes.");
        if (Encoding.UTF8.GetByteCount(Password) > 70)
            throw new InvalidOperationException("APP_AUTHENTICATION_PASSWORD supera el límite de 70 bytes.");
        if (Name.Length > 20 || Encoding.UTF8.GetByteCount(Name) > 70)
            throw new InvalidOperationException("APP_AUTHENTICATION_NAME supera el límite de 20 caracteres o 70 bytes.");
        if (Encoding.UTF8.GetByteCount(SessionSecret) < 32)
            throw new InvalidOperationException("APP_SESSION_SECRET debe tener al menos 32 bytes.");
    }

    public bool Matches(string username, string password)
    {
        // Se comparan hashes de longitud fija para no filtrar la longitud
        // de las credenciales por el tiempo de respuesta.
        var userOk = CryptographicOperations.FixedTimeEquals(
            Hash(Username),
            Hash(username));
        var passwordOk = CryptographicOperations.FixedTimeEquals(
            Hash(Password),
            Hash(password));
        return userOk & passwordOk;
    }

    private static byte[] Hash(string value)
    {
        return SHA256.HashData(Encoding.UTF8.GetBytes(value));
    }
}
