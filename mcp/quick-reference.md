# soffia — guía portable para modelos

soffia convierte un Markdown con frontmatter en un deck de lectura y estudio. Esta guía es la versión corta que puede consumir cualquier modelo o cliente MCP. La especificación completa está en `skill/soffia/reference/format.md`.

## Contrato de salida

Entrega un archivo `.md` con frontmatter YAML. Las imágenes pueden ser URLs web `https://` directas o archivos locales aportados por el usuario. No generes imágenes, SVGs ni placeholders.

```md
---
id: tema-estable
title: Tema del deck
subtitle: Una frase de contexto
description: Qué aprende la persona y para qué le sirve.
tags: [Tema, Nivel]
author: Tu nombre
language: es
estimatedMinutes: 20
# cover: https://… (opcional; URL https directa con crédito)
---

# Tema del deck

Introducción breve.

:::keypoints
- Idea uno.
- Idea dos.
- Idea tres.
:::

## Primera sección

Texto explicativo.

### Un matiz importante

Texto de la subsección.

## Práctica

:::quiz{id=q-idea-principal}
**Pregunta:** ¿Cuál es la idea principal?

- [ ] Una opción incorrecta.
- [x] La opción correcta.
- [ ] Otra opción incorrecta.

> **Explicación:** La opción correcta resume el concepto porque…
:::

:::flashcards{id=fc-conceptos}
### ¿Qué es el concepto clave?
Una definición breve.

---

### ¿Para qué sirve?
Para resolver este tipo de problema.
:::

## Referencias

:::references
1. [Fuente verificable](https://example.com) — Qué aporta.
:::
```

## Reglas estructurales

1. El archivo empieza en la primera línea con `---` y cierra el frontmatter con `---`.
2. Hay **un solo H1**, que coincide con `title`.
3. Cada **H2** es una sección principal y aparece en el índice.
4. Cada **H3** es una subsección de la H2 anterior.
5. No escribas números en los encabezados: la app numera sola (`01`, `01.1`).
6. No uses HTML: se escapa. Usa Markdown y bloques `:::`.
7. Cierra todos los bloques con una línea `:::`.
8. No anides quizzes, flashcards, Q&A, referencias, keypoints, galerías ni figuras. Solo `callout`, `note`, `quote`, `grid` y `steps` admiten otros bloques.
9. Los encabezados dentro de un bloque no crean secciones del documento.
10. Usa IDs estables en quizzes y tarjetas si quieres conservar el progreso.

## Frontmatter

| Campo | Obligatorio | Nota |
| --- | --- | --- |
| `id` | Muy recomendable | Slug estable: minúsculas, números y guiones. |
| `title` | Muy recomendable | Título del deck; prioridad sobre el H1. |
| `description` | Recomendable | Resumen para la biblioteca. |
| `tags` | Recomendable | Lista: `[Dermatología, Pediatría]`. |
| `language` | Recomendable | Código de idioma, por ejemplo `es`. |
| `estimatedMinutes` | Recomendable | Entero positivo. |
| `cover` | No | URL `https://` o ruta local. |
| `subtitle`, `author` | No | Texto libre. |

## Bloques disponibles

### Callout, note y quote

```md
:::callout{type=why} ¿Por qué ocurre?
Explicación del mecanismo.
:::

:::note
Texto de una nota informativa.
:::

:::quote
Una cita o idea destacada.
:::
```

Variantes: `why`, `tip`, `warning`, `key`, `info`, `pearl`, `quote`. Atributos: `type`, `title`, `collapsible=true`.

### Grid

```md
:::grid{columns=2}
**Antes**
- Punto uno.

**Después**
- Punto dos.
:::
```

`columns` admite 1–3.

### Steps

```md
:::steps
### Confirma el diagnóstico
Describe el primer paso.

### Elige el tratamiento
Describe el segundo paso.
:::
```

La app numera los pasos. No escribas `1.` en los títulos.

### Quiz

```md
:::quiz{id=q-diagnostico}
**Pregunta:** ¿Cuál es el diagnóstico más probable?

- [ ] Herpes simple
- [x] Impétigo no ampolloso
- [ ] Celulitis

> **Explicación:** Las costras melicéricas son típicas.
:::
```

- `- [ ]` incorrecta; `- [x]` correcta.
- Varias correctas activan el modo múltiple.
- Atributos: `id`, `multiple`, `difficulty` (1–5), `tags` separados por comas.
- La explicación va después de la última opción.

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

Cada tarjeta se separa con `---`. El frente es el H3; el reverso es el resto. Puedes fijar el ID con `### Frente {#card-id}`.

### Preguntas abiertas

```md
:::qa{id=qa-dudas}
### ¿Siempre necesita antibiótico?
No. En lesiones localizadas suele bastar el tratamiento tópico.

---

### ¿Cuándo derivar?
Cuando hay afectación extensa o síntomas sistémicos.
:::
```

Mismo formato que flashcards; el frente es la pregunta.

### Keypoints

```md
:::keypoints
- Primera idea.
- Segunda idea.
- Tercera idea.
:::
```

Solo se interpretan elementos de lista. Recomendado: 3–8.

### References

```md
:::references
1. [CDC — Impetigo](https://www.cdc.gov/group-a-strep/about/impetigo.html) — Guía clínica.
2. [NICE — Impetigo](https://www.nice.org.uk/guidance/ng153) — Recomendaciones.
:::
```

Usa `https://`, títulos descriptivos y una nota de qué aporta cada fuente. No inventes URLs.

> Las URLs de imagen de los ejemplos son ilustrativas. Sustitúyelas por URLs `https://` reales y verificables, con crédito.

### Gallery

```md
:::gallery{columns=2}
![Radiografía con consolidación](https://upload.wikimedia.org/wikipedia/commons/example/radiografia.jpg "Figura 1. Consolidación lobar")
![TC axial de tórax](https://upload.wikimedia.org/wikipedia/commons/example/tc-torax.jpg "Figura 2. Patrón neumónico")
:::
```

`columns` admite 1–4. Solo imágenes Markdown.

### Figure

```md
:::figure{src="https://upload.wikimedia.org/wikipedia/commons/example/algoritmo.png" alt="Algoritmo de tratamiento" caption="Figura 3. Decisión terapéutica" credit="Fuente: Wikimedia Commons, CC BY-SA 4.0"}
:::
```

`alt` describe; `caption` contextualiza; `credit` atribuye fuente y licencia.

## Imágenes web

- Usa una URL **directa al archivo** de imagen, no a la página del artículo.
- Usa `https://`; evita `http://`.
- Verifica que la licencia permite el uso y añade crédito.
- No uses URLs firmadas, temporales o de buscadores.
- No generes imágenes. Si el deck debe funcionar sin conexión, usa archivos locales aportados por el usuario.
- soffia no descarga imágenes remotas: las enlaza y aplica `referrerpolicy="no-referrer"`.
- Si una imagen falla, muestra un fallback con enlace al original.

## Markdown normal

Funciona todo el Markdown estándar: párrafos, negrita, cursiva, listas, tablas, blockquotes, enlaces, código y reglas horizontales.

No funciona:

- HTML crudo;
- listas de tareas interactivas fuera de `:::quiz`;
- anexos o extensiones no estándar.

## Estrategia para cualquier tipo de contenido

No importa si el texto es un seminario, una guía, un resumen o una investigación:

1. Detecta las ideas principales y conviértelas en 6–12 H2.
2. Dentro de cada H2, usa H3 solo si hay subtemas reales.
3. Explica primero; después añade tablas, pasos o callouts.
4. Convierte las ideas evaluables en quizzes; los conceptos memorizables en flashcards; las dudas en Q&A.
5. Añade referencias verificables.
6. Añade imágenes web solo si enseñan algo y tienen crédito.
7. Valida hasta obtener 0 errores.

## Validación

```bash
node skill/soffia/scripts/validate.mjs ruta/al/deck.md
node skill/soffia/scripts/validate.mjs --strict ruta/al/deck.md
```

Códigos: `0` sin errores; `1` errores o avisos en modo estricto; `2` error de uso.

Antes de entregar:

- [ ] Frontmatter completo.
- [ ] Un H1.
- [ ] H2/H3 sin numeración manual.
- [ ] Bloques `:::` cerrados.
- [ ] Quizzes con opciones, correcta y explicación.
- [ ] Tarjetas con frente y reverso.
- [ ] Referencias con `https://`.
- [ ] Imágenes con `alt`; las figuras web con crédito.
- [ ] 0 errores del validador.

## Entrega con MCP

Si el cliente tiene el servidor soffia:

1. Pregunta dónde guardar: carpeta personalizada, directorio actual o `Downloads/soffia` (por defecto).
2. Llama a `soffia_save_decks` con **todos** los decks en una sola llamada.
3. Los archivos inválidos se reportan sin bloquear los válidos.
4. El servidor no sobrescribe: usa `soffia-<nombre>-<id>.md` con un sufijo de 4 caracteres hexadecimales.
5. Las imágenes no son obligatorias; si faltan, el guardado continúa y se sugiere añadir URLs `https://` con crédito.

Sin MCP, entrega el Markdown completo y valida con el comando de la sección anterior.
