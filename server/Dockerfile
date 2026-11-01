# Etapa 1: frontend en modo nube (BrowserRouter + /api same-origin).
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:cloud

# Etapa 2: API .NET 9.
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY server/Soffia.sln server/
COPY server/Soffia.Api/Soffia.Api.csproj server/Soffia.Api/
COPY server/Soffia.Core/Soffia.Core.csproj server/Soffia.Core/
COPY server/Soffia.Tests/Soffia.Tests.csproj server/Soffia.Tests/
RUN dotnet restore server/Soffia.sln
COPY server/ server/
RUN dotnet publish server/Soffia.Api/Soffia.Api.csproj -c Release -o /app/publish --no-restore

# Etapa 3: runtime.
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
ENV DATA_DIR=/app/data
EXPOSE 8080
RUN mkdir -p /app/data && chown -R $APP_UID /app
COPY --from=build /app/publish ./
COPY --from=web /app/dist-cloud ./wwwroot
USER $APP_UID
# Render define PORT (10000 por defecto); en local se usa 8080.
CMD ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} exec dotnet Soffia.Api.dll"]
