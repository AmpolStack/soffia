#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localDotnet = join(process.env.USERPROFILE || '', '.dotnet9', 'dotnet.exe');
const dotnet = process.env.DOTNET_BIN
  || (process.platform === 'win32' && existsSync(localDotnet) ? localDotnet : 'dotnet');
const port = Number(process.env.SOFFIA_TEST_PORT || 5099);
const base = `http://127.0.0.1:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), 'soffia-api-test-'));
const username = 'soffia';
const password = 'Soffia-dev-password';

const apiDir = join(root, 'server', 'Soffia.Api');
const server = spawn(
  dotnet,
  [join(apiDir, 'bin', 'Debug', 'net9.0', 'Soffia.Api.dll')],
  {
    cwd: apiDir,
    env: {
      ...process.env,
      APP_AUTHENTICATION_NAME: 'Soffia',
      APP_AUTHENTICATION_USERNAME: username,
      APP_AUTHENTICATION_PASSWORD: password,
      APP_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
      ASPNETCORE_ENVIRONMENT: 'Development',
      ASPNETCORE_URLS: base,
      DATA_DIR: dataDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let serverLog = '';
server.stdout.on('data', (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverLog += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {
      // Todavía arrancando.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`La API no arrancó.\n${serverLog}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { cookie, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'x-soffia-request': '1' } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  return response;
}

function cookieFrom(response) {
  return response.headers.getSetCookie?.()[0]?.split(';')[0]
    ?? response.headers.get('set-cookie')?.split(';')[0]
    ?? '';
}

let cookie = '';
try {
  await waitForServer();

  const health = await request('/api/health');
  assert(health.ok, 'Health check falló.');
  assert(health.headers.get('x-content-type-options') === 'nosniff', 'Falta X-Content-Type-Options.');
  assert(health.headers.get('cache-control') === 'no-store', 'Falta Cache-Control: no-store.');

  const unknownApi = await request('/api/no-existe');
  assert(unknownApi.status === 404, `Una ruta API desconocida debería dar 404, llegó ${unknownApi.status}.`);

  const unauthenticated = await request('/api/decks');
  assert(unauthenticated.status === 401, `Se esperaba 401 sin sesión, llegó ${unauthenticated.status}.`);

  const missingCsrf = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
    headers: { 'x-soffia-request': '' },
  });
  assert(missingCsrf.status === 400, `Se esperaba 400 sin X-Soffia-Request, llegó ${missingCsrf.status}.`);

  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password: 'incorrecta' },
  });
  assert(badLogin.status === 401, `Se esperaba 401 con contraseña incorrecta, llegó ${badLogin.status}.`);

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  assert(login.status === 200, `Login falló con ${login.status}.`);
  cookie = cookieFrom(login);
  assert(cookie.startsWith('soffia_session='), 'No se recibió la cookie de sesión.');

  const session = await request('/api/auth/session', { cookie });
  const sessionBody = await session.json();
  assert(sessionBody.authenticated && sessionBody.name === 'Soffia', 'La sesión no devolvió el usuario.');

  const markdown = await readFile(join(root, 'examples', 'sistema-solar', 'seminario.md'), 'utf8');
  const invalid = '---\ntitle: Roto\n---\n# Roto\n';
  const imported = await request('/api/decks/import', {
    method: 'POST',
    cookie,
    body: {
      files: [
        { markdown, sourceName: 'sistema-solar.md', assets: [] },
        { markdown: invalid, sourceName: 'roto.md', assets: [] },
      ],
    },
  });
  assert(imported.status === 200, `La importación falló con ${imported.status}.`);
  const importBody = await imported.json();
  assert(importBody.imported === 1 && importBody.failed === 1, 'El lote no reportó 1 válido y 1 inválido.');
  const saved = importBody.results.find((item) => item.ok)?.deck;
  assert(saved, 'No se devolvió el deck guardado.');
  assert(/^soffia-sistema-solar-[0-9a-f]{4}\.md$/.test(saved.fileName), `Nombre inesperado: ${saved.fileName}`);
  assert(saved.tags.includes('Astronomía'), 'No se conservaron los tags del frontmatter.');
  assert(saved.summary.sections === 9, `Resumen inesperado: ${saved.summary.sections} secciones.`);

  const list = await request('/api/decks', { cookie });
  const decks = await list.json();
  assert(Array.isArray(decks) && decks.length === 1, `La biblioteca devolvió ${decks.length} decks.`);

  const badId = await request('/api/decks/%2E%2E%2Fsecreto', { cookie });
  assert(badId.status === 400, `Un id con travesía debería dar 400, llegó ${badId.status}.`);

  const impetigoMarkdown = await readFile(join(root, 'examples', 'impetigo', 'seminario.md'), 'utf8');
  const imageNames = [
    'lesion-costras.svg',
    'impetigo-ampolloso.svg',
    'ectima.svg',
    'algoritmo-tratamiento.svg',
  ];
  const impetigoAssets = [];
  for (const name of imageNames) {
    const content = await readFile(join(root, 'examples', 'impetigo', 'images', name));
    impetigoAssets.push({
      key: `images/${name}`,
      contentType: 'image/svg+xml',
      base64: content.toString('base64'),
    });
  }
  const demoImport = await request('/api/decks/import', {
    method: 'POST',
    cookie,
    body: {
      files: [
        {
          markdown: impetigoMarkdown,
          sourceName: 'seminario.md',
          assets: impetigoAssets,
        },
      ],
    },
  });
  const demoBody = await demoImport.json();
  assert(demoBody.imported === 1, `El deck de demo no se importó: ${JSON.stringify(demoBody)}`);
  const demoDeck = demoBody.results[0].deck;
  assert(demoDeck.assetKeys.length === 4, `El demo no registró sus 4 imágenes: ${demoDeck.assetKeys.length}.`);
  const demoAsset = await request(`/api/decks/${demoDeck.id}/assets/images/ectima.svg`, { cookie });
  assert(demoAsset.ok && demoAsset.headers.get('content-type')?.startsWith('image/svg+xml'), 'El SVG del demo no se sirvió.');

  const detail = await request(`/api/decks/${saved.id}`, { cookie });
  const detailBody = await detail.json();
  assert(detailBody.markdown === markdown, 'El Markdown guardado no coincide.');

  const file = await request(`/api/decks/${saved.id}/file`, { cookie });
  assert(file.ok, 'No se pudo descargar el archivo Markdown.');
  const disposition = file.headers.get('content-disposition') ?? '';
  assert(disposition.includes(saved.fileName), `Content-Disposition inesperado: ${disposition}`);
  assert((await file.text()) === markdown, 'El archivo descargado no coincide.');

  const progress = { read: ['concepto'], quiz: { 'q-1': true } };
  const putProgress = await request(`/api/progress/${saved.id}`, {
    method: 'PUT',
    cookie,
    body: progress,
  });
  assert(putProgress.ok, 'No se pudo guardar el progreso.');
  const getProgress = await request(`/api/progress/${saved.id}`, { cookie });
  assert(JSON.stringify(await getProgress.json()) === JSON.stringify(progress), 'El progreso no coincide.');

  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  const assetDeck = `---
id: prueba-assets
title: Prueba de assets
description: Deck de prueba con una imagen local.
tags: [Prueba]
language: es
---

# Prueba de assets

## Imagen

![Píxel](pixel.png)
`;
  const assetImport = await request('/api/decks/import', {
    method: 'POST',
    cookie,
    body: {
      files: [
        {
          markdown: assetDeck,
          sourceName: 'prueba assets.md',
          assets: [{ key: 'pixel.png', contentType: 'application/octet-stream', base64: tinyPng }],
        },
      ],
    },
  });
  const assetBody = await assetImport.json();
  assert(assetBody.imported === 1, `La importación con asset falló: ${JSON.stringify(assetBody)}`);
  const assetMeta = assetBody.results[0].deck;
  assert(assetMeta.assetKeys.includes('pixel.png'), 'El asset no se registró.');
  const asset = await request(`/api/decks/${assetMeta.id}/assets/pixel.png`, { cookie });
  assert(asset.ok && asset.headers.get('content-type')?.startsWith('image/png'), 'El asset no se sirvió como PNG.');
  assert((await asset.arrayBuffer()).byteLength > 0, 'El asset está vacío.');

  const deleteAsset = await request(`/api/decks/${assetMeta.id}/assets/pixel.png`, {
    method: 'DELETE',
    cookie,
  });
  assert(deleteAsset.ok, 'No se pudo eliminar el asset.');
  const missingAfterAssetDelete = await request(`/api/decks/${assetMeta.id}/assets/pixel.png`, { cookie });
  assert(missingAfterAssetDelete.status === 404, 'El asset debería haber desaparecido al eliminarlo.');

  const touch = await request(`/api/decks/${saved.id}/touch`, { method: 'POST', cookie });
  assert(touch.ok, 'No se pudo marcar el deck como abierto.');

  const deleted = await request(`/api/decks/${assetMeta.id}`, { method: 'DELETE', cookie });
  assert(deleted.ok, 'No se pudo eliminar el deck de prueba.');
  const missingAsset = await request(`/api/decks/${assetMeta.id}/assets/pixel.png`, { cookie });
  assert(missingAsset.status === 404, 'El asset debería haber desaparecido con el deck.');

  const logout = await request('/api/auth/logout', { method: 'POST', cookie });
  assert(logout.ok, 'No se pudo cerrar sesión.');
  cookie = cookieFrom(logout);
  const afterLogout = await request('/api/auth/session', { cookie });
  assert(afterLogout.status === 401, 'La sesión seguía activa después del logout.');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await request('/api/auth/login', {
      method: 'POST',
      body: { username, password: 'incorrecta' },
    });
  }
  const limited = await request('/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  assert(limited.status === 429, `Se esperaba 429 tras superar el límite de login, llegó ${limited.status}.`);

  console.log('API OK');
} finally {
  server.kill();
  await rm(dataDir, { recursive: true, force: true });
}
