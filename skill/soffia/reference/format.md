# Formato de decks soffia

Especificación del Markdown que entiende soffia. Está pensada para que un agente pueda generar un deck completo sin leer el código de la app.

- **Versión del formato:** 1.0
- **App:** soffia 0.1
- **Idioma de la interfaz:** español
- **Validador:** `scripts/validate.mjs` (sin dependencias)

## 1. Estructura de una entrega

Un deck es una carpeta con un archivo Markdown y, opcionalmente, una carpeta de imágenes locales. Por defecto, las imágenes pueden ser URLs web directas:

```text
mi-tema/
├── seminario.md
└── images/            (opcional, solo si hay archivos locales)
    ├── figura-1.jpg
    ├── figura-2.png
    └── portada.jpg
```

Reglas:

- El Markdown puede llamarse `seminario.md`, `mi-tema.md` o cualquier nombre con extensión `.md`, `.markdown` o `.txt`.
- Las imágenes web se referencian con una URL `https://` directa al archivo.
- Las imágenes locales se referencian con rutas relativas al archivo Markdown: `images/figura-1.jpg`.
- Para conservar las rutas locales, importa la carpeta completa en soffia. Si importas solo el `.md`, las imágenes locales no estarán disponibles.
- No generes imágenes: usa fuentes web verificables o archivos que aporte el usuario.
- No hace falta un archivo de configuración adicional: todo va en el frontmatter y en el cuerpo Markdown.

## 2. Frontmatter

El archivo debe empezar en la primera línea con `---`. Después va un objeto YAML y una línea de cierre `---`.

```yaml
---
id: impetigo
title: Impétigo
subtitle: Infección cutánea bacteriana superficial
description: Seminario clínico para reconocer, tratar y prevenir el impétigo en atención primaria y pediatría.
tags: [Dermatología, Pediatría, Infectología]
author: soffia
language: es
estimatedMinutes: 32
cover: images/lesion-costras.svg
---
```

### Campos

| Campo | Tipo | Obligatorio | Comportamiento |
| --- | --- | --- | --- |
| `id` | texto | Muy recomendable | Identificador estable del deck. Se usa para actualizar el deck y conservar el progreso. Si falta, la app lo deriva del título. Usa un slug seguro: letras, números, guiones, puntos o guiones bajos (máximo 64), sin barras, espacios ni `..`. |
| `title` | texto | Muy recomendable | Título del deck. Tiene prioridad sobre el H1. Si falta, se usa el H1 o el nombre del archivo. |
| `subtitle` | texto | No | Frase breve que aparece bajo el título en la portada. |
| `description` | texto | Recomendable | Resumen para la biblioteca. El validador avisa si falta. |
| `tags` | lista | Recomendable | Etiquetas de clasificación. Usa `[Dermatología, Pediatría]`; también se acepta una cadena separada por comas, pero el validador prefiere lista. |
| `author` | texto | No | Autor o entidad que firma el deck. |
| `language` | texto | Recomendable | Código de idioma, por ejemplo `es`. Por defecto, `es`. |
| `estimatedMinutes` | número | Recomendable | Minutos estimados de lectura. Debe ser un entero positivo. Si falta, se calcula a partir de las palabras. |
| `cover` | texto | No | URL `https://` directa o ruta local de la imagen de portada. |

Los campos desconocidos se ignoran. No los uses para guardar datos que la app necesite.

### Reglas de YAML

- El bloque debe empezar en la primera línea del archivo. Una línea vacía antes de `---` impide que se lea el frontmatter.
- Usa YAML simple: escalares, listas en línea y listas con guiones. El validador implementa un subconjunto; la app usa un parser YAML completo, pero conviene no depender de funciones exóticas.
- Entre comillas dobles los valores que contengan `:` u otros caracteres especiales.
- No uses tabulaciones para indentar.
- `tags` en línea es lo más legible: `tags: [Dermatología, Pediatría]`.
- `id` debe ser un slug estable: minúsculas, números y guiones. Ejemplos: `impetigo`, `insuficiencia-cardiaca`, `tema-2026`.

### Identidad y progreso

El `id` del frontmatter es la clave del deck. Si vuelves a importar un archivo con el mismo `id`, soffia actualiza el deck existente en lugar de crear un duplicado. El progreso se conserva para las secciones, quizzes y tarjetas cuyos IDs sigan existiendo.

Si cambias el `id`, se crea un deck nuevo y el progreso anterior queda asociado al deck viejo.

## 3. Cuerpo y jerarquía

```md
# Título del deck

Introducción y contenido de portada.

:::keypoints
- Idea uno.
- Idea dos.
:::

## Primera sección

Texto de la sección.

### Primera subsección

Texto de la subsección.

## Segunda sección

Texto de la sección.
```

### H1

- El **primer H1** se usa como título del documento y se separa del cuerpo.
- Debe haber un solo H1. Si hay más, los siguientes se tratan como secciones H2 y el validador avisa.
- El `title` del frontmatter tiene prioridad sobre el H1. Lo ideal es que coincidan.

### H2

- Cada H2 es una **sección principal**.
- La app la muestra como acordeón, la numera automáticamente (`01`, `02`…) y la añade al índice lateral.
- El índice lateral muestra Inicio y las secciones H2. Las subsecciones no aparecen como entradas independientes; viven dentro de su sección.
- Los acordeones están abiertos por defecto. El estado se guarda en el navegador.

### H3

- Cada H3 es una **subsección** de la última H2.
- La app la muestra como acordeón dentro de la sección y la numera `01.1`, `01.2`…
- Un H3 antes del primer H2 queda fuera de la estructura de secciones y el validador avisa.

### H4–H6

- Se renderizan como encabezados internos dentro del contenido.
- No crean acordeones ni entradas del índice.
- Se pueden usar para subdividir una sección o una subsección, pero no abuses de ellos.

### Numeración

**No escribas números en los encabezados.** La app ya numera secciones, subsecciones y pasos.

```md
## Tratamiento        ← correcto
## 1. Tratamiento     ← incorrecto: se verá “01 1. Tratamiento”
```

### IDs de encabezado

Los encabezados reciben un ID automático a partir del texto:

- se eliminan acentos y diacríticos;
- se pasa a minúsculas;
- los espacios y signos se convierten en guiones;
- se recorta a 80 caracteres;
- si hay colisiones, se añade `-2`, `-3`…

También puedes fijar un ID explícito:

```md
## Tratamiento {#tratamiento}
### Casos especiales {#casos-especiales}
```

El ID se usa para los enlaces internos y para guardar el estado de lectura. Si cambias el texto de un encabezado, cambia su ID automático y el progreso de esa sección puede perderse. Usa un ID explícito si necesitas estabilidad.

### Contenido de portada

Todo lo que va entre el H1 y el primer H2 es el contenido de introducción: párrafos, keypoints, callouts, imágenes, etc. Es un buen lugar para:

- una introducción breve;
- los objetivos de aprendizaje;
- un `:::keypoints` con las ideas que hay que retener;
- una figura o portada.

## 4. Markdown permitido

soffia renderiza Markdown con `markdown-it` en modo seguro (`html: false`).

Funciona:

- párrafos, **negrita**, *cursiva*, `código en línea`, ~~tachado~~;
- listas ordenadas y no ordenadas;
- enlaces externos e internos;
- tablas con cabecera y separador;
- blockquotes;
- bloques de código con o sin lenguaje;
- imágenes Markdown;
- reglas horizontales `---` (fuera de bloques de tarjetas).

No funciona:

- **HTML crudo.** Se escapa y se ve como texto. El validador avisa.
- **Listas de tareas interactivas** en el cuerpo normal. Los `- [ ]` / `- [x]` solo se interpretan dentro de `:::quiz`.
- **Anexos, notas al pie y extensiones** que no estén en Markdown estándar. Si necesitas una nota, usa un callout.

Notas de renderizado:

- Un salto de línea simple dentro de un párrafo se convierte en espacio. Usa una línea en blanco para separar párrafos.
- Los enlaces `http(s)` se abren en una pestaña nueva.
- Los enlaces internos (`#id`) hacen scroll al elemento correspondiente.
- Las tablas se envuelven para poder desplazarse horizontalmente en pantallas pequeñas.
- Los bloques de código muestran un botón para copiar.

### Normalización automática

Al importar, soffia normaliza algunos artefactos típicos de ChatGPT y de otros editores:

- elimina BOM y caracteres de ancho cero;
- convierte `[Image: descripción](url)` en `![descripción](url)`;
- convierte un enlace suelto a una imagen en una imagen Markdown;
- elimina favicons de Google que no aportan contenido;
- corrige listas escapadas como `1\. Texto`;
- normaliza saltos de línea y espacios finales.

No depende de esta normalización para escribir un deck correcto: es una red de seguridad.

## 5. Bloques `:::`

La sintaxis general es:

```md
:::nombre{atributo=valor} Título opcional
Contenido del bloque.
:::
```

Reglas:

- La apertura debe empezar por `:::` y un nombre válido.
- Los atributos van entre llaves `{}` y son opcionales.
- El título en línea es opcional y solo lo usan algunos bloques.
- El cierre es una línea que contiene exactamente `:::` (se permiten espacios alrededor).
- Los bloques se pueden anidar si el bloque exterior lo admite. En la práctica, anida solo dentro de `callout`, `note`, `quote`, `grid` y `steps`.
- No anides quizzes, flashcards, Q&A, referencias, keypoints, galerías ni figuras dentro de otros bloques. Están pensados para ir a nivel de sección.
- Los encabezados dentro de un bloque no crean secciones ni subsecciones del documento.
- Un bloque desconocido se muestra como contenido sin formato y genera un aviso.
- Un bloque sin cierre genera un aviso y puede absorber el resto del documento.

Los bloques disponibles son:

| Bloque | Para qué sirve |
| --- | --- |
| `callout` | Nota, consejo, advertencia, idea clave, perla o cita. |
| `note` | Alias de callout con variante `info`. |
| `quote` | Alias de callout con variante `quote`. |
| `grid` | Distribuir bloques en 1–3 columnas. |
| `steps` | Procedimiento numerado automáticamente. |
| `quiz` | Pregunta de opción múltiple con corrección. |
| `flashcards` | Tarjetas para repaso espaciado. |
| `qa` | Preguntas abiertas con respuesta revelable. |
| `references` | Lista de fuentes verificables. |
| `keypoints` | Lista de ideas clave. |
| `gallery` | Varias imágenes con lightbox. |
| `figure` | Una imagen con pie y crédito. |

## 6. `callout`, `note` y `quote`

### `callout`

```md
:::callout{type=why} ¿Por qué aparecen las costras?
El exudado se seca y forma una costra melicérica.
:::
```

Atributos:

| Atributo | Valores | Comportamiento |
| --- | --- | --- |
| `type` / `variant` | `why`, `tip`, `warning`, `key`, `info`, `pearl`, `quote` | Variante visual e icono. Si no se indica, `info`. |
| `title` | texto | Título explícito. Tiene prioridad sobre el título en línea. |
| `collapsible` | `true` / `false` / `1` / `0` | Si es verdadero, el callout se puede plegar. Por defecto, no. |

El título en línea va después de los atributos:

```md
:::callout{type=tip} Un consejo práctico
Texto.
:::
```

Si no hay título, se usa el título por defecto de la variante:

| Variante | Título por defecto |
| --- | --- |
| `why` | ¿Por qué? |
| `tip` | Consejo |
| `warning` | Atención |
| `key` | Idea clave |
| `info` | Nota |
| `pearl` | Perla |
| `quote` | Cita |

El contenido se interpreta como bloques: puede incluir párrafos, listas, tablas, imágenes, otro callout, un grid o pasos.

### `note`

```md
:::note
Texto de la nota.
:::
```

Equivale a `:::callout{type=info}`. También acepta `type`, `title` y `collapsible`.

### `quote`

```md
:::quote
Una cita textual o una idea que quieres destacar.
:::
```

Equivale a `:::callout{type=quote}`. Si no hay título, se muestra “Cita”.

## 7. `grid`

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

- `columns` admite de 1 a 3 columnas. Por defecto, 2.
- El contenido se interpreta como bloques, igual que en un callout.
- Es útil para comparar dos ideas, no para maquetar texto largo.
- En pantallas pequeñas las columnas se apilan.

## 8. `steps`

```md
:::steps
### Confirma el diagnóstico
Describe el primer paso.

### Evalúa la extensión
Describe el segundo paso.

### Elige la vía
Describe el tercer paso.
:::
```

- Cada paso se introduce con un H3 (`###`).
- La app numera los pasos automáticamente (`01`, `02`…).
- Si el título del paso empieza por `1.`, `2.`, etc., el parser elimina ese prefijo para no duplicar la numeración.
- El contenido de cada paso se interpreta como bloques: puede incluir listas, tablas, imágenes, callouts o código.
- Si no hay ningún H3, el bloque se muestra como un paso sin título; el validador avisa.
- El texto anterior al primer H3 no se muestra; muévelo fuera del bloque.

## 9. `quiz`

```md
:::quiz{id=q-diagnostico}
**Pregunta:** ¿Cuál es el diagnóstico más probable?

- [ ] Herpes simple
- [x] Impétigo no ampolloso
- [ ] Celulitis

> **Explicación:** Las costras melicéricas y la localización periorificial son típicas del impétigo no ampolloso.
:::
```

### Estructura

- La pregunta es todo el texto anterior a la primera opción.
- Las opciones son líneas con `- [ ]` (incorrecta) o `- [x]` (correcta). También se aceptan `*` y `+` como marcadores.
- La explicación es todo el texto posterior a la última opción.
- La app elimina prefijos como `**Pregunta:**` y `**Explicación:**`, y los marcadores de blockquote (`>`) al principio de la explicación.
- La pregunta y la explicación se renderizan como Markdown; pueden incluir imágenes, tablas, listas y código.
- Las opciones se renderizan con Markdown en línea.

### Atributos

| Atributo | Tipo | Comportamiento |
| --- | --- | --- |
| `id` | texto | ID estable del quiz. Si falta, se genera `quiz-<hash>` a partir de la pregunta y las opciones. |
| `multiple` | `true` / `false` / `1` / `0` | Fuerza el modo de respuesta múltiple. Si hay más de una opción `[x]`, se activa automáticamente. |
| `difficulty` | número 1–5 | Metadato de dificultad. El validador avisa si está fuera de rango. |
| `tags` | texto | Etiquetas separadas por comas, por ejemplo `tags=diagnostico,tratamiento`. |

### Reglas de calidad

- Al menos dos opciones; mejor 3–5.
- Al menos una opción correcta. Si no hay ninguna, el validador da error.
- Si hay varias correctas, el quiz se marca como múltiple automáticamente.
- Añade una explicación: refuerza el aprendizaje y el validador la recomienda.
- Evita opciones duplicadas y preguntas trampa.
- Usa un `id` explícito si quieres conservar el progreso al editar la pregunta.
- No anides otros bloques dentro del quiz; su contenido se trata como texto Markdown, no como directivas.

## 10. `flashcards`

```md
:::flashcards{id=fc-tratamiento}
### ¿Cuál es el tratamiento de primera línea?
Mupirocina tópica en lesiones localizadas.

---
### ¿Cuándo se usa tratamiento oral?
En enfermedad extensa o con factores de riesgo.
:::
```

### Estructura

- Cada tarjeta se separa con una línea `---`.
- El frente es el encabezado `###` de la tarjeta.
- El reverso es todo el contenido que va después del encabezado.
- Si una tarjeta no tiene encabezado, se puede usar `frente || reverso` en una sola línea o dejar la primera línea como frente y el resto como reverso.
- El frente y el reverso se renderizan como Markdown.
- Las tarjetas se muestran en una vista previa dentro del lector y en la sesión de repaso espaciado.

### IDs

- El bloque puede tener un `id` propio: `:::flashcards{id=fc-tema}`.
- Cada tarjeta recibe un ID automático a partir de `frente + reverso`. Si cambias el texto, cambia el ID y esa tarjeta pierde su progreso.
- Para fijar el ID de una tarjeta, añade `{#id}` al final del encabezado:

```md
:::flashcards
### ¿Qué es la mupirocina? {#card-mupirocina}
Antibiótico tópico.
:::
```

### Cuidado con `---`

El separador de tarjetas es una línea `---`. Si necesitas una regla horizontal dentro de una tarjeta, evita `---` o ponla dentro de un bloque de código. Un `---` suelto divide la tarjeta.

## 11. `qa`

```md
:::qa{id=qa-dudas}
### ¿El impétigo siempre necesita antibiótico?
No. En lesiones localizadas, el tratamiento tópico suele ser suficiente.

---
### ¿Cuándo hay que derivar?
Cuando hay afectación extensa, síntomas sistémicos o factores de riesgo.
:::
```

`:::qa` usa exactamente el mismo parser que `:::flashcards`, pero el frente es la pregunta y el reverso es la respuesta. En la app:

- se muestran como preguntas con respuesta revelable;
- se registra cuántas respuestas se han revelado;
- se pueden practicar en una sesión de preguntas abiertas.

Usa preguntas que alguien se haría de verdad, no definiciones disfrazadas. La respuesta debe ser breve y directa.

## 12. `keypoints`

```md
:::keypoints
- Es una infección superficial y contagiosa.
- La forma no ampollosa se caracteriza por costras melicéricas.
- El tratamiento tópico basta en lesiones localizadas.
:::
```

- Solo se interpretan los elementos de lista (`-`, `*`, `+` o `1.`).
- El texto que no sea una lista se ignora; el validador avisa.
- Se recomiendan de 3 a 8 puntos. Más de 10 genera un aviso.
- Es ideal al principio del deck, después de la introducción.
- No anides otros bloques.

## 13. `references`

```md
:::references
1. [CDC — Impetigo](https://www.cdc.gov/group-a-strep/about/impetigo.html) — Guía clínica y medidas de control.
2. [NICE — Impetigo: antimicrobial prescribing](https://www.nice.org.uk/guidance/ng153) — Recomendaciones de tratamiento.
3. [OMS — Infecciones cutáneas](https://www.who.int/) — Contexto y prevención.
:::
```

### Estructura

- Cada referencia es un elemento de lista, numerado o con viñeta.
- El título se toma del texto del enlace.
- La URL se toma del destino del enlace.
- La nota es el texto que queda después del enlace; se limpian guiones, dos puntos y puntos iniciales.
- Las líneas de continuación se añaden a la nota de la referencia anterior.
- La app numera las referencias automáticamente (`01`, `02`…).

### Reglas

- Usa `https://` siempre que sea posible.
- Verifica que la URL existe y que el título corresponde.
- No inventes referencias, DOI ni fechas.
- Añade una nota que explique qué aporta la fuente.
- Evita URLs duplicadas; el validador avisa.
- El validador acepta `http(s)` y `mailto:`, pero la app solo hace clicables los enlaces `http(s)`.
- Si no hay enlace, la referencia se muestra como texto y el validador avisa.

## 14. `gallery`

> Las URLs de imagen de los ejemplos son ilustrativas. Sustitúyelas por URLs `https://` reales y verificables, con crédito.

```md
:::gallery{columns=2}
![Radiografía con consolidación](https://upload.wikimedia.org/wikipedia/commons/example/radiografia.jpg "Figura 1. Consolidación lobar")
![TC axial de tórax](https://upload.wikimedia.org/wikipedia/commons/example/tc-torax.jpg "Figura 2. Patrón neumónico")
:::
```

- Solo se interpretan imágenes Markdown. El texto que no sea una imagen se ignora y genera un aviso.
- `columns` admite de 1 a 4 columnas. Por defecto, 3.
- Cada imagen se abre en el lightbox.
- El `alt` describe la imagen; el título entre comillas es el pie.
- Para imágenes web, añade la fuente y la licencia en el pie o en una figura.
- Para una sola imagen, usa `:::figure`.

## 15. `figure`

```md
:::figure{src="https://upload.wikimedia.org/wikipedia/commons/example/algoritmo.png" alt="Algoritmo de decisión terapéutica" caption="Figura 3. Elección del tratamiento" credit="Fuente: Wikimedia Commons, CC BY-SA 4.0"}
:::
```

También se puede escribir la imagen dentro:

```md
:::figure
![Algoritmo de decisión terapéutica](https://upload.wikimedia.org/wikipedia/commons/example/algoritmo.png "Figura 3. Elección del tratamiento")
:::
```

Atributos:

| Atributo | Comportamiento |
| --- | --- |
| `src` | Ruta de la imagen. Tiene prioridad sobre la imagen interior. |
| `alt` | Texto alternativo. Si falta, se usa el `alt` de la imagen interior. |
| `caption` | Pie de foto. Si falta, se usa el título de la imagen interior. |
| `credit` | Crédito o atribución. Se muestra bajo el pie. |

- Si no hay `src` ni una imagen interior, el bloque no se renderiza y el validador da error.
- Si hay varias imágenes, solo se usa la primera; el validador avisa.
- El texto que no sea una imagen se ignora; el validador avisa.
- La imagen se abre en el lightbox.
- Si la imagen es web, `credit` debe indicar fuente y licencia.

## 16. Imágenes Markdown

### Imagen suelta

```md
![Descripción de la lesión](images/lesion.svg "Pie de la figura")
```

Si el párrafo contiene solo esa imagen, se renderiza como figura con pie. El texto entre corchetes es el `alt`; el título entre comillas es el pie.

### Varias imágenes consecutivas

```md
![Primera](images/uno.svg "Pie uno")
![Segunda](images/dos.svg "Pie dos")
```

Si todas las líneas no vacías del párrafo son imágenes, se crea una galería automática de 3 columnas.

### Imagen dentro de texto

```md
Texto antes ![Esquema](images/esquema.svg) texto después.
```

Se renderiza como imagen en línea. Para un control fino del pie y el crédito, usa `:::figure`.

### Prefijo `image:`

El parser elimina el prefijo `image:` del texto alternativo:

```md
![image: Lesión con costras](https://upload.wikimedia.org/wikipedia/commons/example/lesion.jpg)
```

El `alt` final es “Lesión con costras”.

### Política de imágenes web

- Usa una URL directa al archivo, no a la página del artículo.
- Verifica que la URL responde y que la licencia permite el uso.
- Cita fuente y licencia en `credit` o en el pie.
- Evita URLs firmadas, temporales o con tokens que caducan.
- soffia no descarga imágenes remotas: las enlaza. Sin conexión no se verán.
- soffia aplica `referrerpolicy="no-referrer"` y muestra un fallback si la imagen falla.
- No generes SVGs ni imágenes nuevas. Si el deck debe funcionar offline, usa archivos locales aportados por el usuario.

### Formatos y rutas

- Formatos detectados para conversión automática: `avif`, `gif`, `jpeg`, `jpg`, `png`, `svg`, `webp`.
- Para un deck offline, usa rutas relativas dentro de la carpeta del deck.
- Evita nombres duplicados en carpetas distintas: la app resuelve por ruta y también por nombre base; un nombre repetido puede ser ambiguo.
- No uses rutas absolutas (`C:\...`, `/...`) ni rutas con espacios sin codificar. El validador avisa.
- Las URLs `https://` funcionan online; en un archivo único sin conexión no se verán. Si el deck debe ser offline, usa imágenes locales.
- Los `data:` URLs funcionan, pero hinchan el Markdown y complican el mantenimiento. Úsalos solo para casos excepcionales.
- Las imágenes locales se guardan como Blobs en IndexedDB. Las remotas se enlazan y no se almacenan. Si el navegador no permite IndexedDB, el deck puede guardarse sin imágenes locales y se muestra un aviso.
- Si una imagen remota falla, la app muestra un aviso con enlace al original.

### Texto alternativo y pie

- `alt`: describe lo que se ve y para qué sirve. No repitas “imagen de”.
- `caption`: contextualiza, numera o interpreta la imagen.
- `credit`: atribuye la fuente o indica “Elaboración propia”.
- Una imagen sin `alt` genera un aviso de accesibilidad.

## 17. IDs y progreso

### IDs del deck

- `id` del frontmatter: clave estable del deck.
- Si falta, se deriva del título con `slugify`.
- Reimportar el mismo `id` actualiza el deck y conserva el progreso de los elementos que mantengan su ID.
- Si dos archivos de la misma importación comparten `id`, el segundo recibe un sufijo `-2`, `-3`…

### IDs de sección

- Se derivan del texto del encabezado.
- Puedes fijarlos con `{#id}`.
- Se usan para el índice, los enlaces internos y el estado de “sección leída”.
- Cambiar el texto de un encabezado cambia su ID automático y puede perder el progreso de lectura.

### IDs de quiz

- `:::quiz{id=q-diagnostico}` fija el ID.
- Sin `id`, se genera `quiz-<hash>` a partir de la pregunta y las opciones.
- El progreso del quiz (intentos y aciertos) se guarda por ID.
- Cambiar la pregunta o las opciones cambia el hash y reinicia el progreso de ese quiz.

### IDs de tarjetas y Q&A

- El bloque tiene su propio `id`, pero el progreso de repaso se guarda por tarjeta.
- Cada tarjeta recibe `card-<hash>` a partir de frente y reverso.
- Puedes fijar el ID con `### Frente {#card-id}`.
- Cambiar el texto de una tarjeta sin ID explícito reinicia su progreso.
- En Q&A, el ID de la tarjeta es también la clave del progreso de “revelada”.

### Reglas de slugs

Formato recomendado:

- minúsculas;
- números;
- guiones entre palabras;
- sin acentos, espacios ni signos.

Ejemplos válidos: `impetigo`, `q-diagnostico`, `card-mupirocina`, `fc-tratamiento`.

El parser acepta IDs explícitos con letras, números, guiones y guiones bajos (`[\w-]+`), pero el validador avisa si no siguen el formato recomendado.

### Colisiones

- Dentro de un documento, los IDs repetidos reciben `-2`, `-3`…
- Entre decks de una misma importación, los IDs de deck repetidos reciben `-2`, `-3`…
- Las colisiones pueden separar el progreso. Mantén IDs únicos y estables.

## 18. Importación, assets y almacenamiento

### Formas de importar

- **Arrastrar y soltar** archivos o una carpeta.
- **Abrir Markdown** con el selector de archivos.
- **Importar carpeta** conservando la estructura relativa.
- **Pegar** Markdown desde el portapapeles.
- **Desde URL**: descarga el Markdown y resuelve imágenes relativas contra la URL de origen.

### Cómo se emparejan las imágenes

- Se leen todas las imágenes referenciadas en el Markdown y en la portada.
- Se comparan con los archivos importados por ruta relativa a la carpeta del `.md`.
- También se acepta el nombre base del archivo.
- Solo se guardan las imágenes referenciadas; el resto se ignora.
- Si importas una carpeta, las rutas relativas se conservan.
- Si importas solo el `.md`, las imágenes locales no están disponibles.

### Importación desde URL

- La URL debe ser `http` o `https`.
- El servidor debe permitir CORS; si no, la importación falla.
- Las imágenes relativas se resuelven contra la URL del documento.
- Para un deck offline, descarga el Markdown y las imágenes y usa rutas locales.

### Reimportación

- Mismo `id` de deck: se actualiza el deck existente.
- Se conservan `createdAt`, `lastOpenedAt` y los assets anteriores que no se reemplacen.
- El progreso se conserva para los IDs que sigan existiendo.
- Si cambias el `id`, se crea otro deck.

### Almacenamiento

- Los decks, assets y progreso se guardan en el navegador con IndexedDB.
- Si IndexedDB falla, se usa localStorage como respaldo, pero **sin assets**.
- No hay backend, cuentas ni sincronización en la nube.
- Borrar los datos del sitio en el navegador elimina decks, imágenes y progreso.
- El deck de ejemplo se carga automáticamente si la biblioteca está vacía y no se ha cargado antes. Si lo borras, se recuerda y no se vuelve a sembrar solo.

## 19. Validador

El validador es un script de Node sin dependencias. Se puede ejecutar dentro del proyecto o desde una skill instalada.

### Uso

```bash
node scripts/validate.mjs <archivo-o-carpeta...>
```

Ejemplos:

```bash
node scripts/validate.mjs seminario.md
node scripts/validate.mjs ejemplos/
node scripts/validate.mjs --strict --json ejemplos/
```

En este repositorio:

```bash
npm run validate
npm run validate:all
```

### Opciones

| Opción | Efecto |
| --- | --- |
| `--strict` | Los avisos también hacen fallar la validación. Útil en CI. |
| `--json` | Imprime un informe JSON con archivos, estadísticas, errores y avisos. |
| `--allow-plain` | Permite Markdown sin frontmatter; avisa en lugar de fallar. |
| `--no-assets` | No comprueba que las imágenes locales existan. |
| `--quiet`, `-q` | Solo muestra errores y el resumen. |
| `--help`, `-h` | Muestra la ayuda. |
| `--version`, `-v` | Muestra la versión. |

### Códigos de salida

| Código | Significado |
| --- | --- |
| `0` | Sin errores. Si hay avisos y no se usó `--strict`, sigue siendo éxito. |
| `1` | Hay errores, hay avisos con `--strict`, o no se encontraron archivos. |
| `2` | Error de uso: opción desconocida, ruta inexistente, etc. |

### Qué comprueba

- frontmatter presente y legible;
- `id`, `title`, `description`, `tags`, `language`, `estimatedMinutes`;
- al menos un H2;
- H3 antes del primer H2;
- numeración manual en encabezados H1–H3;
- IDs explícitos repetidos o con formato no recomendado;
- bloques desconocidos, sin cierre o mal anidados;
- callouts con variantes o atributos inválidos;
- grids y galerías con columnas fuera de rango;
- pasos sin título o sin contenido;
- quizzes sin opciones, sin correcta, con opciones duplicadas o sin explicación;
- tarjetas sin frente o sin reverso;
- referencias sin URL, con URL duplicada, `http://` o URL inválida;
- keypoints vacíos o con texto que no es lista;
- figuras sin `src`, sin `alt` o sin pie;
- imágenes inexistentes, absolutas, con espacios o sin `alt`; URLs remotas inseguras (`http://`);
- HTML crudo.

### Interpretación del informe

El informe humano muestra, por archivo:

```text
15 secciones · 13 subsecciones · 9 quizzes · 12 tarjetas · 8 preguntas · 6 referencias · 4 imágenes · 2636 palabras
OK
```

Y al final:

```text
1 archivo · 0 errores · 0 avisos
```

Los avisos no siempre bloquean la importación, pero suelen indicar problemas de calidad o de progreso. Corrige los que tengan sentido antes de entregar.

## 20. Errores comunes y cómo resolverlos

| Error o aviso | Causa | Solución |
| --- | --- | --- |
| `Falta el frontmatter YAML` | El archivo no empieza por `---` o no cierra el bloque | Añade el frontmatter en la primera línea y ciérralo con `---`. |
| `Falta id en el frontmatter` | No hay `id` | Añade un slug estable, por ejemplo `id: mi-tema`. |
| `El id "..." no es válido` | El id tiene barras, espacios, `..` o un nombre reservado | Usa letras, números, guiones, puntos o guiones bajos (máximo 64), sin barras. |
| `El title del frontmatter no coincide con el H1` | Los títulos son distintos | Usa el mismo texto o confía en el frontmatter y corrige el H1. |
| `No hay secciones H2` | Todo el contenido está en H1 o en bloques | Convierte las partes principales en `##`. |
| `Hay una subsección H3 antes de la primera sección H2` | Falta una H2 contenedora | Mueve el H3 debajo de una H2 o conviértelo en H2. |
| `El encabezado incluye numeración manual` | Escribiste `## 1. Tema` | Quita el prefijo; la app numera sola. |
| `El bloque :::x no tiene cierre :::` | Falta la línea de cierre | Añade `:::` en su propia línea. |
| `Bloque desconocido :::x` | Nombre mal escrito o no soportado | Usa uno de los bloques documentados. |
| `El quiz no tiene opciones` | No hay líneas `- [ ]` / `- [x]` | Añade al menos dos opciones con ese formato. |
| `El quiz no tiene ninguna opción correcta` | Ninguna opción está marcada con `[x]` | Marca la correcta. |
| `El quiz no tiene explicación` | Falta el texto posterior a las opciones | Añade una explicación breve. |
| `La tarjeta no tiene reverso` | El separador `---` cortó la tarjeta o falta contenido | Revisa la estructura y añade el reverso. |
| `No se encuentra la imagen` | Ruta incorrecta, imagen no incluida o URL caída | Usa `images/...` con la carpeta completa o una URL `https://` directa. |
| `La imagen usa http://` | El recurso no está cifrado | Cambia a `https://` o usa una imagen local. |
| `La figura usa una imagen web y no indica crédito` | Falta atribución | Añade `credit="Fuente y licencia"`. |
| `La imagen no tiene texto alternativo` | Falta el `alt` | Añade una descripción entre corchetes. |
| `El HTML no se renderiza` | Usaste etiquetas HTML | Sustituye por Markdown o bloques. |
| `El id ... ya se usó` | Dos elementos comparten ID | Cambia uno; la app añadirá un sufijo, pero el progreso puede separarse. |
| `La referencia no tiene URL` | La lista no usa enlaces | Escribe `[Título](https://...)`. |
| `El texto anterior al primer ### dentro de :::steps` | Hay contenido antes del primer paso | Muévelo fuera del bloque. |
| `El bloque termina con un separador ---` | Hay un `---` final sin tarjeta | Elimínalo. |

## 21. Ejemplo mínimo completo

Este deck pasa el validador sin errores ni avisos:

```md
---
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
- La práctica se escribe con bloques `:::`.
:::

## Concepto

Una idea se explica primero con palabras y después se comprueba con una pregunta.

:::quiz{id=q-concepto}
**Pregunta:** ¿Qué estructura identifica una sección principal?

- [ ] Un H1.
- [x] Un H2.
- [ ] Un bloque `:::`.

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
```

## 22. Checklist de formato

- [ ] El archivo empieza por `---` en la primera línea.
- [ ] El frontmatter tiene `id`, `title`, `description`, `tags`, `language` y `estimatedMinutes`.
- [ ] Hay un solo H1.
- [ ] Las secciones principales son H2.
- [ ] Las subsecciones son H3 y están dentro de una H2.
- [ ] No hay numeración manual en los encabezados.
- [ ] Todos los bloques `:::` están cerrados.
- [ ] Los quizzes tienen opciones, correcta y explicación.
- [ ] Las tarjetas tienen frente y reverso.
- [ ] Las referencias son verificables y usan `https://`.
- [ ] Las imágenes son URLs web directas `https://` o archivos locales aportados por el usuario.
- [ ] Las figuras web indican fuente y licencia en `credit`.
- [ ] No se ha generado ninguna imagen nueva.
- [ ] El validador termina con `0 errores`.
