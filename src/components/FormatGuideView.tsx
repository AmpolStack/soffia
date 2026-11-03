import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, FileText } from 'lucide-react';
import quickReference from '../../mcp/quick-reference.md?raw';
import skillMarkdown from '../../skill/soffia/SKILL.md?raw';
import { renderMarkdown } from '../lib/format/renderMarkdown';
import { SoffiaMark } from './SoffiaMark';

export function FormatGuideView() {
  const [copied, setCopied] = useState(false);
  const guide = useMemo(
    () =>
      renderMarkdown(
        quickReference
          .replace(/^# .*\n+/, '')
          .replace(
            'La especificación completa está en `skill/soffia/reference/format.md`.',
            'La especificación completa está en [la versión de texto para modelos](/llms.txt).',
          ),
      ),
    [],
  );

  const copySkill = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(skillMarkdown);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = skillMarkdown;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="format-page">
      <header className="format-header">
        <Link className="wordmark wordmark--small" to="/" aria-label="soffia">
          <SoffiaMark size={18} />
          <span>soffia</span>
        </Link>
        <span className="muted small">Formato para agentes</span>
      </header>

      <main className="format-main">
        <header className="format-hero">
          <span className="eyebrow">
            <FileText size={14} aria-hidden="true" />
            Guía de formato
          </span>
          <h1>Markdown para soffia.</h1>
          <p>
            Especificación y recomendaciones para personas y modelos que leen
            con <code>webfetch</code>. Incluye reglas para añadir imágenes web
            relevantes y para que ningún encabezado, bloque o tarjeta quede
            vacío. La versión de texto plano está en{' '}
            <a href="/llms.txt">/llms.txt</a>.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button button--solid"
              onClick={() =>
                document
                  .getElementById('skill')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              <Copy size={16} aria-hidden="true" />
              Skill copiable
            </button>
            <a className="button button--outline" href="/llms.txt">
              Texto para modelos
            </a>
            <Link className="button button--ghost" to="/">
              <ArrowLeft size={16} aria-hidden="true" />
              Volver a la biblioteca
            </Link>
          </div>
        </header>

        <article
          className="prose format-prose"
          dangerouslySetInnerHTML={{ __html: guide }}
        />

        <section className="format-skill" id="skill">
          <div className="format-skill__head">
            <div>
              <span className="eyebrow">
                <Copy size={14} aria-hidden="true" />
                Skill para agentes
              </span>
              <h2>Skill copiable</h2>
              <p>
                Copia este Markdown en tu cliente de agentes para que genere
                decks con el mismo formato, imágenes web verificables y
                contenido completo en todos los elementos.
              </p>
            </div>
            <button
              type="button"
              className="button button--solid"
              onClick={() => void copySkill()}
            >
              <Copy size={16} aria-hidden="true" />
              {copied ? 'Copiada' : 'Copiar skill'}
            </button>
          </div>
          <details className="format-skill__details">
            <summary>Ver skill en Markdown</summary>
            <pre>
              <code>{skillMarkdown}</code>
            </pre>
          </details>
        </section>
      </main>
    </div>
  );
}
