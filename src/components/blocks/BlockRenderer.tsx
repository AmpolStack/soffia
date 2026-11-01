import type { CSSProperties } from 'react';
import type { Block } from '../../lib/format/types';
import { InlineMarkdown, Markdown } from '../Markdown';
import { Callout } from './Callout';
import { FlashcardsPreview } from './FlashcardsPreview';
import { Keypoints } from './Keypoints';
import { Figure, Gallery } from './Media';
import { QAInline } from './QAInline';
import { QuizInline } from './QuizInline';
import { References } from './References';
import { Steps } from './Steps';

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(3, block.level));
      const Tag = `h${level}` as 'h3' | 'h4' | 'h5' | 'h6';
      return (
        <Tag id={block.id} className={`nested-heading nested-heading--${level}`}>
          <InlineMarkdown source={block.text} />
        </Tag>
      );
    }
    case 'markdown':
      return <Markdown source={block.source} />;
    case 'image':
      return <Figure image={block.image} />;
    case 'gallery':
      return <Gallery block={block} />;
    case 'callout':
      return <Callout block={block} />;
    case 'steps':
      return <Steps block={block} />;
    case 'quiz':
      return <QuizInline block={block} />;
    case 'flashcards':
      return <FlashcardsPreview block={block} />;
    case 'qa':
      return <QAInline block={block} />;
    case 'references':
      return <References block={block} />;
    case 'keypoints':
      return <Keypoints block={block} />;
    case 'grid': {
      const style = {
        '--grid-columns': String(
          Math.min(3, Math.max(1, block.columns ?? 2)),
        ),
      } as CSSProperties;
      return (
        <div className="content-grid" style={style}>
          {block.blocks.map((child, index) => (
            <BlockRenderer key={index} block={child} />
          ))}
        </div>
      );
    }
    case 'unknown':
      return (
        <div className="unknown-block">
          <p>
            <strong>Bloque no reconocido:</strong> <code>:::{block.name}</code>
          </p>
          {block.raw ? <pre>{block.raw}</pre> : null}
        </div>
      );
    default:
      return null;
  }
}
