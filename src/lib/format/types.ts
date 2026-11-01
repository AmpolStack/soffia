export type CalloutVariant =
  | 'why'
  | 'tip'
  | 'warning'
  | 'key'
  | 'info'
  | 'pearl'
  | 'quote';

export type DocMeta = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  tags: string[];
  language?: string;
  author?: string;
  cover?: string;
  estimatedMinutes: number;
};

export type ImageRef = {
  src: string;
  alt: string;
  caption?: string;
  credit?: string;
  href?: string;
};

export type HeadingBlock = {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string;
};

export type MarkdownBlock = {
  type: 'markdown';
  source: string;
};

export type ImageBlock = {
  type: 'image';
  image: ImageRef;
};

export type GalleryBlock = {
  type: 'gallery';
  images: ImageRef[];
  columns?: number;
};

export type CalloutBlock = {
  type: 'callout';
  variant: CalloutVariant;
  title?: string;
  collapsible: boolean;
  blocks: Block[];
};

export type Step = {
  title: string;
  blocks: Block[];
};

export type StepsBlock = {
  type: 'steps';
  items: Step[];
};

export type QuizOption = {
  id: string;
  text: string;
  correct: boolean;
};

export type QuizBlock = {
  type: 'quiz';
  id: string;
  question: string;
  options: QuizOption[];
  multiple: boolean;
  explanation: string;
  difficulty?: number;
  tags: string[];
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
};

export type FlashcardsBlock = {
  type: 'flashcards';
  id: string;
  cards: Flashcard[];
};

export type QAItem = {
  id: string;
  question: string;
  answer: string;
};

export type QABlock = {
  type: 'qa';
  id: string;
  items: QAItem[];
};

export type Reference = {
  id: string;
  title: string;
  url?: string;
  note?: string;
  domain?: string;
};

export type ReferencesBlock = {
  type: 'references';
  items: Reference[];
};

export type KeypointsBlock = {
  type: 'keypoints';
  items: string[];
};

export type GridBlock = {
  type: 'grid';
  columns?: number;
  blocks: Block[];
};

export type UnknownBlock = {
  type: 'unknown';
  name: string;
  raw: string;
};

export type Block =
  | HeadingBlock
  | MarkdownBlock
  | ImageBlock
  | GalleryBlock
  | CalloutBlock
  | StepsBlock
  | QuizBlock
  | FlashcardsBlock
  | QABlock
  | ReferencesBlock
  | KeypointsBlock
  | GridBlock
  | UnknownBlock;

export type SectionNode = {
  id: string;
  level: 2 | 3;
  title: string;
  blocks: Block[];
  children: SectionNode[];
};

export type ParseWarning = {
  message: string;
  line?: number;
  severity: 'warning' | 'error';
};

export type SofiaDocument = {
  meta: DocMeta;
  lead: Block[];
  sections: SectionNode[];
  images: ImageRef[];
  quizzes: QuizBlock[];
  flashcards: Flashcard[];
  qa: QAItem[];
  references: Reference[];
  wordCount: number;
  warnings: ParseWarning[];
  raw: string;
};

export type ParseOptions = {
  sourceName?: string;
};
