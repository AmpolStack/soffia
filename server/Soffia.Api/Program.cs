using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Soffia.Api;
using Soffia.Api.Auth;
using Soffia.Api.Storage;
using Soffia.Core;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 30 * 1024 * 1024;
});

var auth = AuthSettings.FromEnvironment();
var tokens = new TokenService(auth);
var storageOptions = new StorageOptions();
var corsOrigins = (Environment.GetEnvironmentVariable("CORS_ORIGINS") ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
var trustProxy = string.Equals(Environment.GetEnvironmentVariable("TRUST_PROXY"), "true", StringComparison.OrdinalIgnoreCase);

builder.Services.AddSingleton(auth);
builder.Services.AddSingleton(tokens);
builder.Services.AddSingleton(Options.Create(storageOptions));
if (storageOptions.HasR2)
    builder.Services.AddSingleton<IObjectStorage, R2ObjectStorage>();
else
    builder.Services.AddSingleton<IObjectStorage, LocalObjectStorage>();
builder.Services.AddSingleton<DeckStore>();

if (corsOrigins.Length > 0)
{
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("frontend", policy => policy
            .WithOrigins(corsOrigins)
            .AllowCredentials()
            .AllowAnyHeader()
            .AllowAnyMethod());
    });
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = tokens.ValidationParameters;
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies[TokenService.CookieName];
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", _ => RateLimitPartition.GetFixedWindowLimiter(
        "soffia-login",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

var app = builder.Build();

if (trustProxy)
{
    var forwarded = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
        ForwardLimit = 1,
    };
    forwarded.KnownNetworks.Clear();
    forwarded.KnownProxies.Clear();
    app.UseForwardedHeaders(forwarded);
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    context.Response.Headers["Cross-Origin-Opener-Policy"] = "same-origin";
    if (context.Request.Path.StartsWithSegments("/api"))
        context.Response.Headers["Cache-Control"] = "no-store";
    await next();
});

app.Use(async (context, next) =>
{
    var segments = context.Request.Path.Value?.Split('/', StringSplitOptions.RemoveEmptyEntries);
    if (segments is { Length: >= 3 } &&
        string.Equals(segments[0], "api", StringComparison.OrdinalIgnoreCase) &&
        (string.Equals(segments[1], "decks", StringComparison.OrdinalIgnoreCase) ||
         string.Equals(segments[1], "progress", StringComparison.OrdinalIgnoreCase)) &&
        !DeckValidator.IsValidId(Uri.UnescapeDataString(segments[2])))
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { error = "Id de deck no válido." });
        return;
    }
    await next();
});

app.Use(async (context, next) =>
{
    if ((HttpMethods.IsPost(context.Request.Method) || HttpMethods.IsPut(context.Request.Method) || HttpMethods.IsDelete(context.Request.Method)) &&
        context.Request.Path.StartsWithSegments("/api") &&
        context.Request.Headers["X-Soffia-Request"] != "1")
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { error = "Falta la cabecera X-Soffia-Request." });
        return;
    }
    await next();
});
if (corsOrigins.Length > 0) app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();

var sameSite = (Environment.GetEnvironmentVariable("APP_COOKIE_SAMESITE") ?? "lax").ToLowerInvariant() switch
{
    "none" => SameSiteMode.None,
    "strict" => SameSiteMode.Strict,
    _ => SameSiteMode.Lax,
};
var secureCookies = !app.Environment.IsDevelopment() ||
    string.Equals(Environment.GetEnvironmentVariable("APP_COOKIE_SECURE"), "true", StringComparison.OrdinalIgnoreCase) ||
    sameSite == SameSiteMode.None;
var cookieOptions = new CookieOptions
{
    HttpOnly = true,
    Secure = secureCookies,
    SameSite = sameSite,
    Expires = DateTimeOffset.UtcNow.AddHours(12),
    Path = "/",
};

app.MapGet("/api/health", () => Results.Ok(new { ok = true, service = "soffia" }));

app.MapPost("/api/auth/login", (LoginRequest request, HttpContext context) =>
{
    if (Encoding.UTF8.GetByteCount(request.Username ?? "") > 70 ||
        Encoding.UTF8.GetByteCount(request.Password ?? "") > 70 ||
        (request.Username?.Length ?? 0) > 15)
    {
        return Results.BadRequest(new { error = "Credenciales fuera de límite." });
    }

    if (!auth.Matches(request.Username ?? "", request.Password ?? ""))
        return Results.Unauthorized();

    var token = tokens.Create();
    context.Response.Cookies.Append(TokenService.CookieName, token, cookieOptions);
    return Results.Ok(new { ok = true, username = auth.Username, name = string.IsNullOrWhiteSpace(auth.Name) ? auth.Username : auth.Name });
}).RequireRateLimiting("login");

app.MapPost("/api/auth/logout", (HttpContext context) =>
{
    context.Response.Cookies.Delete(TokenService.CookieName, new CookieOptions
    {
        HttpOnly = true,
        Secure = cookieOptions.Secure,
        SameSite = cookieOptions.SameSite,
        Path = "/",
    });
    return Results.Ok(new { ok = true });
});

app.MapGet("/api/auth/session", (HttpContext context) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var name = context.User.FindFirstValue("display_name") ?? context.User.Identity.Name ?? auth.Username;
    return Results.Ok(new { authenticated = true, username = auth.Username, name });
});

app.MapGet("/api/decks", async (DeckStore store, CancellationToken cancellationToken) =>
    Results.Ok(await store.ListAsync(cancellationToken)))
    .RequireAuthorization();

app.MapGet("/api/decks/{id}", async (string id, DeckStore store, CancellationToken cancellationToken) =>
{
    var deck = await store.GetAsync(id, cancellationToken);
    if (deck is null) return Results.NotFound();
    return Results.Ok(new { meta = deck.Value.Meta, markdown = deck.Value.Markdown });
}).RequireAuthorization();

app.MapPost("/api/decks/import", async (DeckImportRequest request, DeckStore store, CancellationToken cancellationToken) =>
{
    var results = new List<ImportedDeckResult>();
    var uploads = request.Files ?? [];
    if (uploads.Count > 50)
        return Results.BadRequest(new { error = "No se pueden importar más de 50 archivos a la vez." });

    foreach (var upload in uploads)
    {
        var uploadErrors = UploadValidation.Validate(upload);
        if (uploadErrors.Count > 0)
        {
            results.Add(new ImportedDeckResult
            {
                File = upload.SourceName,
                Ok = false,
                Errors = uploadErrors,
            });
            continue;
        }

        var validation = DeckValidator.Validate(upload.Markdown);
        if (!validation.Ok)
        {
            results.Add(new ImportedDeckResult
            {
                File = upload.SourceName,
                Ok = false,
                Errors = validation.Errors.ToList(),
                Warnings = validation.Warnings.ToList(),
            });
            continue;
        }

        try
        {
            var meta = await store.SaveAsync(upload, validation, cancellationToken);
            results.Add(new ImportedDeckResult
            {
                File = upload.SourceName,
                Ok = true,
                Deck = meta,
                Warnings = validation.Warnings.ToList(),
            });
        }
        catch (Exception error)
        {
            results.Add(new ImportedDeckResult
            {
                File = upload.SourceName,
                Ok = false,
                Errors = [new ValidationMessage(null, error.Message, "error")],
            });
        }
    }

    return Results.Ok(new
    {
        imported = results.Count(result => result.Ok),
        failed = results.Count(result => !result.Ok),
        results,
    });
}).RequireAuthorization();

app.MapPut("/api/decks/{id}", async (string id, DeckUpload upload, DeckStore store, CancellationToken cancellationToken) =>
{
    var uploadErrors = UploadValidation.Validate(upload);
    if (uploadErrors.Count > 0) return Results.BadRequest(new { errors = uploadErrors });

    var validation = DeckValidator.Validate(upload.Markdown);
    if (!validation.Ok) return Results.BadRequest(new { errors = validation.Errors, warnings = validation.Warnings });
    if (!string.Equals(validation.Id, id, StringComparison.Ordinal))
        return Results.BadRequest(new { error = "El id del frontmatter no coincide con la ruta." });
    var meta = await store.SaveAsync(upload, validation, cancellationToken);
    return Results.Ok(meta);
}).RequireAuthorization();

app.MapDelete("/api/decks/{id}", async (string id, DeckStore store, CancellationToken cancellationToken) =>
{
    var deleted = await store.DeleteAsync(id, cancellationToken);
    return deleted ? Results.Ok(new { ok = true }) : Results.NotFound();
}).RequireAuthorization();

app.MapPost("/api/decks/{id}/touch", async (string id, DeckStore store, CancellationToken cancellationToken) =>
{
    var meta = await store.TouchAsync(id, cancellationToken);
    return meta is null ? Results.NotFound() : Results.Ok(meta);
}).RequireAuthorization();

app.MapGet("/api/decks/{id}/file", async (string id, DeckStore store, CancellationToken cancellationToken) =>
{
    var deck = await store.GetAsync(id, cancellationToken);
    if (deck is null) return Results.NotFound();
    var bytes = Encoding.UTF8.GetBytes(deck.Value.Markdown);
    return Results.File(bytes, "text/markdown; charset=utf-8", deck.Value.Meta.FileName);
}).RequireAuthorization();

app.MapGet("/api/decks/{id}/assets/{**key}", async (string id, string key, HttpContext context, DeckStore store, CancellationToken cancellationToken) =>
{
    var asset = await store.GetAssetAsync(id, key, cancellationToken);
    if (asset is null) return Results.NotFound();
    // Aísla SVG y otros formatos de imagen de cualquier script si se abren directamente.
    context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'";
    context.Response.Headers["Content-Disposition"] = "inline";
    return Results.Stream(asset.Content, asset.ContentType, enableRangeProcessing: true);
}).RequireAuthorization();

app.MapDelete("/api/decks/{id}/assets/{**key}", async (string id, string key, DeckStore store, CancellationToken cancellationToken) =>
{
    var deleted = await store.DeleteAssetAsync(id, key, cancellationToken);
    return deleted ? Results.Ok(new { ok = true }) : Results.NotFound();
}).RequireAuthorization();

app.MapGet("/api/progress/{id}", async (string id, DeckStore store, CancellationToken cancellationToken) =>
{
    var progress = await store.GetProgressAsync(id, cancellationToken);
    if (progress is null) return Results.NoContent();
    return Results.Stream(progress.Content, "application/json", enableRangeProcessing: true);
}).RequireAuthorization();

app.MapPut("/api/progress/{id}", async (string id, HttpRequest request, DeckStore store, CancellationToken cancellationToken) =>
{
    if (request.ContentLength > 256 * 1024)
        return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
    using var reader = new StreamReader(request.Body);
    var json = await reader.ReadToEndAsync(cancellationToken);
    if (Encoding.UTF8.GetByteCount(json) > 256 * 1024)
        return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
    try { JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 32 }); }
    catch { return Results.BadRequest(new { error = "JSON inválido." }); }
    await store.PutProgressAsync(id, json, cancellationToken);
    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Las rutas /api desconocidas no deben caer en el index.html de la SPA.
app.Map("/api/{**rest}", () => Results.NotFound());

var indexPath = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
if (File.Exists(indexPath)) app.MapFallbackToFile("index.html");

app.Run();

public sealed record LoginRequest(string? Username, string? Password);
public sealed record DeckImportRequest(List<DeckUpload> Files);

public partial class Program;
