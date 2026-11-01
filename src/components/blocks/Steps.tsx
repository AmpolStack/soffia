import type { StepsBlock } from '../../lib/format/types';
import { InlineMarkdown } from '../Markdown';
import { BlockRenderer } from './BlockRenderer';

export function Steps({ block }: { block: StepsBlock }) {
  return (
    <ol className="steps">
      {block.items.map((item, index) => (
        <li className="steps__item" key={`${item.title}-${index}`}>
          <span className="steps__number" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="steps__body">
            {item.title ? (
              <h4 className="steps__title">
                <InlineMarkdown source={item.title} />
              </h4>
            ) : null}
            {item.blocks.map((child, childIndex) => (
              <BlockRenderer key={childIndex} block={child} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
