import { describe, expect, it } from 'vitest';
import { parseDocument } from './parse';
import { normalizeMarkdown } from './normalize';

const sample = `---
title: Seminario de prueba
tags: [Dermatología, Pediatría]
---

# Seminario de prueba

Introducción libre.

## 1. Introducción

El impétigo es una infección superficial.

:::callout{type=why} ¿Por qué aparecen las costras?
Porque el exudado se seca.
:::

:::quiz{id=q-dx}
**Pregunta:** ¿Cuál es el diagnóstico más probable?

- [ ] Herpes simple
- [x] Impétigo no ampolloso
- [ ] Celulitis

> **Explicación:** Las costras melicéricas son típicas.
:::

### 1.1 Subsección

Texto de la subsección.

## 2. Tratamiento

:::steps
### 1. Limpiar
Agua y jabón.

### 2. Tratar
Antibiótico tópico.
:::

:::flashcards{id=fc-tratamiento}
### ¿Qué antibiótico tópico se usa?
Mupirocina al 2%.

---
### ¿Cuándo se usa tratamiento oral?
En lesiones extensas o complicadas.
:::

:::qa
### ¿El impétigo deja cicatriz?
Normalmente no, salvo el ectima.

---
### ¿Qué complicación renal puede aparecer?
Glomerulonefritis postestreptocócica.
:::

:::keypoints
- Infección superficial.
- Costras melicéricas.
:::

## 3. Referencias

:::references
1. [CDC — Impetigo](https://www.cdc.gov/group-a-strep/about/impetigo.html) — Guía clínica.
2. [NICE — Impetigo](https://www.nice.org.uk/guidance/ng153) — Antibióticos.
:::

:::gallery{columns=2}
![Lesión 1](img/lesion-1.jpg "Costras melicéricas")
![Lesión 2](img/lesion-2.jpg "Impétigo ampolloso")
:::
`;

describe('normalizeMarkdown', () => {
  it('convierte enlaces de imagen y listas escapadas', () => {
    const input = `[Image: Bullous Impetigo](https://images.openai.com/a)\n\n1\\. Primer paso\n`;
    const output = normalizeMarkdown(input);
    expect(output).toContain('![Bullous Impetigo](https://images.openai.com/a)');
    expect(output).toContain('1. Primer paso');
  });

  it('elimina favicons de ChatGPT', () => {
    const input = 'Texto\n\n[image](https://www.google.com/s2/favicons?domain=https://cdc.gov&sz=32)\n\nCDC+1\n';
    const output = normalizeMarkdown(input);
    expect(output).not.toContain('favicons');
    expect(output).toContain('CDC+1');
  });
});

describe('parseDocument', () => {
  const doc = parseDocument(sample);

  it('lee el frontmatter y el título', () => {
    expect(doc.meta.title).toBe('Seminario de prueba');
    expect(doc.meta.tags).toEqual(['Dermatología', 'Pediatría']);
    expect(doc.meta.id).toBe('seminario-de-prueba');
  });

  it('construye el árbol H2/H3', () => {
    expect(doc.sections).toHaveLength(3);
    expect(doc.sections[0].title).toBe('1. Introducción');
    expect(doc.sections[0].children).toHaveLength(1);
    expect(doc.sections[0].children[0].title).toBe('1.1 Subsección');
    expect(doc.sections[1].children).toHaveLength(0);
  });

  it('extrae quizzes con respuesta y explicación', () => {
    expect(doc.quizzes).toHaveLength(1);
    expect(doc.quizzes[0].options).toHaveLength(3);
    expect(doc.quizzes[0].options.filter((option) => option.correct)).toHaveLength(1);
    expect(doc.quizzes[0].question).toBe('¿Cuál es el diagnóstico más probable?');
    expect(doc.quizzes[0].explanation).toBe('Las costras melicéricas son típicas.');
  });

  it('limpia las etiquetas en negrita sin comerse el énfasis de la pregunta', () => {
    const quizDoc = parseDocument(
      `# T\n\n## S\n\n:::quiz\n**Pregunta:** **¿Qué es?**\n\n- [x] A\n- [ ] B\n\n**Explicación:** Porque sí.\n:::`,
    );

    expect(quizDoc.quizzes[0].question).toBe('**¿Qué es?**');
    expect(quizDoc.quizzes[0].explanation).toBe('Porque sí.');
  });

  it('extrae flashcards y Q&A', () => {
    expect(doc.flashcards).toHaveLength(2);
    expect(doc.flashcards[0].front).toBe('¿Qué antibiótico tópico se usa?');
    expect(doc.qa).toHaveLength(2);
  });

  it('extrae referencias y puntos clave', () => {
    expect(doc.references).toHaveLength(2);
    expect(doc.references[0].domain).toBe('cdc.gov');
    expect(doc.images).toHaveLength(2);
  });

  it('no genera warnings en el ejemplo', () => {
    expect(doc.warnings.filter((warning) => warning.severity === 'error')).toHaveLength(0);
  });

  it('marca como error un frontmatter YAML inválido', () => {
    const broken = parseDocument(`---
title: Prueba
description: Un texto con dos puntos: sin comillas
---

# Prueba

## Sección
`);
    expect(
      broken.warnings.some(
        (warning) =>
          warning.severity === 'error' &&
          warning.message.includes('frontmatter YAML'),
      ),
    ).toBe(true);
  });
});

describe('bloques incompletos', () => {
  it('avisa si un quiz no tiene respuesta correcta', () => {
    const doc = parseDocument(`# T\n\n## S\n\n:::quiz\n¿Pregunta?\n\n- [ ] A\n- [ ] B\n:::\n`);
    expect(doc.warnings.some((warning) => warning.message.includes('correcta'))).toBe(true);
  });

  it('avisa si una directiva no se cierra', () => {
    const doc = parseDocument(`# T\n\n## S\n\n:::callout{type=tip}\nTexto\n`);
    expect(doc.warnings.some((warning) => warning.message.includes('cierre'))).toBe(true);
  });
});
