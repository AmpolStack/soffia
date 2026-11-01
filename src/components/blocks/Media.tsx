import { useEffect, useState, type CSSProperties } from 'react';
import { ImageOff, Maximize2 } from 'lucide-react';
import { useDeck } from '../../contexts/DeckContext';
import type { GalleryBlock, ImageRef } from '../../lib/format/types';
import { isRemoteImage } from '../../lib/images';

function imageData(image: ImageRef, src: string) {
  return {
    'data-lightbox': 'true',
    'data-src': src,
    'data-source': image.src,
    'data-alt': image.alt || '',
    'data-caption': image.caption || image.alt || '',
  };
}

function RemoteAttrs({ src }: { src: string }) {
  return isRemoteImage(src) ? { referrerPolicy: 'no-referrer' as const } : {};
}

function ImageFallback({
  src,
  alt,
  tile = false,
}: {
  src: string;
  alt?: string;
  tile?: boolean;
}) {
  return (
    <div className={`missing-image${tile ? ' missing-image--tile' : ''}`}>
      <ImageOff size={18} aria-hidden="true" />
      <span>
        No se pudo cargar la imagen{alt ? `: ${alt}` : ''}.
        {isRemoteImage(src) ? (
          <>
            {' '}
            <a className="text-link" href={src} target="_blank" rel="noopener noreferrer">
              Abrir original
            </a>
          </>
        ) : null}
      </span>
    </div>
  );
}

export function Figure({ image }: { image: ImageRef }) {
  const { resolveSrc } = useDeck();
  const src = resolveSrc(image.src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src) {
    return <ImageFallback src={image.src} alt={image.alt} />;
  }

  if (failed) {
    return <ImageFallback src={src} alt={image.alt} />;
  }

  return (
    <figure className="figure figure--block">
      <button
        type="button"
        className="figure__button"
        aria-label={`Ampliar imagen: ${image.alt || 'imagen'}`}
        {...imageData(image, src)}
      >
        <img
          src={src}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          {...RemoteAttrs({ src })}
          onError={() => setFailed(true)}
        />
        <span className="figure__zoom" aria-hidden="true">
          <Maximize2 size={16} />
        </span>
      </button>
      {image.caption ? (
        <figcaption className="figure__caption">{image.caption}</figcaption>
      ) : null}
      {image.credit ? (
        <span className="figure__credit">{image.credit}</span>
      ) : null}
    </figure>
  );
}

function GalleryItem({ image }: { image: ImageRef }) {
  const { resolveSrc } = useDeck();
  const src = resolveSrc(image.src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <figure className="gallery__item">
        <ImageFallback src={src || image.src} alt={image.alt} tile />
        {image.caption || image.alt ? (
          <figcaption>{image.caption || image.alt}</figcaption>
        ) : null}
      </figure>
    );
  }

  return (
    <figure className="gallery__item">
      <button
        type="button"
        className="gallery__button"
        aria-label={`Ampliar imagen: ${image.alt || 'imagen'}`}
        {...imageData(image, src)}
      >
        <img
          src={src}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          {...RemoteAttrs({ src })}
          onError={() => setFailed(true)}
        />
        <span className="gallery__zoom" aria-hidden="true">
          <Maximize2 size={15} />
        </span>
      </button>
      {image.caption || image.alt ? (
        <figcaption>{image.caption || image.alt}</figcaption>
      ) : null}
    </figure>
  );
}

export function Gallery({ block }: { block: GalleryBlock }) {
  const style = {
    '--gallery-columns': String(Math.min(4, Math.max(1, block.columns ?? 3))),
  } as CSSProperties;

  if (block.images.length === 0) {
    return <p className="muted">Esta galería no contiene imágenes.</p>;
  }

  return (
    <div className="gallery" style={style}>
      {block.images.map((image, index) => (
        <GalleryItem image={image} key={`${image.src}-${index}`} />
      ))}
    </div>
  );
}
