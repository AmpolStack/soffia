# soffia MCP

Servidor MCP local (stdio) que enseña a cualquier modelo a producir decks compatibles con soffia. No necesita backend ni claves.

La app publica la misma guía en `/formato` (humana, con estilos) y `/llms.txt` (texto plano para `webfetch`).

## Qué expone

### Herramientas

| Herramienta | Para qué sirve |
| --- | --- |
| `soffia_get_format` | Devuelve la guía portable del formato. Con `full: true` incluye la especificación completa. |
| `soffia_get_schema` | Devuelve el esquema JSON de frontmatter, bloques, imágenes y validación. |
| `soffia_scaffold_deck` | Genera un esqueleto Markdown válido a partir de título, tags, secciones y audiencia. |
| `soffia_validate_deck` | Ejecuta el validador local y devuelve errores, avisos, estadísticas y resumen. |
| `soffia_validate_decks` | Valida varios Markdown a la vez y devuelve un informe por archivo. |
| `soffia_save_decks` | Valida y guarda uno o varios decks. Pregunta el destino si no se indica, guarda los válidos aunque otros fallen y no sobrescribe. |
| `soffia_get_example` | Devuelve un ejemplo `web`, `clinical` o `minimal`. |

### Recursos

- `soffia://quick-reference` — guía corta para modelos.
- `soffia://format` — especificación completa.
- `soffia://skill` — flujo de trabajo y reglas de calidad.
- `soffia://schema` — esquema JSON.
- `soffia://example/web` — deck con imágenes web reales.
- `soffia://example/clinical` — deck clínico de Impétigo.

### Prompt

`crear_deck_soffia` recibe `topic`, `audience`, `language`, `minutes` e `images` (`web`, `local`, `none`) y devuelve un prompt de trabajo que obliga al modelo a:

1. consultar el formato;
2. usar el scaffold si lo necesita;
3. escribir contenido con H2/H3, quizzes, tarjetas, Q&A y referencias;
4. usar imágenes web verificables o locales, sin generar imágenes;
5. validar hasta 0 errores;
6. preguntar dónde guardar y llamar a `soffia_save_decks` con todos los archivos.

## Guardar decks

`soffia_save_decks` acepta un lote:

```json
{
  "decks": [
    { "fileName": "sistema-solar.md", "markdown": "---\n..." },
    { "fileName": "impetigo.md", "markdown": "---\n..." }
  ],
  "destination": "downloads"
}
```

Destinos:

| `destination` | Efecto |
| --- | --- |
| `downloads` (defecto) | `~/Downloads/soffia` |
| `cwd` | Directorio de trabajo del proceso MCP |
| `custom` | Usa `customPath`; admite rutas absolutas o `~/…` |

Si no se indica `destination`, el servidor intenta preguntar al cliente mediante elicitación. Si el cliente no la soporta, usa `Downloads/soffia` sin bloquear. También puedes pasar `destination` y `customPath` directamente.

Reglas:

- los archivos inválidos se reportan y **no** se escriben;
- los válidos se guardan aunque otros fallen;
- nunca se sobrescribe un archivo existente;
- el nombre final es `soffia-<slug>-<4 hex>.md`;
- las imágenes no son obligatorias: si no hay, el deck se guarda y se sugiere añadir URLs `https://` con crédito.

## Ejecutar

```bash
npm install
npm run mcp
```

El servidor habla MCP por stdio. No imprimas logs en stdout; los mensajes van a stderr.

Prueba de protocolo:

```bash
npm run test:mcp
```

## Configurar en OpenCode

Añade a tu `opencode.json` (global o del proyecto):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "soffia": {
      "type": "local",
      "command": ["node", "C:/Users/htrsa/Desktop/diataxis/mcp/soffia-server.mjs"],
      "enabled": true
    }
  }
}
```

Si el workspace ya es la raíz de este proyecto, puedes usar una ruta relativa:

```json
"command": ["node", "mcp/soffia-server.mjs"]
```

Después reinicia OpenCode y pide algo como:

> Usa la herramienta soffia para crear un deck sobre cambio climático, con imágenes web y referencias verificables.

## Configurar en Claude Desktop

En `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "soffia": {
      "command": "node",
      "args": ["C:/Users/htrsa/Desktop/diataxis/mcp/soffia-server.mjs"]
    }
  }
}
```

## Configurar en Cursor u otro cliente MCP

Configuración genérica:

```json
{
  "mcpServers": {
    "soffia": {
      "command": "node",
      "args": ["/ruta/absoluta/a/diataxis/mcp/soffia-server.mjs"]
    }
  }
}
```

## Si el cliente no soporta MCP

La misma estrategia funciona sin MCP:

1. Pega `mcp/quick-reference.md` como instrucciones del sistema.
2. Pega `mcp/schema.json` si el modelo acepta esquemas.
3. Pide que use `skill/soffia/reference/format.md` como especificación.
4. Valida el resultado con:

```bash
node skill/soffia/scripts/validate.mjs ruta/al/deck.md
```

## Estrategia de contenido

El MCP no depende de un tipo de texto concreto. El modelo debe:

- extraer ideas principales y convertirlas en H2;
- usar H3 solo para subtemas reales;
- explicar antes de enumerar;
- convertir lo evaluable en quizzes, lo memorizable en flashcards y las dudas en Q&A;
- citar fuentes;
- usar imágenes web directas con crédito, o imágenes locales aportadas por el usuario;
- validar y corregir.

## Seguridad

- El servidor corre localmente y no expone puertos.
- El validador trabaja en un directorio temporal y lo elimina al terminar.
- La validación por MCP no comprueba archivos locales (solo recibe texto). Para comprobar una carpeta con imágenes, usa el CLI con la ruta completa.
- `soffia_save_decks` solo escribe Markdown; no descarga imágenes ni ejecuta HTML.
- No sobrescribe archivos: usa `wx` y regenera el sufijo si hay colisión.
- Las URLs de imagen deben ser `https://`; el formato rechaza esquemas peligrosos.
- La herramienta de validación tiene timeout y límite de salida.
