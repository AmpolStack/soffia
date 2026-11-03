#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = join(root, 'skill', 'soffia');
const validator = join(skillDir, 'scripts', 'validate.mjs');
const quickReference = join(root, 'mcp', 'quick-reference.md');
const reference = join(skillDir, 'reference', 'format.md');
const schemaFile = join(root, 'mcp', 'schema.json');
const skillFile = join(skillDir, 'SKILL.md');
const examples = {
  web: join(root, 'examples', 'sistema-solar', 'seminario.md'),
  clinical: join(root, 'examples', 'impetigo', 'seminario.md'),
};

const MINIMAL_EXAMPLE = `---
id: ejemplo-minimo
title: Ejemplo mínimo
subtitle: Un deck pequeño pero completo
description: Ejemplo de referencia con frontmatter, secciones, práctica y una fuente.
tags: [Ejemplo, Formato]
author: soffia
language: es
estimatedMinutes: 5
---

# Ejemplo mínimo

Este deck muestra la estructura mínima que conviene entregar.

:::keypoints
- Un deck empieza por un frontmatter válido.
- Las secciones principales son H2.
- La práctica se escribe con bloques \`:::\`.
:::

## Concepto

Una idea se explica primero con palabras y después se comprueba con una pregunta.

:::quiz{id=q-concepto}
**Pregunta:** ¿Qué estructura identifica una sección principal?

- [ ] Un H1.
- [x] Un H2.
- [ ] Un bloque \`:::\`.

> **Explicación:** Los H2 crean las secciones que aparecen en el índice y en los acordeones.
:::

## Repaso

:::flashcards{id=fc-concepto}
### ¿Qué crea un H2?
Una sección principal con su propia entrada en el índice.

---

### ¿Qué crea un H3?
Una subsección dentro de la sección H2 anterior.
:::

## Referencias

:::references
1. [Documentación de Markdown](https://commonmark.org/) — Referencia del lenguaje base.
:::
`;

function slugify(value) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'tema'
  );
}

function yaml(value) {
  return JSON.stringify(String(value));
}

function shortId() {
  return randomUUID().replace(/-/g, '').slice(0, 4);
}

function frontmatterTitle(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match) return '';
  const title = /^title:\s*(.+)$/m.exec(match[1]);
  if (!title) return '';
  return title[1].trim().replace(/^["']|["']$/g, '');
}

function fileBaseName(entry, index) {
  const source = entry.fileName?.trim() || frontmatterTitle(entry.markdown) || `deck-${index + 1}`;
  const withoutExtension = source.replace(/\.(md|markdown|txt)$/i, '');
  return slugify(withoutExtension).slice(0, 80) || `deck-${index + 1}`;
}

function expandPath(value) {
  const trimmed = value.trim();
  if (trimmed === '~') return homedir();
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return join(homedir(), trimmed.slice(2));
  }
  return isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed);
}

function destinationFrom(destination, customPath) {
  if (destination === 'cwd') return process.cwd();
  if (destination === 'custom') {
    if (!customPath?.trim()) throw new Error('Indica customPath para el destino personalizado.');
    return expandPath(customPath);
  }
  return process.env.SOFFIA_MCP_DOWNLOADS_DIR || join(homedir(), 'Downloads', 'soffia');
}

async function askDestination() {
  try {
    const result = await server.server.elicitInput({
      mode: 'form',
      message: '¿Dónde quieres guardar los decks?',
      requestedSchema: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            title: 'Destino',
            description:
              'downloads guarda en Downloads/soffia (por defecto); cwd usa el directorio actual; custom permite una ruta.',
            enum: ['downloads', 'cwd', 'custom'],
            default: 'downloads',
          },
          customPath: {
            type: 'string',
            title: 'Ruta personalizada',
            description: 'Solo si eliges custom. Admite rutas absolutas o ~/…',
          },
        },
        required: ['destination'],
      },
    });

    if (result.action === 'accept' && result.content) {
      const destination = String(result.content.destination || 'downloads');
      const customPath = result.content.customPath ? String(result.content.customPath) : '';
      return { destination, customPath, source: 'pregunta' };
    }
  } catch {
    // El cliente no admite elicitación: se usa el destino por defecto.
  }
  return { destination: 'downloads', customPath: '', source: 'por defecto' };
}

async function validateEntries(entries, { strict = false, allowPlain = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'soffia-mcp-batch-'));
  try {
    const files = [];
    for (const [index, entry] of entries.entries()) {
      const file = join(dir, `deck-${index + 1}.md`);
      await writeFile(file, entry.markdown, 'utf8');
      files.push(file);
    }

    const args = [validator, '--json', '--no-assets'];
    if (strict) args.push('--strict');
    if (allowPlain) args.push('--allow-plain');
    args.push(...files);

    let stdout = '';
    try {
      const result = await execFileAsync(process.execPath, args, {
        cwd: root,
        maxBuffer: 40 * 1024 * 1024,
        timeout: 60_000,
      });
      stdout = result.stdout;
    } catch (error) {
      stdout = error?.stdout || '';
    }

    if (!stdout.trim()) throw new Error('El validador no devolvió un informe.');
    const report = JSON.parse(stdout);
    return {
      report,
      items: entries.map((entry, index) => ({
        ...entry,
        index,
        file: report.files[index] ?? {
          ok: false,
          errors: [{ message: 'El validador no devolvió resultado para este archivo.' }],
          warnings: [],
        },
      })),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function describeReport(items) {
  return items.flatMap((item) => [
    `\n${item.fileName || `deck-${item.index + 1}`}${item.file.deckId ? ` (${item.file.deckId})` : ''}`,
    ...item.file.errors.map(
      (entry) => `ERROR ${entry.line ? `línea ${entry.line}: ` : ''}${entry.message}`,
    ),
    ...item.file.warnings.map(
      (entry) => `AVISO ${entry.line ? `línea ${entry.line}: ` : ''}${entry.message}`,
    ),
  ]);
}

function scaffold({
  title,
  description,
  tags,
  language,
  minutes,
  audience,
  objective,
  sections,
}) {
  const id = slugify(title);
  const cleanTags = tags.length > 0 ? tags : ['Estudio'];
  const topics =
    sections.length > 0
      ? sections
      : [
          'Contexto',
          'Conceptos clave',
          'Cómo funciona',
          'Aplicación práctica',
          'Errores frecuentes',
          'Resumen',
        ];

  const sectionBlocks = topics
    .map((topic, index) => {
      const first = index === 0;
      return `## ${topic}

Explica aquí la idea principal de «${topic}». Define los términos la primera vez que aparecen y usa ejemplos concretos.

${first ? `### Un matiz importante

Añade un detalle que cambie la comprensión o la aplicación del concepto.
` : ''}### Práctica

:::quiz{id=q-${slugify(topic)}-${index + 1}}
**Pregunta:** ¿Qué idea resume mejor «${topic}»?

- [ ] Una opción incorrecta.
- [x] La idea correcta.
- [ ] Otra opción incorrecta.

> **Explicación:** Justifica la respuesta y explica por qué las otras opciones no encajan.
:::
`;
    })
    .join('\n');

  return `---
id: ${id}
title: ${yaml(title)}
subtitle: Una frase que sitúe el contenido
description: ${yaml(description || `Deck de estudio sobre ${title}.`)}
tags: [${cleanTags.map((tag) => yaml(tag)).join(', ')}]
author: soffia
language: ${yaml(language)}
estimatedMinutes: ${minutes}
---

# ${title}

Introducción breve: qué es, por qué importa y qué va a aprender la persona.${audience ? `\n\nPúblico: ${audience}.` : ''}${objective ? `\n\nObjetivo: ${objective}.` : ''}

:::keypoints
- Primera idea que hay que recordar.
- Segunda idea que hay que recordar.
- Tercera idea que hay que recordar.
:::

${sectionBlocks}
## Referencias

:::references
1. [Fuente verificable](https://example.com) — Sustituye esta URL por una fuente real y explica qué aporta.
:::

## Repaso final

:::flashcards{id=fc-repaso}
### ¿Cuál es la idea central?
Una respuesta breve y precisa.

---

### ¿Qué aplicación práctica tiene?
Un ejemplo concreto.
:::

:::qa{id=qa-repaso}
### ¿Qué duda resolvería una persona después de estudiar este tema?
Una respuesta directa.
:::
`;
}

const server = new McpServer(
  {
    name: 'soffia',
    version: '1.2.0',
  },
  {
    instructions:
      'soffia enseña a producir decks de estudio en Markdown. Antes de escribir, obtén el formato con soffia_get_format. Usa soffia_scaffold_deck si necesitas una estructura. No generes imágenes: usa URLs https directas y verificables con crédito, o archivos locales aportados por el usuario. Incluye al menos una imagen web relevante cuando el tema lo permita y asegúrate de que ningún encabezado, bloque o tarjeta quede vacío. Valida siempre con soffia_validate_deck o soffia_validate_decks hasta obtener 0 errores. Para entregar archivos, usa soffia_save_decks con uno o varios decks: pregunta el destino (carpeta personalizada, directorio actual o Downloads/soffia) y guarda los válidos aunque otros fallen. Los archivos se nombran soffia-<nombre>-<id>.md.',
  },
);

async function readText(path) {
  return readFile(path, 'utf8');
}

server.registerTool(
  'soffia_get_format',
  {
    title: 'Obtener formato soffia',
    description:
      'Devuelve la guía portable para escribir un deck soffia: frontmatter, bloques :::, imágenes web, reglas de contenido completo, IDs y validación. Úsala antes de generar o corregir un deck.',
    inputSchema: {
      full: z
        .boolean()
        .optional()
        .describe('Si es true, devuelve también la especificación completa de referencia.'),
    },
  },
  async ({ full }) => {
    const quick = await readText(quickReference);
    const text = full
      ? `${quick}\n\n---\n\n# Especificación completa\n\n${await readText(reference)}`
      : quick;

    return {
      content: [{ type: 'text', text }],
    };
  },
);

server.registerTool(
  'soffia_get_schema',
  {
    title: 'Obtener esquema soffia',
    description:
      'Devuelve un esquema JSON legible por máquina con frontmatter, estructura, directivas, política de imágenes y validación.',
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: await readText(schemaFile),
      },
    ],
  }),
);

server.registerTool(
  'soffia_scaffold_deck',
  {
    title: 'Crear esqueleto de deck',
    description:
      'Genera un Markdown inicial válido para soffia a partir de un título y, opcionalmente, secciones, tags y audiencia. El modelo debe completar el contenido, sustituir la fuente de ejemplo y validar.',
    inputSchema: {
      title: z.string().min(3).describe('Título del deck.'),
      description: z.string().optional().describe('Resumen para la biblioteca.'),
      tags: z.array(z.string()).optional().describe('Etiquetas del deck.'),
      language: z.string().optional().describe('Código de idioma, por defecto es.'),
      minutes: z
        .number()
        .int()
        .min(1)
        .max(240)
        .optional()
        .describe('Minutos estimados, por defecto 20.'),
      audience: z.string().optional().describe('Público objetivo.'),
      objective: z.string().optional().describe('Objetivo de aprendizaje.'),
      sections: z
        .array(z.string())
        .min(1)
        .max(20)
        .optional()
        .describe('Títulos H2 sugeridos.'),
    },
  },
  async (input) => {
    const markdown = scaffold({
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      tags: input.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
      language: input.language?.trim() || 'es',
      minutes: input.minutes ?? 20,
      audience: input.audience?.trim() ?? '',
      objective: input.objective?.trim() ?? '',
      sections: input.sections?.map((section) => section.trim()).filter(Boolean) ?? [],
    });

    return {
      content: [
        {
          type: 'text',
          text: markdown,
        },
      ],
    };
  },
);

server.registerTool(
  'soffia_validate_deck',
  {
    title: 'Validar deck soffia',
    description:
      'Valida la estructura, el contenido y las URLs de un Markdown de soffia. No comprueba archivos locales porque el MCP solo recibe texto. Devuelve errores, avisos, estadísticas y un resumen.',
    inputSchema: {
      markdown: z.string().min(1).describe('Contenido completo del archivo Markdown.'),
      strict: z
        .boolean()
        .optional()
        .describe('Si es true, los avisos también hacen fallar la validación.'),
      allowPlain: z
        .boolean()
        .optional()
        .describe('Permite Markdown sin frontmatter; útil para contenido pegado.'),
    },
  },
  async ({ markdown, strict, allowPlain }) => {
    const dir = await mkdtemp(join(tmpdir(), 'soffia-mcp-'));
    const file = join(dir, 'deck.md');
    const args = [validator, '--json', '--no-assets'];
    if (strict) args.push('--strict');
    if (allowPlain) args.push('--allow-plain');
    args.push(file);

    try {
      await writeFile(file, markdown, 'utf8');
      let stdout = '';
      try {
        const result = await execFileAsync(process.execPath, args, {
          cwd: root,
          maxBuffer: 20 * 1024 * 1024,
          timeout: 20_000,
        });
        stdout = result.stdout;
      } catch (error) {
        stdout = error?.stdout || '';
      }

      if (!stdout.trim()) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: 'El validador no devolvió un informe. Revisa que el archivo no esté vacío.',
            },
          ],
        };
      }

      const report = JSON.parse(stdout);
      const summary = report.summary;
      const human = [
        `Validación: ${summary.ok ? 'OK' : 'con errores'}`,
        `${summary.files} archivo(s) · ${summary.errors} error(es) · ${summary.warnings} aviso(s)`,
        ...report.files.flatMap((item) => [
          `\n${item.file}${item.deckId ? ` (${item.deckId})` : ''}`,
          ...item.errors.map((entry) => `ERROR ${entry.line ? `línea ${entry.line}: ` : ''}${entry.message}`),
          ...item.warnings.map((entry) => `AVISO ${entry.line ? `línea ${entry.line}: ` : ''}${entry.message}`),
        ]),
      ].join('\n');

      return {
        content: [
          { type: 'text', text: human },
          { type: 'text', text: JSON.stringify(report, null, 2) },
        ],
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);

server.registerTool(
  'soffia_validate_decks',
  {
    title: 'Validar varios decks soffia',
    description:
      'Valida varios Markdown de soffia a la vez y devuelve un informe por archivo. No bloquea el lote: los errores de un deck no impiden validar los demás.',
    inputSchema: {
      decks: z
        .array(
          z.object({
            markdown: z.string().min(1).describe('Contenido completo del archivo Markdown.'),
            fileName: z
              .string()
              .optional()
              .describe('Nombre original del archivo, usado para el informe y el guardado.'),
          }),
        )
        .min(1)
        .max(50)
        .describe('Decks que se van a validar.'),
      strict: z.boolean().optional().describe('Si es true, los avisos también hacen fallar la validación.'),
      allowPlain: z.boolean().optional().describe('Permite Markdown sin frontmatter.'),
    },
  },
  async ({ decks, strict, allowPlain }) => {
    try {
      const { report, items } = await validateEntries(decks, { strict, allowPlain });
      const summary = report.summary;
      const human = [
        `Validación por lotes: ${summary.ok ? 'OK' : 'con errores'}`,
        `${summary.files} archivo(s) · ${summary.errors} error(es) · ${summary.warnings} aviso(s)`,
        ...describeReport(items),
        summary.errors === 0
          ? '\nTodos los decks se pueden guardar con soffia_save_decks.'
          : '\nCorrige los archivos con ERROR antes de guardarlos; los válidos sí se pueden guardar.',
      ].join('\n');

      return {
        content: [
          { type: 'text', text: human },
          { type: 'text', text: JSON.stringify(report, null, 2) },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `No se pudo validar el lote: ${error.message}` }],
      };
    }
  },
);

server.registerTool(
  'soffia_save_decks',
  {
    title: 'Guardar decks soffia',
    description:
      'Valida y guarda uno o varios decks Markdown en disco. Pregunta el destino si no se indica: Downloads/soffia (por defecto), directorio actual o una ruta personalizada. Guarda los archivos válidos aunque otros fallen, no sobrescribe archivos y usa nombres soffia-<nombre>-<id>.md. Las imágenes web son recomendables pero nunca bloquean el guardado.',
    inputSchema: {
      decks: z
        .array(
          z.object({
            markdown: z.string().min(1).describe('Contenido completo del deck.'),
            fileName: z
              .string()
              .optional()
              .describe('Nombre de referencia para el archivo, por ejemplo sistema-solar.md.'),
          }),
        )
        .min(1)
        .max(50)
        .describe('Decks que se van a validar y guardar.'),
      destination: z
        .enum(['downloads', 'cwd', 'custom'])
        .optional()
        .describe('downloads = Downloads/soffia; cwd = directorio actual; custom = customPath.'),
      customPath: z
        .string()
        .optional()
        .describe('Carpeta para destination=custom. Admite rutas absolutas o ~/…'),
      strict: z.boolean().optional().describe('Si es true, los avisos impiden guardar.'),
    },
  },
  async ({ decks, destination, customPath, strict }) => {
    let destinationInfo = {
      destination,
      customPath,
      source: destination ? 'indicado' : '',
    };
    if (!destinationInfo.destination) {
      destinationInfo = await askDestination();
    }

    let targetDirectory;
    try {
      targetDirectory = destinationFrom(destinationInfo.destination, destinationInfo.customPath);
      await mkdir(targetDirectory, { recursive: true });
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `No se pudo preparar el destino: ${error.message}\nIndica destination=custom con customPath, destination=cwd o deja el valor por defecto downloads.`,
          },
        ],
      };
    }

    try {
      const { report, items } = await validateEntries(decks, { strict });
      const saved = [];
      const failed = [];

      for (const item of items) {
        if (!item.file.ok) {
          failed.push({
            file: item.fileName || `deck-${item.index + 1}`,
            errors: item.file.errors,
            warnings: item.file.warnings,
          });
          continue;
        }

        const base = fileBaseName(item, item.index);
        let written = '';
        let lastError = null;
        for (let attempt = 0; attempt < 128; attempt += 1) {
          const candidate = join(targetDirectory, `soffia-${base}-${shortId()}.md`);
          try {
            await writeFile(candidate, item.markdown, { encoding: 'utf8', flag: 'wx' });
            written = candidate;
            break;
          } catch (error) {
            if (error?.code === 'EEXIST') {
              lastError = error;
              continue;
            }
            lastError = error;
            break;
          }
        }

        if (!written) {
          failed.push({
            file: item.fileName || `deck-${item.index + 1}`,
            errors: [
              {
                message: `No se pudo escribir el archivo: ${lastError?.message ?? 'colisión de nombres.'}`,
              },
            ],
            warnings: item.file.warnings,
          });
          continue;
        }

        saved.push({
          file: item.fileName || `deck-${item.index + 1}`,
          path: written,
          deckId: item.file.deckId,
          warnings: item.file.warnings,
        });
      }

      const images = items.reduce((total, item) => total + (item.file.stats?.images ?? 0), 0);
      const human = [
        `Guardado: ${saved.length} archivo(s) · ${failed.length} con error.`,
        `Destino (${destinationInfo.source}): ${targetDirectory}`,
        ...saved.map((item) => `OK ${item.path}`),
        ...failed.flatMap((item) => [
          `ERROR ${item.file}`,
          ...item.errors.map((entry) => `  ${entry.line ? `línea ${entry.line}: ` : ''}${entry.message}`),
        ]),
        '',
        images === 0
          ? 'Ningún deck incluye imágenes. Se guardaron igualmente; si el tema lo permite, añade al menos una URL https verificable con crédito.'
          : `Los decks incluyen ${images} imagen(es) web o local(es).`,
        report.summary.errors > 0
          ? 'Los archivos con error no se escribieron. Corrígelos y vuelve a llamar a soffia_save_decks.'
          : 'Todos los decks eran válidos y se guardaron.',
      ].join('\n');

      return {
        content: [
          { type: 'text', text: human },
          { type: 'text', text: JSON.stringify({ targetDirectory, saved, failed }, null, 2) },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: `No se pudo guardar el lote: ${error.message}` }],
      };
    }
  },
);

server.registerTool(
  'soffia_get_example',
  {
    title: 'Obtener un deck de ejemplo',
    description:
      'Devuelve un deck completo de ejemplo. web usa imágenes https; clinical usa el ejemplo clínico; minimal es el esqueleto mínimo.',
    inputSchema: {
      kind: z.enum(['web', 'clinical', 'minimal']).describe('Tipo de ejemplo.'),
    },
  },
  async ({ kind }) => {
    const text =
      kind === 'minimal' ? MINIMAL_EXAMPLE : await readText(examples[kind]);
    return {
      content: [{ type: 'text', text }],
    };
  },
);

server.registerPrompt(
  'crear_deck_soffia',
  {
    title: 'Crear un deck soffia',
    description:
      'Plantilla reutilizable para que cualquier modelo produzca un deck soffia completo y validado.',
    argsSchema: {
      topic: z.string().describe('Tema del deck.'),
      audience: z.string().optional().describe('Público objetivo.'),
      language: z.string().optional().describe('Idioma; por defecto, español.'),
      minutes: z.string().optional().describe('Duración estimada en minutos.'),
      images: z
        .enum(['web', 'local', 'none'])
        .optional()
        .describe('Estrategia de imágenes; por defecto, web.'),
    },
  },
  async ({ topic, audience, language, minutes, images }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `Crea un deck de estudio soffia sobre: ${topic}.`,
            audience ? `Público: ${audience}.` : '',
            `Idioma: ${language || 'es'}.`,
            `Duración orientativa: ${minutes || '20'} minutos.`,
            `Imágenes: ${images || 'web'}.`,
            '',
            'Proceso obligatorio:',
            '1. Llama a soffia_get_format y sigue su estructura.',
            '2. Si necesitas estructura, usa soffia_scaffold_deck. Puedes adaptar las secciones al tema.',
            '3. Escribe contenido propio: 6–12 secciones H2, H3 solo para subtemas reales; ningún encabezado, bloque o tarjeta debe quedar vacío.',
            '4. Añade keypoints, quizzes, flashcards, Q&A y referencias verificables.',
            images === 'none'
              ? '5. No incluyas imágenes.'
              : '5. Incluye al menos una imagen web relevante cuando el tema lo permita, con URL https directa, alt, pie y crédito. Si no hay una fuente verificable, omítela. No generes imágenes.',
            '6. Llama a soffia_validate_deck o soffia_validate_decks y corrige todos los errores. Repite hasta 0 errores.',
            '7. Pregunta dónde guardar: carpeta personalizada, directorio actual o Downloads/soffia (por defecto).',
            '8. Llama a soffia_save_decks con todos los decks. Si generas varios archivos, envíalos en una sola llamada; los inválidos se reportan sin bloquear los válidos.',
            '9. Entrega las rutas guardadas, el resultado de la validación y las fuentes usadas.',
            '',
            'No uses HTML. No numeres los encabezados manualmente. Cierra todos los bloques :::.',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      },
    ],
  }),
);

server.registerResource(
  'soffia-quick-reference',
  'soffia://quick-reference',
  {
    title: 'Guía portable de soffia',
    description: 'Frontmatter, estructura, bloques, imágenes y validación.',
    mimeType: 'text/markdown',
  },
  async () => ({
    contents: [
      {
        uri: 'soffia://quick-reference',
        mimeType: 'text/markdown',
        text: await readText(quickReference),
      },
    ],
  }),
);

server.registerResource(
  'soffia-format',
  'soffia://format',
  {
    title: 'Especificación completa del formato soffia',
    description: 'Referencia exhaustiva de campos, directivas, IDs e importación.',
    mimeType: 'text/markdown',
  },
  async () => ({
    contents: [
      {
        uri: 'soffia://format',
        mimeType: 'text/markdown',
        text: await readText(reference),
      },
    ],
  }),
);

server.registerResource(
  'soffia-skill',
  'soffia://skill',
  {
    title: 'Skill soffia',
    description: 'Flujo de trabajo y reglas de calidad para agentes.',
    mimeType: 'text/markdown',
  },
  async () => ({
    contents: [
      {
        uri: 'soffia://skill',
        mimeType: 'text/markdown',
        text: await readText(skillFile),
      },
    ],
  }),
);

server.registerResource(
  'soffia-schema',
  'soffia://schema',
  {
    title: 'Esquema JSON de soffia',
    description: 'Estructura legible por máquina para validar y generar decks.',
    mimeType: 'application/json',
  },
  async () => ({
    contents: [
      {
        uri: 'soffia://schema',
        mimeType: 'application/json',
        text: await readText(schemaFile),
      },
    ],
  }),
);

server.registerResource(
  'soffia-example-web',
  'soffia://example/web',
  {
    title: 'Ejemplo con imágenes web',
    description: 'Deck completo con URLs https y créditos.',
    mimeType: 'text/markdown',
  },
  async () => ({
    contents: [
      {
        uri: 'soffia://example/web',
        mimeType: 'text/markdown',
        text: await readText(examples.web),
      },
    ],
  }),
);

server.registerResource(
  'soffia-example-clinical',
  'soffia://example/clinical',
  {
    title: 'Ejemplo clínico',
    description: 'Deck de Impétigo con imágenes locales de demo.',
    mimeType: 'text/markdown',
  },
  async () => ({
    contents: [
      {
        uri: 'soffia://example/clinical',
        mimeType: 'text/markdown',
        text: await readText(examples.clinical),
      },
    ],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('soffia MCP listo en stdio');
}

main().catch((error) => {
  console.error('soffia MCP error:', error);
  process.exit(1);
});
