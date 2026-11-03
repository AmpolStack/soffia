---
name: soffia
description: Crea y valida decks de estudio en Markdown para soffia, con secciones, quizzes, flashcards, preguntas abiertas, referencias e imágenes web o locales.
---

# soffia

soffia convierte un archivo Markdown en una experiencia de lectura y estudio: índice lateral, secciones y subsecciones plegables, búsqueda, lightbox de imágenes, quizzes con corrección, tarjetas con repaso espaciado, preguntas abiertas y estadísticas.

Esta skill sirve para **producir decks que soffia entienda a la primera**. La app tolera Markdown normal, pero un deck pensado para estudiar necesita estructura, práctica y referencias verificables.

## Cuándo usar esta skill

Úsala cuando el usuario pida:

- un seminario, apunte, guía de estudio o resumen para soffia;
- convertir contenido en secciones, quizzes, flashcards o preguntas de repaso;
- revisar o completar un deck Markdown existente;
- validar un deck antes de importarlo en la app.

No la uses para editar la interfaz de soffia ni para generar documentos que no vayan a seguir este formato.

## Contrato de salida

Entrega una carpeta con esta forma:

```text
tema/
├── seminario.md
└── images/            (opcional, solo si hay archivos locales)
    ├── figura-1.jpg
    └── figura-2.png
```

- El archivo principal es Markdown con extensión `.md`.
- Por defecto, usa **imágenes web directas** con `https://` y atribución. Incluye al menos una imagen web relevante cuando el tema lo permita. No generes SVGs ni imágenes nuevas.
- Si el usuario aporta imágenes locales, puedes incluirlas en `images/` y referenciarlas con rutas **relativas** al `.md`.
- Si no hay imágenes locales, no crees la carpeta `images/`.
- El deck debe poder importarse arrastrando la carpeta completa a la biblioteca de soffia.

### Esqueleto mínimo

```md
---
id: tema-del-deck
title: Tema del deck
subtitle: Una frase que sitúe el contenido
description: Qué aprende la persona y para qué le sirve.
tags: [Tema, Nivel]
author: Tu nombre
language: es
estimatedMinutes: 20
# cover: https://… (opcional; URL https directa con crédito)
---

# Tema del deck

Introducción breve: qué es, por qué importa y qué se va a aprender.

:::keypoints
- Primera idea que hay que recordar.
- Segunda idea que hay que recordar.
- Tercera idea que hay que recordar.
:::

## Contexto

Texto de la sección. Puedes usar **negrita**, *cursiva*, listas, tablas, enlaces y bloques de código.

### Un matiz importante

Texto de la subsección.

## Práctica

:::quiz{id=q-idea-principal}
**Pregunta:** ¿Cuál es la idea principal?

- [ ] Una opción incorrecta.
- [x] La opción correcta.
- [ ] Otra opción incorrecta.

> **Explicación:** La opción correcta es la que mejor resume el concepto porque…
:::

:::flashcards{id=fc-conceptos}
### ¿Qué es el concepto clave?
Una definición breve y precisa.

---
### ¿Para qué sirve?
Para resolver este tipo de problema.
:::

## Referencias

:::references
1. [Título de la fuente](https://example.com) — Qué aporta y por qué es fiable.
:::
```

## Flujo de trabajo

1. **Define el encargo.** Tema, público, nivel, objetivo de aprendizaje, duración aproximada y si hay que citar fuentes.
2. **Investiga antes de escribir.** Usa fuentes primarias o instituciones de referencia. No inventes datos, cifras, citas, DOIs ni URLs.
3. **Diseña el esqueleto.** De 8 a 15 secciones H2 para un seminario; cada una con una idea clara. Usa H3 solo cuando una sección tenga varios subtemas reales.
4. **Escribe el contenido.** Explica antes de enumerar. Define los términos la primera vez. Usa tablas para comparar, pasos para procedimientos y callouts para matices.
5. **Añade práctica.** Incluye quizzes, flashcards y preguntas abiertas suficientes para cubrir las ideas importantes, no para rellenar.
6. **Añade al menos una imagen web relevante siempre que el tema lo permita.** Usa una URL web directa, verificable y con licencia clara; añade texto alternativo, pie y crédito. Si no encuentras una fuente fiable, omítela. No generes imágenes.
7. **Valida.** Ejecuta el validador y corrige errores y avisos antes de entregar.
8. **Entrega.** Si tienes MCP, pregunta el destino y llama a `soffia_save_decks` con todos los decks; guarda los válidos aunque otros fallen y no sobrescribe. Si no tienes MCP, indica la ruta del `.md`, las imágenes web o la carpeta local, y el resultado de la validación.

## Reglas de contenido

- Escribe en español por defecto. Si el usuario pide otro idioma, cambia el contenido y el campo `language`.
- Empieza con una introducción breve y unos `:::keypoints` de 3 a 8 ideas.
- Cada sección H2 y cada subsección H3 debe tener contenido propio; no encadenes encabezados vacíos ni dejes secciones de una sola frase.
- Todo bloque debe tener cuerpo real: callouts con texto, keypoints con ítems, pasos con título y contenido, quizzes con opciones y explicación, tarjetas con frente y reverso, referencias con URL y nota, y galerías o figuras con imagen y `alt`.
- No dejes labels, listas, tablas, tarjetas, pasos, opciones o referencias vacías. Si un elemento no aporta contenido, elimínalo.
- No uses `TODO`, `N/A`, `...` ni placeholders como contenido. Un deck corto y completo es mejor que uno largo con huecos.
- No repitas la misma idea en varios bloques con palabras distintas.
- Las tablas deben comparar dimensiones útiles, no ser listas disfrazadas.
- Los pasos deben ser accionables y estar en orden.
- Los callouts deben aportar un matiz, una advertencia o una perla; no los uses como decoración.
- Si el tema es sanitario, jurídico o financiero, prioriza fuentes oficiales y añade la fecha de consulta cuando sea relevante.
- No prometas resultados ni simplifiques hasta el punto de volver el contenido incorrecto.

### Proporciones recomendadas

Para un seminario de 1.500 a 4.000 palabras:

- 8–15 secciones H2;
- 0–3 subsecciones H3 por sección, solo si aportan;
- 4–10 quizzes;
- 10–20 flashcards;
- 5–10 preguntas abiertas;
- 4–8 referencias;
- 2–6 imágenes.

El ejemplo `examples/impetigo/seminario.md` del proyecto es la referencia de calidad: 15 secciones, 9 quizzes, 12 tarjetas, 8 preguntas, 6 referencias y 4 ilustraciones locales de demo. Los decks nuevos deben usar imágenes web verificables, no generar nuevas.

## Reglas de formato que no se negocian

1. **Sin numeración manual en los encabezados.** La app numera sola las secciones (`01`) y subsecciones (`01.1`). Escribe `## Tratamiento`, no `## 1. Tratamiento`.
2. **Un solo H1.** Es el título del deck. La app lo usa como portada y lo separa del cuerpo.
3. **H2 = sección; H3 = subsección.** H4–H6 se renderizan como encabezados internos, pero no crean acordeones ni entradas del índice.
4. **No pongas H3 antes del primer H2.** Quedaría fuera de la estructura de secciones.
5. **Cierra todos los bloques `:::`.** La línea de cierre es exactamente `:::` en su propia línea.
6. **No uses HTML.** soffia escapa el HTML; usa Markdown, tablas y los bloques de esta skill.
7. **No anides quizzes, flashcards, Q&A, referencias, keypoints, galerías ni figuras.** Solo `callout`, `note`, `quote`, `grid` y `steps` están pensados para contener otros bloques.
8. **Usa IDs estables** en quizzes y tarjetas si quieres conservar el progreso al reimportar.
9. **Las imágenes web deben ser directas y seguras.** Usa `https://` y una URL que termine en la imagen, no en la página que la contiene.
10. **No generes imágenes.** No crees SVGs, ilustraciones ni placeholders. Usa fuentes web verificables o archivos que aporte el usuario.
11. **Todo elemento debe tener contenido.** No dejes encabezados, labels, listas, tablas, tarjetas, pasos, opciones, referencias ni figuras sin cuerpo; si no puedes completarlos, elimínalos.

## Referencia rápida de bloques

### Callouts

```md
:::callout{type=why} ¿Por qué ocurre?
Explicación del mecanismo.
:::

:::callout{type=warning}
No uses este tratamiento sin confirmar el diagnóstico.
:::

:::callout{type=pearl} Perla clínica
Un detalle que cambia la decisión.
:::
```

Variantes: `why`, `tip`, `warning`, `key`, `info`, `pearl`, `quote`. `:::note` equivale a `info`; `:::quote` equivale a `quote`. El título puede ir entre llaves con `title="..."` o después del bloque de atributos. `collapsible=true` lo hace plegable.

### Grid

```md
:::grid{columns=2}
**Antes**
- Punto uno.
- Punto dos.

**Después**
- Punto tres.
- Punto cuatro.
:::
```

`columns` admite 1–3 columnas; por defecto son 2.

### Pasos

```md
:::steps
### Confirma el diagnóstico
Describe el primer paso.

### Elige el tratamiento
Describe el segundo paso.
:::
```

No numeres los títulos: la app añade `01`, `02`, etc. y elimina prefijos numéricos si los hay.

### Quiz

```md
:::quiz{id=q-diagnostico}
**Pregunta:** ¿Cuál es el diagnóstico más probable?

- [ ] Una opción.
- [x] La opción correcta.
- [ ] Otra opción.

> **Explicación:** Por qué es correcta y por qué las otras no.
:::
```

- Usa `- [ ]` para incorrectas y `- [x]` para correctas.
- Si hay más de una correcta, el quiz se marca como múltiple automáticamente. También puedes usar `multiple=true`.
- La explicación va después de la última opción; puede ir en blockquote.
- Atributos opcionales: `id`, `multiple`, `difficulty` (1–5), `tags` (separados por comas).

### Flashcards

```md
:::flashcards{id=fc-tratamiento}
### ¿Cuál es el tratamiento de primera línea?
Mupirocina tópica en lesiones localizadas.

---
### ¿Cuándo se usa tratamiento oral?
En enfermedad extensa o con factores de riesgo.
:::
```

Cada tarjeta se separa con `---`. El frente es el `###`; el reverso es el resto. También funciona `frente || reverso`, pero es menos legible para contenido largo. Puedes fijar el ID de una tarjeta con `### Frente {#card-id}`.

### Preguntas abiertas

```md
:::qa{id=qa-dudas}
### ¿El impétigo siempre necesita antibiótico?
No. El tratamiento tópico basta en lesiones localizadas.

---
### ¿Cuándo derivar?
Cuando hay afectación extensa, sistémica o factores de riesgo.
:::
```

Usa el mismo formato de tarjetas que en `:::flashcards`.

### Puntos clave

```md
:::keypoints
- Primera idea.
- Segunda idea.
- Tercera idea.
:::
```

Solo se interpretan los elementos de lista; el texto suelto se ignora.

### Referencias

```md
:::references
1. [Organización Mundial de la Salud — Tema](https://www.who.int/) — Documento de referencia.
2. [Guía clínica](https://example.org/guia) — Recomendación concreta.
:::
```

Usa `https://`, títulos descriptivos y una nota que explique qué aporta cada fuente. No incluyas enlaces que no hayas verificado.

> Las URLs de imagen de los ejemplos son ilustrativas. Sustitúyelas por URLs `https://` reales y verificables, con crédito.

### Galería

```md
:::gallery{columns=2}
![Radiografía de tórax con consolidación](https://upload.wikimedia.org/wikipedia/commons/example/radiografia.jpg "Figura 1. Consolidación lobar")
![TC de tórax en corte axial](https://upload.wikimedia.org/wikipedia/commons/example/tc-torax.jpg "Figura 2. Patrón neumónico")
:::
```

`columns` admite 1–4 columnas; por defecto son 3. Solo se interpretan imágenes.

### Figura

```md
:::figure{src="https://upload.wikimedia.org/wikipedia/commons/example/esquema.png" alt="Algoritmo de tratamiento" caption="Figura 3. Decisión terapéutica" credit="Fuente: Wikimedia Commons, CC BY-SA 4.0"}
:::
```

También puedes poner la imagen dentro:

```md
:::figure
![Algoritmo de tratamiento](https://upload.wikimedia.org/wikipedia/commons/example/esquema.png "Figura 3. Decisión terapéutica")
:::
```

La imagen se abre en el lightbox. El texto alternativo describe la imagen; el pie contextualiza. Para imágenes web, añade siempre el crédito y la licencia.

### Imágenes Markdown normales

```md
![Descripción de la imagen](https://upload.wikimedia.org/wikipedia/commons/example/imagen.jpg "Pie de la imagen")
```

Una imagen sola en su párrafo se convierte en figura. Varias imágenes consecutivas se convierten en galería. En Markdown, el texto entre corchetes es el `alt` y el título entre comillas es el pie.

### Política de imágenes web

- Usa una URL **directa al archivo** de imagen, no a la página del artículo.
- Verifica que la URL funciona y que la licencia permite el uso.
- Cita la fuente y la licencia en `credit`.
- No uses URLs firmadas, temporales o con tokens que caducan.
- No uses imágenes de buscadores como miniatura de resultados.
- Si el deck debe funcionar sin conexión, descarga las imágenes con permiso y usa rutas locales.
- soffia aplica `referrerpolicy="no-referrer"` y muestra un fallback si la imagen falla.
- No generes imágenes con IA ni SVG para rellenar el deck.

## Validación

El validador no necesita dependencias y funciona también cuando la skill está instalada fuera del proyecto.

Desde la raíz de este proyecto:

```bash
npm run validate
```

Para validar otro archivo o una carpeta:

```bash
node skill/soffia/scripts/validate.mjs ruta/al/deck.md
node skill/soffia/scripts/validate.mjs ejemplos/
```

Si la skill ya está instalada:

```bash
node ~/.config/opencode/skills/soffia/scripts/validate.mjs ruta/al/deck.md
```

Opciones útiles:

- `--strict`: los avisos también hacen fallar la validación (útil en CI).
- `--json`: informe legible por máquina.
- `--allow-plain`: permite Markdown sin frontmatter.
- `--no-assets`: no comprueba que las imágenes existan.
- `--quiet`: solo errores y resumen.

Antes de entregar, el comando debe terminar con `0 errores`. Si hay avisos, revísalos y corrige los que afecten a la calidad; no los ignores sin motivo.

## Errores frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| El bloque se ve como texto | Falta el cierre `:::` o el nombre está mal escrito | Cierra con `:::` y usa un bloque documentado |
| El quiz no se puede responder | No hay opciones `- [ ]` / `- [x]` | Añade al menos dos opciones y marca una correcta |
| El quiz sale como múltiple sin querer | Hay más de una opción con `[x]` | Deja una sola correcta o asume el modo múltiple |
| La tarjeta no tiene reverso | El separador `---` está mal puesto o falta contenido | Revisa el bloque y separa las tarjetas con `---` |
| La imagen no aparece | Ruta incorrecta, URL bloqueada o sin conexión | Usa una URL `https://` directa o incluye la imagen local en `images/` |
| El crédito de la imagen falta | La imagen web no tiene atribución | Añade `credit="Fuente y licencia"` en `:::figure` |
| El índice está vacío | No hay H2 | Convierte las secciones principales en `##` |
| Los números salen duplicados | El encabezado incluye `1.` o `2.1` | Quita la numeración manual |
| El HTML aparece como texto | soffia no renderiza HTML | Sustituye por Markdown o bloques |
| El progreso se reinicia | Cambió el `id` del deck, del quiz o de la tarjeta | Mantén IDs estables o añade IDs explícitos |

## Checklist de entrega

- [ ] El archivo empieza por `---` y tiene frontmatter completo.
- [ ] `id` es estable, en minúsculas y con guiones.
- [ ] Hay un solo H1 y coincide con `title`.
- [ ] Las secciones son H2 y no llevan numeración manual.
- [ ] Las subsecciones son H3 y están dentro de un H2.
- [ ] Todos los bloques `:::` están cerrados.
- [ ] Hay keypoints, quizzes, flashcards, Q&A y referencias suficientes.
- [ ] Cada quiz tiene pregunta, opciones, una o más correctas y explicación.
- [ ] Cada tarjeta tiene frente y reverso.
- [ ] Las referencias son verificables y usan `https://`.
- [ ] Hay al menos una imagen web relevante cuando el tema lo permite, con `alt`, pie y crédito.
- [ ] Las imágenes son URLs web directas `https://` o archivos locales aportados por el usuario.
- [ ] Cada imagen tiene `alt`; las figuras web tienen pie y crédito.
- [ ] Ningún encabezado, bloque, tarjeta, paso, opción o referencia queda vacío.
- [ ] No se ha generado ninguna imagen nueva.
- [ ] El validador termina con `0 errores`.
- [ ] La entrega incluye el `.md` y, si hay imágenes locales, la carpeta `images/` completa.
- [ ] Si se usa MCP, los archivos se guardaron con `soffia_save_decks` en el destino elegido y con nombres `soffia-<nombre>-<id>.md`.

Para la especificación completa de campos, atributos, IDs y validación, lee `reference/format.md`.
