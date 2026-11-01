using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Soffia.Api.Auth;

public sealed class TokenService
{
    public const string CookieName = "soffia_session";
    private readonly AuthSettings _settings;
    private readonly SymmetricSecurityKey _key;

    public TokenService(AuthSettings settings)
    {
        _settings = settings;
        _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SessionSecret));
    }

    public string Create()
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, _settings.Username),
            new Claim("display_name", string.IsNullOrWhiteSpace(_settings.Name) ? _settings.Username : _settings.Name),
        };
        var token = new JwtSecurityToken(
            issuer: "soffia",
            audience: "soffia",
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: new SigningCredentials(_key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public TokenValidationParameters ValidationParameters => new()
    {
        ValidateIssuer = true,
        ValidIssuer = "soffia",
        ValidateAudience = true,
        ValidAudience = "soffia",
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = _key,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1),
    };
}
