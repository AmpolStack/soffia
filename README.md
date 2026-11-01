<p align="center">
  <img src="brand/soffia-banner.svg" alt="soffia — estudia desde tu Markdown" width="100%" />
</p>

# soffia

**Markdown que se convierte en una sesión de estudio.**

soffia convierte apuntes, seminarios y guías en Markdown en una experiencia de lectura y repaso: índice navegable, secciones plegables, quizzes, tarjetas con repaso espaciado, preguntas abiertas, imágenes ampliables y estadísticas de progreso. Funciona **local-first** y también puede desplegarse como una **nube privada de un solo usuario**.

## Qué resuelve

Estudiar desde apuntes suele terminar en PDFs largos, pestañas abiertas y repaso pasivo. soffia reúne el contenido y la práctica en el mismo lugar:

- lees con estructura y sin ruido;
- compruebas lo aprendido con quizzes y preguntas;
- repasas con tarjetas y repaso espaciado;
- ves qué secciones has leído y cómo va tu progreso;
- conservas el control del archivo original y de tus imágenes.

No hay cuentas públicas, registro ni telemetría. El modo local no necesita servidor. El modo nube es opcional y privado.

## Qué hace

- **Importa Markdown** con frontmatter YAML, bloques `:::` o Markdown estándar. Puedes arrastrar archivos, importar una carpeta con imágenes, pegar texto o descargar desde una URL.
- **Lee con contexto.** Header fijo, título del deck siempre visible, índice lateral, progreso de lectura, búsqueda con `/` y marca de agua vertical con el título.
- **Pliega secciones y preguntas.** H2/H3 funcionan como acordeones y hay botones **Expandir todo / Colapsar todo** en el índice y en las preguntas.
- **Marca y desmarca secciones como leídas.** El progreso y el índice se actualizan al instante.
- **Practica.** Quizzes con corrección y explicación, flashcards con SRS, preguntas abiertas y un dashboard de estudio con métricas y sesiones recientes.
- **Corrige con color.** Las respuestas correctas se muestran en verde y las incorrectas en rojo.
- **Organiza.** La biblioteca reúne todos los tags y permite filtrarlos con un selector multi-etiqueta y lógica OR.
- **Ajusta tablas.** Las columnas y filas se redimensionan con ratón o teclado. Los encabezados se tienen en cuenta al calcular el ancho mínimo. El diseño se guarda por deck y el botón de restablecer queda fuera de la tabla.
- **Mueve el índice.** En escritorio puedes arrastrar el tirador superior del índice para acercarlo o alejarlo del borde derecho. La posición se guarda en el navegador.
- **Edita imágenes.** Desde el visor puedes cambiar una imagen por una URL o por un archivo nuevo. Si la anterior era local, se elimina.
- **Imprime desde el Markdown.** La impresión incluye secciones, imágenes, tablas, respuestas y tarjetas, con un tema claro para papel.
- **Entrega a agentes.** La skill y el servidor MCP permiten generar y validar decks. La app también publica `/formato` y `/llms.txt`.

## Arquitectura

### Local-first

```text
Navegador
├── React 19 + TypeScript + Vite
├── IndexedDB / localStorage
│   ├── decks y assets
│   ├── progreso, ajustes y diseño de tablas
│   └── sesión local
└── Markdown + imágenes locales o https://
```

No hay backend. El build local usa `HashRouter` para funcionar desde un hosting estático o desde `file://`.

### Nube privada

```text
Navegador
   │  https://tu-proyecto.pages.dev
   ▼
Cloudflare Pages
   │  estático + BrowserRouter
   │  /api/* → Pages Function same-origin
   ▼
Render Free · contenedor .NET 9
   │  autenticación, API, validación y descarga
   ▼
Cloudflare R2
   └── Markdown, imágenes, índice y progreso
```

Cloudflare Workers no ejecuta .NET 9. Por eso Cloudflare aloja el frontend y el proxy, y Render ejecuta el contenedor .NET. La cookie de sesión es `HttpOnly`, `Secure` y `SameSite=Lax`, y el proxy hace que pertenezca al dominio de Pages.

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript | Lector, estudio, biblioteca, ajustes |
| Almacenamiento local | IndexedDB y localStorage | Decks, assets, progreso, preferencias |
| API | .NET 9, ASP.NET Core | Login único, validación, importación, assets, progreso |
| Objetos | Cloudflare R2 | Archivos y metadatos compartidos entre dispositivos |
| Hosting | Cloudflare Pages + Render Free | Frontend, proxy y API |

## Requisitos

- Node.js 18 o superior y npm.
- .NET 9 solo si vas a ejecutar la API o sus tests.
- Una cuenta de Cloudflare y otra de Render solo para el despliegue en nube.

## Replicarlo en local

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

La primera vez, si la biblioteca está vacía, se carga el deck de ejemplo **Impétigo**. También puedes cargarlo con **Cargar ejemplo**.

### Login local

El modo local pasa por `/login`. Credenciales por defecto:

- usuario: `soffia`
- contraseña: `soffia`
- nombre visible: `Soffia`

Copia `.env.example` a `.env.local` y cambia `VITE_LOCAL_AUTH_NAME`, `VITE_LOCAL_AUTH_USERNAME` y `VITE_LOCAL_AUTH_PASSWORD` antes de compilar. La sesión dura 12 horas y se guarda en el navegador. Las credenciales van dentro del build: son una pantalla de acceso local, no seguridad de servidor. Para seguridad real, usa el modo nube con la API .NET.

### Builds

```bash
npm run build          # dist/            estático local, HashRouter
npm run build:cloud    # dist-cloud/      Cloudflare Pages, BrowserRouter
npm run build:single   # dist-single/soffia.html
```

El archivo único incluye JavaScript, CSS y fuentes. Puedes abrirlo desde `file://`; algunas funciones que dependen de red, como imágenes remotas o descargas de URL, siguen necesitando conexión. El archivo único incluye las credenciales locales del build.

### API local opcional

```bash
# Terminal 1: API .NET 9
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

## Formato para agentes

La app publica la guía en dos rutas públicas, sin necesidad de sesión:

- **`/formato`**: guía renderizada con los estilos de soffia, pensada para humanos.
- **`/llms.txt`**: texto plano con la guía portable y la especificación completa, pensado para `webfetch` y clientes MCP.

El archivo `/llms.txt` se regenera en cada build y al arrancar el servidor de desarrollo desde:

- [`mcp/quick-reference.md`](mcp/quick-reference.md)
- [`skill/soffia/reference/format.md`](skill/soffia/reference/format.md)

La skill y el servidor MCP están en:

- [`skill/soffia/SKILL.md`](skill/soffia/SKILL.md)
- [`mcp/README.md`](mcp/README.md)

Para un modelo que use herramientas web, pídele que lea `https://tu-dominio/llms.txt`. Para una persona, abre `/formato`.

## Uso

### Importar

En la biblioteca puedes:

- arrastrar un `.md`, `.markdown` o `.txt`, o una carpeta completa;
- usar **Abrir Markdown**;
- usar **Importar carpeta** para conservar las rutas de las imágenes;
- pegar Markdown;
- importar desde una URL `http(s)`.

Una importación por lotes guarda los archivos válidos y muestra los errores de los inválidos sin bloquear el resto.

### Etiquetas

La biblioteca reúne todos los tags. El selector **Etiqueta** permite añadir varias etiquetas; el filtro usa lógica OR. Las etiquetas activas aparecen como chips que puedes quitar, y **Limpiar** borra el filtro. El estado se guarda en la URL (`?tags=...`).

### Tablas

- Arrastra el borde derecho de una cabecera para cambiar el ancho de la columna.
- Arrastra el borde inferior de la primera celda para cambiar el alto mínimo de la fila.
- Con foco en un tirador, usa `←`/`→` o `↑`/`↓`.
- Pulsa **Restablecer tabla** para borrar el diseño guardado. El botón queda fuera del marco de la tabla.

El ancho mínimo de cada columna tiene en cuenta el encabezado, no solo las celdas. Los encabezados pueden partirse en varias líneas si hace falta.

### Imágenes

- Las imágenes `https://` se enlazan, no se descargan, y usan `referrerpolicy="no-referrer"`.
- Las imágenes locales se guardan con el deck.
- Pulsa una imagen para abrir el visor. Desde el lápiz puedes cambiar la URL o subir un archivo; la imagen anterior se elimina si era local.
- No se generan imágenes nuevas.

### Índice

En escritorio, arrastra el tirador superior del índice para moverlo horizontalmente. También puedes enfocarlo y usar `←`/`→`. La posición se guarda en `localStorage`. En móvil el índice es un panel lateral.

### Imprimir

El botón de impresión abre todas las secciones y genera una vista limpia desde el Markdown, con imágenes, tablas, respuestas de preguntas y tarjetas. Puedes guardar como PDF desde el diálogo del navegador.

## Subirlo a la nube

La guía completa está en [`docs/cloud.md`](docs/cloud.md). Resumen:

1. **Cloudflare R2**
   - Crea un bucket, por ejemplo `soffia`.
   - Crea un token con permiso **Object Read & Write**.
   - Guarda `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET`.

2. **Render Free**
   - Usa [`render.yaml`](render.yaml) o crea un Web Service con el Dockerfile [`server/Dockerfile`](server/Dockerfile).
   - Plan Free, health check `/api/health`.
   - Configura `APP_AUTHENTICATION_NAME`, `APP_AUTHENTICATION_USERNAME`, `APP_AUTHENTICATION_PASSWORD`, `APP_SESSION_SECRET` y las variables de R2.
   - `APP_SESSION_SECRET` debe tener al menos 32 bytes aleatorios.

3. **Cloudflare Pages**
   - Build command: `npm run build:cloud`
   - Output directory: `dist-cloud`
   - Variable: `SOFFIA_API_ORIGIN=https://tu-servicio.onrender.com`
   - El repositorio incluye [`.env.cloud`](.env.cloud) con `VITE_STORAGE_MODE=cloud`.
   - [`functions/api/[[path]].js`](functions/api) hace de proxy same-origin y conserva la cookie en el dominio de Pages.

4. **Comprobar**
   - Abre `/login` y entra con el usuario configurado.
   - Importa `examples/sistema-solar/seminario.md`.
   - Comprueba el deck, los tags, las imágenes, el progreso y el cierre de sesión desde **Ajustes**.

Sin R2, Render Free usa un disco efímero y los datos se pierden al reiniciar. El plan Free también se suspende por inactividad; la primera petición puede tardar.

## Tests

```bash
# Frontend
npm test
npm run typecheck
npm run build
npm run build:cloud
npm run build:single

# Validador de formato
npm run validate:all

# MCP
npm run test:mcp

# API .NET (requiere .NET 9)
dotnet test server/Soffia.sln
npm run test:api
```

`npm run test:api` arranca la API con un `DATA_DIR` temporal y comprueba login, sesión, CSRF, límites, importación por lotes, nombres RFC, assets, borrado de assets, progreso, descarga y logout.

El flujo [`ci.yml`](.github/workflows/ci.yml) ejecuta en GitHub Actions el typecheck, los tests de frontend, los tres builds, la validación de ejemplos, los tests de MCP, los tests de .NET y el test de extremo a extremo de la API.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor local con IndexedDB. |
| `npm run dev:cloud` | Vite en modo nube con proxy a la API. |
| `npm run build` | Build estático local en `dist/`. |
| `npm run build:cloud` | Build para Cloudflare Pages en `dist-cloud/`. |
| `npm run build:single` | Archivo único en `dist-single/soffia.html`. |
| `npm run build:llms` | Regenera `public/llms.txt`. |
| `npm run preview` | Sirve el build estático. |
| `npm run typecheck` | TypeScript sin emitir. |
| `npm test` | Tests de frontend con Vitest. |
| `npm run validate` / `validate:all` | Valida uno o todos los ejemplos. |
| `npm run test:mcp` | Prueba el servidor MCP con un cliente real. |
| `npm run test:api` | Prueba la API de extremo a extremo. |
| `npm run mcp` | Arranca el MCP por stdio. |
| `npm run install:skill` | Instala la skill en OpenCode global. |
| `npm run install:skill:project` | Instala la skill en `.opencode/skills`. |

## Estructura

```text
.
├── .github/workflows/ci.yml
├── brand/
│   ├── soffia-mark.svg
│   └── soffia-banner.svg
├── docs/
│   └── cloud.md
├── examples/
│   ├── impetigo/
│   └── sistema-solar/
├── functions/api/[[path]].js
├── mcp/
│   ├── soffia-server.mjs
│   ├── quick-reference.md
│   └── schema.json
├── public/
│   ├── _headers
│   ├── _redirects
│   ├── favicon.svg
│   └── llms.txt (generado)
├── scripts/
│   ├── build-llms.mjs
│   ├── test-api.mjs
│   └── test-mcp.mjs
├── server/
│   ├── Soffia.Api/
│   ├── Soffia.Core/
│   ├── Soffia.Tests/
│   └── Dockerfile
├── skill/soffia/
│   ├── SKILL.md
│   ├── reference/format.md
│   └── scripts/validate.mjs
├── src/
│   ├── components/
│   ├── contexts/
│   ├── lib/
│   └── styles/
├── .env.cloud
├── .env.example
├── LICENSE
├── render.yaml
└── vite.config.ts
```

## Seguridad y privacidad

- En local no hay backend, registro de cuentas ni telemetría. La sesión local se guarda en el navegador durante 12 horas.
- En local, las credenciales viajan dentro del build: son una pantalla de privacidad, no seguridad de servidor.
- En nube hay un único usuario, sin registro, con cookie HttpOnly, CSRF por cabecera, límite de intentos, comparación en tiempo constante y límites de carga.
- `markdown-it` usa `html: false`: el HTML crudo no se interpreta.
- Las imágenes remotas usan `referrerpolicy="no-referrer"`, `loading="lazy"` y fallback visible.
- Los enlaces externos usan `rel="noopener noreferrer"`.
- La CSP permite imágenes `https:`, `data:` y `blob:` y bloquea objetos, formularios y bases externas.
- Los assets de la API se sirven con CSP aislada para SVG y no pueden salir de su carpeta.

## Limitaciones

- El modo local no sincroniza entre dispositivos.
- El progreso local vive en el navegador y desaparece si borras sus datos.
- Render Free se suspende por inactividad; la primera petición puede tardar.
- Sin R2, el disco de Render Free es efímero.
- Las imágenes remotas pueden fallar por hotlink, CORS o caída del origen; la app muestra un fallback.
- La impresión usa el diálogo del navegador; no hay un generador de PDF propio.
- El archivo único incluye fuentes y pesa alrededor de 1 MB.

## Licencia

MIT. Consulta [`LICENSE`](LICENSE).

## Créditos

- Tipografías **Inter** y **Red Rose**, bajo SIL Open Font License.
- Iconos **Lucide**, bajo ISC License.
- Markdown renderizado con **markdown-it**.
- Ejemplos clínicos y astronómicos con sus fuentes citadas en cada deck.
