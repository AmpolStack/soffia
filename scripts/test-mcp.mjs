#!/usr/bin/env node
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = join(root, 'mcp', 'soffia-server.mjs');
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: root,
  stderr: 'pipe',
});
const client = new Client({ name: 'soffia-mcp-test', version: '1.0.0' });

function textOf(result) {
  return (result.content ?? [])
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  console.log('tools', toolNames.join(', '));

  const resources = await client.listResources();
  console.log('resources', resources.resources.map((item) => item.uri).join(', '));

  const prompts = await client.listPrompts();
  console.log('prompts', prompts.prompts.map((item) => item.name).join(', '));

  const format = textOf(
    await client.callTool({ name: 'soffia_get_format', arguments: {} }),
  );
  if (!format.includes(':::quiz') || !format.includes('Imágenes web')) {
    throw new Error('La guía no contiene las secciones esperadas.');
  }

  const scaffoldResult = await client.callTool({
    name: 'soffia_scaffold_deck',
    arguments: {
      title: 'Deck de prueba MCP',
      description: 'Prueba generada por el cliente MCP.',
      tags: ['Prueba', 'MCP'],
      sections: ['Contexto', 'Práctica', 'Resumen'],
    },
  });
  const scaffold = textOf(scaffoldResult);
  if (!scaffold.includes('## Contexto') || !scaffold.includes(':::quiz')) {
    throw new Error('El scaffold no tiene la estructura esperada.');
  }
  const scaffoldValidation = textOf(
    await client.callTool({
      name: 'soffia_validate_deck',
      arguments: { markdown: scaffold },
    }),
  );
  if (!scaffoldValidation.includes('0 error(es)')) {
    throw new Error(`El scaffold no valida:\n${scaffoldValidation}`);
  }

  const example = await readFile(
    join(root, 'examples', 'sistema-solar', 'seminario.md'),
    'utf8',
  );
  const validation = textOf(
    await client.callTool({
      name: 'soffia_validate_deck',
      arguments: { markdown: example },
    }),
  );
  if (!validation.includes('0 error(es)')) {
    throw new Error(`La validación del ejemplo falló:\n${validation}`);
  }

  const batchValidation = textOf(
    await client.callTool({
      name: 'soffia_validate_decks',
      arguments: {
        decks: [
          { markdown: example, fileName: 'sistema-solar.md' },
          { markdown: '---\ntitle: Roto\n---\n# Roto\n', fileName: 'roto.md' },
        ],
      },
    }),
  );
  if (!batchValidation.includes('2 error(es)') || !batchValidation.includes('roto.md')) {
    throw new Error(`La validación por lotes no reportó el archivo inválido:\n${batchValidation}`);
  }

  const destination = await mkdtemp(join(tmpdir(), 'soffia-mcp-save-'));
  try {
    const save = await client.callTool({
      name: 'soffia_save_decks',
      arguments: {
        destination: 'custom',
        customPath: destination,
        decks: [
          { markdown: scaffold, fileName: 'deck-de-prueba.md' },
          { markdown: '---\ntitle: Roto\n---\n# Roto\n', fileName: 'roto.md' },
        ],
      },
    });
    const savedText = textOf(save);
    if (!savedText.includes('Guardado: 1 archivo(s) · 1 con error')) {
      throw new Error(`El guardado por lotes no respetó el resultado esperado:\n${savedText}`);
    }
    const files = await readdir(destination);
    if (files.length !== 1) throw new Error(`Se esperaba un archivo guardado, hay ${files.length}.`);
    if (!/^soffia-deck-de-prueba-[0-9a-f]{4}\.md$/.test(files[0])) {
      throw new Error(`Nombre de archivo inesperado: ${files[0]}`);
    }
    const saved = await readFile(join(destination, files[0]), 'utf8');
    if (saved !== scaffold) throw new Error('El archivo guardado no coincide con el deck validado.');
  } finally {
    await rm(destination, { recursive: true, force: true });
  }

  const prompt = await client.getPrompt({
    name: 'crear_deck_soffia',
    arguments: { topic: 'Sistema solar', images: 'web' },
  });
  if (!prompt.messages?.[0]?.content?.text?.includes('soffia_validate_deck')) {
    throw new Error('El prompt no incluye el flujo de validación.');
  }

  const resource = await client.readResource({ uri: 'soffia://quick-reference' });
  if (!resource.contents?.[0]?.text?.includes('Frontmatter')) {
    throw new Error('El recurso quick-reference no se leyó correctamente.');
  }

  console.log('MCP OK');
} finally {
  await client.close();
}
