import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import quickReference from '../../mcp/quick-reference.md?raw';
import { renderMarkdown } from '../lib/format/renderMarkdown';
import { SoffiaMark } from './SoffiaMark';

export function FormatGuideView() {
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
            con <code>webfetch</code>. La versión de texto plano está en{' '}
            <a href="/llms.txt">/llms.txt</a>.
          </p>
          <div className="button-row">
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
      </main>
    </div>
  );
}
