import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import { isRemoteImage } from '../images';

export type RenderEnv = {
  resolveSrc?: (src: string) => string | null;
  inFigure?: boolean;
  figureCaption?: string;
  figureAlt?: string;
  figureSrc?: string;
  figureCredit?: string;
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

md.validateLink = (url: string) => {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return false;
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('tel:') ||
    normalized.startsWith('#') ||
    normalized.startsWith('/') ||
    normalized.startsWith('./') ||
    normalized.startsWith('../')
  ) {
    return true;
  }
  return normalized.startsWith('data:image/');
};

function escape(value: unknown): string {
  return md.utils.escapeHtml(String(value ?? ''));
}

function resolve(env: RenderEnv, src: string): string | null {
  if (!env.resolveSrc) return src;
  return env.resolveSrc(src);
}

function imageMarkup(
  token: Token,
  env: RenderEnv,
  options: { figure: boolean },
): string {
  const rawSrc = String(token.attrGet('src') ?? '');
  const alt = String(token.attrGet('alt') ?? '');
  const title = String(token.attrGet('title') ?? '');
  const src = resolve(env, rawSrc);

  if (!src) {
    return `<span class="missing-image">Imagen no disponible: <code>${escape(rawSrc)}</code></span>`;
  }

  const caption = title || alt || '';
  const dataAttrs = `data-lightbox="true" data-src="${escape(src)}" data-alt="${escape(alt)}" data-caption="${escape(caption)}"`;
  const remoteAttrs = isRemoteImage(src) ? ' referrerpolicy="no-referrer"' : '';

  if (options.figure) {
    env.figureCaption = title || '';
    env.figureAlt = alt;
    env.figureSrc = src;
    return `<button class="figure__button" type="button" ${dataAttrs} aria-label="Ampliar imagen: ${escape(alt || 'imagen')}"><img src="${escape(src)}" alt="${escape(alt)}" loading="lazy" decoding="async"${remoteAttrs} /></button>`;
  }

  return `<img class="inline-image" src="${escape(src)}" alt="${escape(alt)}" loading="lazy" decoding="async"${remoteAttrs} ${dataAttrs} />`;
}

md.renderer.rules.image = (tokens, idx, _options, env) => {
  const renderEnv = env as RenderEnv;
  return imageMarkup(tokens[idx], renderEnv, { figure: Boolean(renderEnv.inFigure) });
};

md.renderer.rules.paragraph_open = (tokens, idx, _options, env, self) => {
  const renderEnv = env as RenderEnv;
  const inline = tokens[idx + 1];
  if (inline?.type === 'inline') {
    const children = inline.children ?? [];
    const meaningful = children.filter(
      (child) =>
        child.type !== 'text' ||
        Boolean(child.content && child.content.trim()),
    );
    const onlyImage =
      meaningful.length === 1 && meaningful[0].type === 'image';
    const linkedImage =
      meaningful.length === 3 &&
      meaningful[0].type === 'link_open' &&
      meaningful[1].type === 'image' &&
      meaningful[2].type === 'link_close';

    if (onlyImage || linkedImage) {
      renderEnv.inFigure = true;
      return '<figure class="figure">';
    }
  }

  return self.renderToken(tokens, idx, _options);
};

md.renderer.rules.paragraph_close = (tokens, idx, options, env, self) => {
  const renderEnv = env as RenderEnv;
  if (renderEnv.inFigure) {
    const caption = renderEnv.figureCaption;
    const credit = renderEnv.figureCredit;
    renderEnv.inFigure = false;
    renderEnv.figureCaption = undefined;
    renderEnv.figureCredit = undefined;
    const captionMarkup = caption
      ? `<figcaption class="figure__caption">${escape(caption)}</figcaption>`
      : '';
    const creditMarkup = credit
      ? `<span class="figure__credit">${escape(credit)}</span>`
      : '';
    return `${captionMarkup}${creditMarkup}</figure>`;
  }
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const href = String(tokens[idx].attrGet('href') ?? '');
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
  }
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
md.renderer.rules.table_close = () => '</table></div>';

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = token.info.trim().split(/\s+/)[0] || '';
  const code = token.content;
  const langClass = lang ? ` class="language-${escape(lang)}"` : '';
  return `<div class="code-block"><div class="code-block__bar"><span>${escape(lang || 'código')}</span><button class="code-copy" type="button">Copiar</button></div><pre><code${langClass}>${escape(code)}</code></pre></div>`;
};

md.renderer.rules.code_block = (tokens, idx) => {
  return `<div class="code-block"><pre><code>${escape(tokens[idx].content)}</code></pre></div>`;
};

md.renderer.rules.hr = () => '<hr class="rule" />';

export function renderMarkdown(
  markdown: string,
  env: RenderEnv = {},
): string {
  return md.render(markdown, env);
}

export function renderInline(markdown: string, env: RenderEnv = {}): string {
  return md.renderInline(markdown, env);
}
