import { Check, ChevronDown } from 'lucide-react';
import type { SectionNode } from '../../lib/format/types';
import { InlineMarkdown } from '../Markdown';
import { BlockRenderer } from '../blocks/BlockRenderer';

export function SectionAccordion({
  section,
  number,
  open,
  onToggle,
  subOpen,
  onSubToggle,
  read,
  onToggleRead,
}: {
  section: SectionNode;
  number: string;
  open: boolean;
  onToggle: () => void;
  subOpen: (id: string) => boolean;
  onSubToggle: (id: string) => void;
  read: boolean;
  onToggleRead: () => void;
}) {
  return (
    <section className="section" id={section.id} data-section-id={section.id}>
      <header className="section__header">
        <h2 className="section__title">
          <button
            type="button"
            className="section__toggle"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={`${section.id}-content`}
          >
            <span className="section__number">{number}</span>
            <span className="section__name">
              <InlineMarkdown source={section.title} />
            </span>
            <ChevronDown
              size={19}
              className="section__chevron"
              aria-hidden="true"
            />
          </button>
        </h2>

        <button
          type="button"
          className={`read-toggle${read ? ' is-read' : ''}`}
          onClick={onToggleRead}
          aria-pressed={read}
          aria-label={read ? 'Quitar marca de leída' : 'Marcar sección como leída'}
          title={read ? 'Quitar marca de leída' : 'Marcar como leída'}
        >
          <Check size={14} aria-hidden="true" />
          <span>{read ? 'Leída' : 'Marcar leída'}</span>
        </button>
      </header>

      {open ? (
        <div className="section__body" id={`${section.id}-content`}>
          {section.blocks.map((block, index) => (
            <BlockRenderer key={index} block={block} />
          ))}

          {section.children.length > 0 ? (
            <div className="subsections">
              {section.children.map((child, index) => {
                const childOpen = subOpen(child.id);
                return (
                  <section
                    className="subsection"
                    id={child.id}
                    data-section-id={child.id}
                    key={child.id}
                  >
                    <h3 className="subsection__title">
                      <button
                        type="button"
                        className="subsection__toggle"
                        onClick={() => onSubToggle(child.id)}
                        aria-expanded={childOpen}
                        aria-controls={`${child.id}-content`}
                      >
                        <span className="subsection__number">
                          {number}.{index + 1}
                        </span>
                        <span className="subsection__name">
                          <InlineMarkdown source={child.title} />
                        </span>
                        <ChevronDown
                          size={17}
                          className="subsection__chevron"
                          aria-hidden="true"
                        />
                      </button>
                    </h3>
                    {childOpen ? (
                      <div className="subsection__body" id={`${child.id}-content`}>
                        {child.blocks.map((block, blockIndex) => (
                          <BlockRenderer key={blockIndex} block={block} />
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
