import { Check } from 'lucide-react';
import type { KeypointsBlock } from '../../lib/format/types';
import { InlineMarkdown } from '../Markdown';

export function Keypoints({ block }: { block: KeypointsBlock }) {
  return (
    <ul className="keypoints">
      {block.items.map((item, index) => (
        <li key={`${item}-${index}`}>
          <span className="keypoints__check" aria-hidden="true">
            <Check size={14} />
          </span>
          <span>
            <InlineMarkdown source={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}
