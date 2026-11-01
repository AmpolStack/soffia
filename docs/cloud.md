# Despliegue en la nube

soffia puede funcionar de dos formas:

- **Local (por defecto):** todo vive en el navegador. No necesita servidor. También pide login en `/login`; por defecto `soffia` / `soffia`, configurable con `VITE_LOCAL_AUTH_*`.
- **Nube privada:** frontend en Cloudflare Pages, API .NET 9 en Render Free y archivos en Cloudflare R2.

El modo local sigue siendo el comportamiento por defecto de `npm run build` y del archivo único `dist-single/soffia.html`.

## Arquitectura

```text
Navegador
   │  https://soffia.pages.dev
   ▼
Cloudflare Pages (estático, BrowserRouter)
   │  /api/* → Functions proxy same-origin
   ▼
Render Free (contenedor .NET 9)
   │  S3 API
   ▼
Cloudflare R2 (Markdown, imágenes, metadatos y progreso)
```

Cloudflare Workers **no ejecuta .NET 9**. Por eso Cloudflare aloja el frontend y el proxy, mientras Render ejecuta el contenedor .NET. La cookie de sesión queda en el dominio de Pages porque el proxy es same-origin.

### Por qué R2 y no Postgres

Para un único usuario, R2 guarda el Markdown, las imágenes locales, un índice `index.json` y el progreso. Es suficiente, entra en el plan gratuito de R2 y evita mantener otra base de datos. Si más adelante hay varios usuarios o escrituras concurrentes, se puede sustituir `DeckStore` por PostgreSQL sin cambiar el contrato HTTP.

## 1. Crear el bucket R2

1. En Cloudflare Dashboard, abre **R2** y crea un bucket, por ejemplo `soffia`.
2. Crea un token de API con permiso **Object Read & Write** solo para ese bucket.
3. Guarda:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET=soffia`

El bucket puede ser privado: la app sirve las imágenes a través de la API autenticada, no con URLs públicas.

## 2. Desplegar la API en Render

### Opción A: Blueprint

El repositorio incluye [`render.yaml`](../render.yaml). En Render:

1. **New → Blueprint** y conecta el repositorio.
2. Render crea el servicio `soffia-api` con el Dockerfile `server/Dockerfile`.
3. Rellena las variables marcadas como secretas:
   - `APP_AUTHENTICATION_NAME`
   - `APP_AUTHENTICATION_USERNAME`
   - `APP_AUTHENTICATION_PASSWORD`
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET`
4. `APP_SESSION_SECRET` se genera automáticamente. Si lo defines a mano, usa al menos 32 bytes aleatorios.
5. Espera al health check `/api/health`.

### Opción B: manual

- **New → Web Service → Docker**
- Dockerfile: `server/Dockerfile`
- Contexto: raíz del repositorio
- Plan: Free
- Health check: `/api/health`

Variables mínimas:

| Variable | Valor |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `TRUST_PROXY` | `true` |
| `APP_AUTHENTICATION_NAME` | Nombre visible, máximo 20 caracteres |
| `APP_AUTHENTICATION_USERNAME` | Usuario, máximo 15 caracteres |
| `APP_AUTHENTICATION_PASSWORD` | Contraseña, máximo 70 bytes UTF-8 |
| `APP_SESSION_SECRET` | Secreto aleatorio de 32+ bytes |
| `APP_COOKIE_SECURE` | `true` |
| `APP_COOKIE_SAMESITE` | `lax` |
| `R2_ACCOUNT_ID` | ID de la cuenta Cloudflare |
| `R2_ACCESS_KEY_ID` | Access key del token R2 |
| `R2_SECRET_ACCESS_KEY` | Secret del token R2 |
| `R2_BUCKET` | Nombre del bucket |

Sin R2, la API usa `DATA_DIR` (por defecto `/app/data`). En Render Free el disco es efímero: los datos se pierden al reiniciar. Usa R2 en producción.

El contenedor escucha en `$PORT` (Render usa 10000 por defecto). En local, `docker run -p 8080:8080` usa 8080.

## 3. Desplegar el frontend en Cloudflare Pages

1. En Cloudflare Dashboard, **Workers & Pages → Create → Pages → Connect to Git**.
2. Configura:
   - **Build command:** `npm run build:cloud`
   - **Build output directory:** `dist-cloud`
   - **Node version:** 20 o superior
3. Añade la variable de entorno:
   - `SOFFIA_API_ORIGIN=https://tu-servicio.onrender.com`
4. Despliega.

El repositorio incluye [`.env.cloud`](../.env.cloud) con `VITE_STORAGE_MODE=cloud`; Vite lo carga con `--mode cloud`. Si llamas a la API directamente sin el proxy, define además `VITE_API_BASE_URL=https://tu-servicio.onrender.com/api`.

El archivo [`functions/api/[[path]].js`](../functions/api) hace de proxy:

- reenvía `/api/*` a `SOFFIA_API_ORIGIN`;
- conserva el cuerpo y las cabeceras;
- reescribe la cookie para que pertenezca a Pages;
- añade `X-Forwarded-*` para que la API conozca el origen real.

No necesitas configurar CORS si usas este proxy.

El archivo [`public/_headers`](../public/_headers) añade HSTS, CSP y cabeceras de aislamiento a los recursos estáticos de Pages. Las respuestas de `/api/*` las genera la API y llevan sus propias cabeceras.

### Alternativa: frontend y API en el mismo contenedor

El Dockerfile copia `dist-cloud` a `wwwroot`, así que también puedes desplegar solo el contenedor en Render y abrir la app en la URL de Render. En ese caso no uses el proxy de Pages.

## 4. Comprobar el despliegue

```bash
curl https://tu-servicio.onrender.com/api/health
```

Debe devolver `{"ok":true,"service":"soffia"}`.

En la app:

1. Abre `https://tu-proyecto.pages.dev/login`.
2. Entra con el usuario y la contraseña configurados.
3. Importa `examples/sistema-solar/seminario.md`.
4. Comprueba que el deck aparece en la biblioteca y que el archivo se llama `soffia-sistema-solar-xxxx.md`.
5. Cierra sesión desde **Ajustes**.

## 5. Desarrollo local con API

```bash
# Terminal 1: API
$env:APP_AUTHENTICATION_NAME="Soffia"
$env:APP_AUTHENTICATION_USERNAME="soffia"
$env:APP_AUTHENTICATION_PASSWORD="Soffia-dev-password"
$env:APP_SESSION_SECRET="0123456789abcdef0123456789abcdef"
$env:ASPNETCORE_ENVIRONMENT="Development"
$env:DATA_DIR="$env:TEMP\soffia-api-data"
dotnet run --project server/Soffia.Api --no-launch-profile

# Terminal 2: frontend en modo nube
npm run dev:cloud
```

Vite redirige `/api` a `http://127.0.0.1:5000`. Puedes cambiarlo con `SOFFIA_DEV_API`.

## 6. Pruebas

```bash
# Frontend
npm test
npm run typecheck
npm run build
npm run build:cloud
npm run build:single

# MCP
npm run test:mcp

# API .NET (requiere dotnet 9)
dotnet test server/Soffia.sln
npm run test:api
```

`npm run test:api` arranca la API en un puerto temporal, usa un `DATA_DIR` temporal y comprueba login, sesión, importación por lotes, nombres RFC, assets, progreso, descarga, límites y logout. Si el `dotnet` global no incluye el SDK 9, define `DOTNET_BIN` con la ruta del SDK 9; en Windows, el script busca `~/.dotnet9/dotnet.exe`.

## 7. Seguridad

- **Un solo usuario.** No hay registro ni creación de cuentas. Las credenciales vienen de variables de entorno.
- **Cookies HttpOnly.** La sesión es un JWT firmado con `APP_SESSION_SECRET`, guardado en una cookie `HttpOnly`, `Secure` y `SameSite=Lax` (configurable).
- **CSRF.** Las peticiones mutantes exigen `X-Soffia-Request: 1`; el proxy y CORS están restringidos.
- **Fuerza bruta.** `/api/auth/login` tiene un límite de 5 intentos por minuto para toda la instancia y responde `429`.
- **Comparación en tiempo constante.** Usuario y contraseña se comparan con SHA-256 y `FixedTimeEquals`.
- **Límites de carga.** 2 MB por Markdown, 10 MB por imagen, 20 MB de imágenes por deck, 20 imágenes por deck, 50 archivos por lote, 30 MB por petición y 256 KB por progreso.
- **Rutas seguras.** Los assets se normalizan y no pueden salir de `decks/<id>/assets/`.
- **Cabeceras.** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store` en `/api`, HSTS en producción y CSP aislada para SVG.
- **Sin secretos en el frontend.** Solo `VITE_STORAGE_MODE` y, opcionalmente, `VITE_API_BASE_URL` llegan al navegador.

## 8. Variables de entorno de la API

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `APP_AUTHENTICATION_NAME` | No | Nombre visible, máximo 20 caracteres. Por defecto, el usuario. |
| `APP_AUTHENTICATION_USERNAME` | Sí | Usuario, máximo 15 caracteres y 70 bytes. |
| `APP_AUTHENTICATION_PASSWORD` | Sí | Contraseña, máximo 70 bytes. |
| `APP_SESSION_SECRET` | Sí | Firma de sesión, mínimo 32 bytes. |
| `APP_COOKIE_SAMESITE` | No | `lax` (defecto), `strict` o `none`. |
| `APP_COOKIE_SECURE` | No | `true` en producción. |
| `TRUST_PROXY` | No | `true` detrás de Render/Pages. |
| `CORS_ORIGINS` | No | Orígenes separados por comas si llamas a la API directamente. |
| `R2_ACCOUNT_ID` | No | Cuenta Cloudflare R2. |
| `R2_ACCESS_KEY_ID` | No | Token R2. |
| `R2_SECRET_ACCESS_KEY` | No | Token R2. |
| `R2_BUCKET` | No | Bucket R2. |
| `DATA_DIR` | No | Almacenamiento local si no hay R2. |

## 9. Problemas frecuentes

**La app carga pero `/api/health` da 502 en Pages.**
Revisa `SOFFIA_API_ORIGIN` y que Render esté despierto. El plan Free se suspende por inactividad; la primera petición puede tardar y el proxy puede devolver 502/524 mientras arranca. Reintenta; si ocurre a menudo, usa un plan always-on o un ping externo.

**Login correcto pero la sesión no persiste.**
Comprueba `APP_COOKIE_SECURE=true` y que estás en HTTPS. Si llamas a la API directamente desde otro dominio, configura `APP_COOKIE_SAMESITE=none`, `CORS_ORIGINS` y usa HTTPS.

**Los decks desaparecen al reiniciar Render.**
Estás usando disco local sin R2. Configura las cuatro variables de R2.

**Al importar aparece `STREAMING-AWS4-HMAC-SHA256-PAYLOAD not implemented`.**
La imagen desplegada usa un cliente R2 antiguo. Actualiza el repositorio y vuelve a desplegar. El cliente actual desactiva la firma SigV4 en streaming y el checksum por defecto, que R2 no implementa. Si el error continúa, revisa que el token R2 tenga `Object Read & Write` y que el bucket sea el correcto.

**`No se pudo leer el YAML` o `found invalid mapping`.**
Un valor del frontmatter contiene dos puntos seguidos de espacio sin comillas. Por ejemplo, `description: Tema: detalles` debe escribirse como `description: "Tema: detalles"`. Lo mismo aplica a títulos, subtítulos y descripciones con `:`.

**Un SVG no se muestra.**
La API sirve los assets con `Content-Security-Policy: default-src 'none'` para evitar scripts. Si el SVG depende de recursos externos, no se cargarán. Es intencionado.

**El archivo se llama distinto de lo esperado.**
El nombre se genera en el servidor como `soffia-<slug>-<4 hex>.md`. El slug sale del nombre original; el sufijo sale de un UUID v4 y se comprueba que no colisione.
