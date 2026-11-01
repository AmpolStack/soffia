import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('dist-single/index.html');
const target = resolve('dist-single/soffia.html');
const icon = resolve('dist-single/favicon.svg');

if (!existsSync(source)) {
  console.error('No se encontró dist-single/index.html. ¿Falló el build?');
  process.exit(1);
}

let html = readFileSync(source, 'utf8');

// El build de un solo archivo debe seguir funcionando desde file://:
// se incrusta el favicon como data URI en lugar de dejar una ruta absoluta.
if (existsSync(icon)) {
  const svg = readFileSync(icon, 'utf8');
  const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const before = html;
  html = html.replace(
    /<link rel="icon"[^>]*>/,
    `<link rel="icon" type="image/svg+xml" href="${dataUri}" />`,
  );
  if (html === before) {
    console.warn('Aviso: no se encontró el <link rel="icon"> para incrustar.');
  }
}

writeFileSync(target, html);

// El resultado debe ser un único archivo autónomo: se eliminan los restos
// del build estático (index.html, favicon, _headers y _redirects).
for (const extra of ['index.html', '_headers', '_redirects', 'favicon.svg', 'llms.txt']) {
  const file = resolve('dist-single', extra);
  if (file !== target && existsSync(file)) rmSync(file, { force: true });
}

console.log(`Listo: ${target}`);
