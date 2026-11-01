import { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Gem,
  HelpCircle,
  Info,
  KeyRound,
  Lightbulb,
  Quote,
  type LucideIcon,
} from 'lucide-react';
import type { CalloutBlock, CalloutVariant } from '../../lib/format/types';
import { InlineMarkdown } from '../Markdown';
import { BlockRenderer } from './BlockRenderer';

const ICONS: Record<CalloutVariant, LucideIcon> = {
  why: HelpCircle,
  tip: Lightbulb,
  warning: AlertTriangle,
  key: KeyRound,
  info: Info,
  pearl: Gem,
  quote: Quote,
};

const FALLBACK_TITLES: Record<CalloutVariant, string> = {
  why: '¿Por qué?',
  tip: 'Consejo',
  warning: 'Atención',
  key: 'Idea clave',
  info: 'Nota',
  pearl: 'Perla',
  quote: 'Cita',
};

export function Callout({ block }: { block: CalloutBlock }) {
  const [open, setOpen] = useState(true);
  const Icon = ICONS[block.variant];
  const title = block.title || FALLBACK_TITLES[block.variant];

  return (
    <aside
      className={`callout callout--${block.variant}${
        block.collapsible ? ' callout--collapsible' : ''
      }${block.collapsible && !open ? ' is-closed' : ''}`}
    >
      {block.collapsible ? (
        <button
          type="button"
          className="callout__header callout__header--button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          <Icon size={18} aria-hidden="true" />
          <span className="callout__title">
            <InlineMarkdown source={title} />
          </span>
          <ChevronDown
            size={17}
            className="callout__chevron"
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className="callout__header">
          <Icon size={18} aria-hidden="true" />
          <span className="callout__title">
            <InlineMarkdown source={title} />
          </span>
        </div>
      )}

      <div className="callout__body" hidden={block.collapsible && !open}>
        {block.blocks.map((child, index) => (
          <BlockRenderer key={index} block={child} />
        ))}
      </div>
    </aside>
  );
}
