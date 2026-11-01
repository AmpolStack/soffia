import { ExternalLink } from 'lucide-react';
import type { ReferencesBlock } from '../../lib/format/types';
import { InlineMarkdown } from '../Markdown';

function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}

export function References({ block }: { block: ReferencesBlock }) {
  return (
    <ol className="references">
      {block.items.map((reference, index) => {
        const href = safeUrl(reference.url);
        return (
          <li className="references__item" key={reference.id}>
            <span className="references__number">{String(index + 1).padStart(2, '0')}</span>
            <div className="references__body">
              <div className="references__title">
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <InlineMarkdown source={reference.title} />
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <InlineMarkdown source={reference.title} />
                )}
              </div>
              {reference.note ? (
                <p className="references__note">{reference.note}</p>
              ) : null}
              {reference.domain ? (
                <span className="references__domain">{reference.domain}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
