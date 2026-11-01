#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const header = `# soffia — formato y recomendaciones

> Versión de texto para modelos que leen con \`webfetch\` o herramientas similares.
> Ruta humana equivalente: \`/formato\`.
> Incluye el contrato de salida, frontmatter, bloques \`:::\`, imágenes, validación y recomendaciones.

`;

const quick = (await readFile(join(root, 'mcp', 'quick-reference.md'), 'utf8'))
  .replace(/^# .*\n+/, '')
  .replace(
    'La especificación completa está en `skill/soffia/reference/format.md`.',
    'La especificación completa está al final de este archivo.',
  );
const full = (
  await readFile(join(root, 'skill', 'soffia', 'reference', 'format.md'), 'utf8')
).replace(/^# .*\n+/, '');

const content = `${header}${quick}\n\n---\n\n# Especificación completa\n\n${full}\n`;
await writeFile(join(root, 'public', 'llms.txt'), content, 'utf8');
console.log('Listo: public/llms.txt');
