import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUp,
  BookOpen,
  HelpCircle,
  Layers,
  List,
  Target,
} from 'lucide-react';
import { useDeck } from '../../contexts/DeckContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { isCloudMode } from '../../contexts/AuthContext';
import { cloudDownloadDeck } from '../../lib/cloud';
import { downloadBlob, rfcFileName } from '../../lib/download';
import type { SectionNode } from '../../lib/format/types';
import { BlockRenderer } from '../blocks/BlockRenderer';
import { DeckWatermark } from '../DeckWatermark';
import { SoffiaMark } from '../SoffiaMark';
import { DeckHero } from './DeckHero';
import { DocumentScrollbar } from './DocumentScrollbar';
import { SectionAccordion } from './SectionAccordion';
import { Toc } from './Toc';
import { loadTocWidth, saveTocWidth } from '../../lib/reader/tocWidth';

type AccordionState = {
  sections: Record<string, boolean>;
  subs: Record<string, boolean>;
};

function storageKey(deckId: string): string {
  return `soffia:accordion:${deckId}`;
}

function loadAccordion(deckId: string): AccordionState {
  try {
    const raw = localStorage.getItem(storageKey(deckId));
    if (!raw) return { sections: {}, subs: {} };
    const parsed = JSON.parse(raw) as Partial<AccordionState>;
    return {
      sections: parsed.sections ?? {},
      subs: parsed.subs ?? {},
    };
  } catch {
    return { sections: {}, subs: {} };
  }
}

function findParent(
  sections: SectionNode[],
  id: string,
): { parent: SectionNode; child?: SectionNode } | null {
  for (const section of sections) {
    if (section.id === id) return { parent: section };
    const child = section.children.find((item) => item.id === id);
    if (child) return { parent: section, child };
  }
  return null;
}

export function ReaderView() {
  const { deck, document: doc, progress, markSectionRead, unmarkSectionRead } = useDeck();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [accordion, setAccordion] = useState<AccordionState>(() =>
    deck ? loadAccordion(deck.id) : { sections: {}, subs: {} },
  );
  const [activeId, setActiveId] = useState('inicio');
  const [readingProgress, setReadingProgress] = useState(0);
  const [mobileToc, setMobileToc] = useState(false);
  const [showMobileToc, setShowMobileToc] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [tocWidth, setTocWidth] = useState(loadTocWidth);

  const deckId = deck?.id;

  useEffect(() => {
    if (!deckId) return;
    setAccordion(loadAccordion(deckId));
  }, [deckId]);

  useEffect(() => {
    if (!deckId) return;
    try {
      localStorage.setItem(storageKey(deckId), JSON.stringify(accordion));
    } catch {
      // La lectura sigue funcionando aunque no haya almacenamiento.
    }
  }, [accordion, deckId]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveTocWidth(tocWidth), 180);
    return () => window.clearTimeout(timer);
  }, [tocWidth]);

  // Bloquea el scroll del documento mientras el índice es una ventana
  // emergente; el propio índice conserva su scroll interno.
  useEffect(() => {
    if (!mobileToc) return;
    const root = document.documentElement;
    const body = document.body;
    const previousRoot = root.style.overflow;
    const previousBody = body.style.overflow;
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previousRoot;
      body.style.overflow = previousBody;
    };
  }, [mobileToc]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1181px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileToc(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!printing) return;
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setPrinting(false);
    };

    const waitForImages = () => {
      const images = Array.from(document.images);
      images.forEach((image) => {
        image.loading = 'eager';
      });
      const pending = images.filter((image) => !image.complete);
      if (pending.length === 0) return Promise.resolve();
      return Promise.all(
        pending.map(
          (image) =>
            new Promise<void>((resolve) => {
              const done = () => {
                image.removeEventListener('load', done);
                image.removeEventListener('error', done);
                resolve();
              };
              image.addEventListener('load', done, { once: true });
              image.addEventListener('error', done, { once: true });
              window.setTimeout(done, 2500);
            }),
        ),
      );
    };

    const timer = window.setTimeout(() => {
      void waitForImages().then(() => {
        if (cancelled) return;
        window.print();
        window.setTimeout(finish, 400);
      });
    }, 180);

    window.addEventListener('afterprint', finish);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [printing]);

  const handlePrint = () => {
    setMobileToc(false);
    document
      .querySelectorAll<HTMLElement>('.table-block.is-fullscreen')
      .forEach((table) =>
        table.dispatchEvent(new CustomEvent('soffia:close-table-fullscreen')),
      );
    setPrinting(true);
  };

  const handleDownload = async () => {
    if (!deck) return;
    setMobileToc(false);
    try {
      if (isCloudMode) {
        const { blob, fileName } = await cloudDownloadDeck(deck.id);
        downloadBlob(blob, fileName);
      } else {
        const blob = new Blob([deck.markdown], {
          type: 'text/markdown;charset=utf-8',
        });
        downloadBlob(blob, rfcFileName(deck.sourceName));
      }
      toast('Markdown descargado.', 'success');
    } catch (cause) {
      toast(
        cause instanceof Error ? cause.message : 'No se pudo descargar el Markdown.',
        'error',
      );
    }
  };

  const readSections = useMemo(
    () => new Set(Object.keys(progress.sections)),
    [progress.sections],
  );

  const isSectionOpen = (id: string) => accordion.sections[id] !== false;
  const isSubOpen = (id: string) => accordion.subs[id] !== false;

  const sections = doc?.sections ?? [];
  const allExpanded =
    sections.length > 0 &&
    sections.every(
      (section) =>
        isSectionOpen(section.id) &&
        section.children.every((child) => isSubOpen(child.id)),
    );

  const toggleAll = () => {
    if (!doc) return;
    const open = !allExpanded;
    const nextSections: Record<string, boolean> = {};
    const nextSubs: Record<string, boolean> = {};
    doc.sections.forEach((section) => {
      nextSections[section.id] = open;
      section.children.forEach((child) => {
        nextSubs[child.id] = open;
      });
    });
    setAccordion({ sections: nextSections, subs: nextSubs });
  };

  const toggleSection = (id: string) => {
    setAccordion((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [id]: !(current.sections[id] !== false),
      },
    }));
  };

  const toggleSub = (id: string) => {
    setAccordion((current) => ({
      ...current,
      subs: {
        ...current.subs,
        [id]: !(current.subs[id] !== false),
      },
    }));
  };

  const openSection = (id: string) => {
    setAccordion((current) => ({
      ...current,
      sections: { ...current.sections, [id]: true },
    }));
  };

  const openSub = (id: string) => {
    setAccordion((current) => ({
      ...current,
      subs: { ...current.subs, [id]: true },
    }));
  };

  const scrollTo = (id: string) => {
    if (id === 'inicio') {
      window.scrollTo({
        top: 0,
        behavior: settings.reduceMotion ? 'auto' : 'smooth',
      });
      setActiveId('inicio');
      return;
    }

    const element = window.document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({
      behavior: settings.reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const navigateTo = (id: string) => {
    setMobileToc(false);
    if (id === 'inicio') {
      scrollTo('inicio');
      return;
    }
    const found = doc ? findParent(doc.sections, id) : null;
    if (found) {
      openSection(found.parent.id);
      if (found.child) openSub(found.child.id);
      setActiveId(found.parent.id);
    }
    window.setTimeout(() => scrollTo(id), 70);
  };

  const requestedAnchor = searchParams.get('s');

  useEffect(() => {
    if (!doc || !requestedAnchor) return;

    if (requestedAnchor !== 'inicio') {
      const found = findParent(doc.sections, requestedAnchor);
      if (found) {
        openSection(found.parent.id);
        if (found.child) openSub(found.child.id);
      }
    }

    const timer = window.setTimeout(() => {
      scrollTo(requestedAnchor);
      const next = new URLSearchParams(searchParams);
      next.delete('s');
      setSearchParams(next, { replace: true });
    }, 130);

    return () => window.clearTimeout(timer);
    // El resto de dependencias son estables durante la lectura del deck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, requestedAnchor]);

  useEffect(() => {
    const onScroll = () => {
      const root = window.document.documentElement;
      const max = root.scrollHeight - window.innerHeight;
      setReadingProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
      setShowMobileToc(window.scrollY > 320);

      if (window.scrollY < 180) {
        setActiveId('inicio');
        return;
      }

      const sections = Array.from(
        window.document.querySelectorAll<HTMLElement>(
          '.section[data-section-id]',
        ),
      );
      let current = 'inicio';
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 128) {
          const parent = section.closest<HTMLElement>('.section');
          current = parent?.dataset.sectionId ?? section.dataset.sectionId ?? current;
        }
      }
      setActiveId(current);
    };

    let frame = 0;
    const listener = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(onScroll);
    };

    window.addEventListener('scroll', listener, { passive: true });
    window.addEventListener('resize', listener);
    listener();
    return () => {
      window.removeEventListener('scroll', listener);
      window.removeEventListener('resize', listener);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!doc || !deck) return null;

  const readCount = doc.sections.filter((section) =>
    readSections.has(section.id),
  ).length;
  const firstSection = doc.sections[0];

  return (
    <div
      className="reader-layout"
      style={{ '--toc-w': `${tocWidth}px` } as CSSProperties}
    >
      <DeckWatermark deck={deck} />

      <div
        className="reading-progress"
        role="progressbar"
        aria-label="Progreso de lectura"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(readingProgress)}
      >
        <span style={{ width: `${readingProgress}%` }} />
      </div>

      <main className="reader-main" id="contenido">
        <DeckHero
          document={doc}
          readCount={readCount}
          onStartReading={() => {
            if (firstSection) navigateTo(firstSection.id);
            else scrollTo('inicio');
          }}
          onPrint={handlePrint}
        />

        {doc.lead.length > 0 ? (
          <div className="reader-lead">
            {doc.lead.map((block, index) => (
              <BlockRenderer key={index} block={block} />
            ))}
          </div>
        ) : null}

        <div className="sections">
          {doc.sections.map((section, index) => (
            <SectionAccordion
              key={section.id}
              section={section}
              number={String(index + 1).padStart(2, '0')}
              open={printing || isSectionOpen(section.id)}
              onToggle={() => toggleSection(section.id)}
              subOpen={printing ? () => true : isSubOpen}
              onSubToggle={toggleSub}
              read={readSections.has(section.id)}
              onToggleRead={() =>
                readSections.has(section.id)
                  ? unmarkSectionRead(section.id)
                  : markSectionRead(section.id)
              }
            />
          ))}
        </div>

        {doc.sections.length === 0 ? (
          <div className="empty-inline">
            <p>Este documento no tiene secciones H2.</p>
            <p className="muted small">
              Añade encabezados con <code>##</code> para generar el índice y los
              acordeones.
            </p>
          </div>
        ) : null}

        <section className="end-card">
          <h2>Fin del deck</h2>
          <div className="end-card__actions">
            <Link className="button button--solid" to={`/deck/${deck.id}/quiz`}>
              <Target size={16} aria-hidden="true" />
              Hacer un quiz
            </Link>
            <Link className="button button--outline" to={`/deck/${deck.id}/cards`}>
              <Layers size={16} aria-hidden="true" />
              Repasar tarjetas
            </Link>
            <Link className="button button--ghost" to={`/deck/${deck.id}/qa`}>
              <HelpCircle size={16} aria-hidden="true" />
              Preguntas
            </Link>
            <Link className="button button--ghost" to={`/deck/${deck.id}/study`}>
              <BookOpen size={16} aria-hidden="true" />
              Modo estudio
            </Link>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => scrollTo('inicio')}
            >
              <ArrowUp size={16} aria-hidden="true" />
              Volver arriba
            </button>
          </div>
        </section>

        <footer className="reader-footer">
          <span className="reader-footer__brand">
            <SoffiaMark size={13} />
            <span>soffia</span>
          </span>
          <span>
            {isCloudMode
              ? 'Contenido privado · en la nube'
              : 'Contenido local · sin conexión'}
          </span>
        </footer>
      </main>

      <Toc
        sections={doc.sections}
        activeId={activeId}
        readSections={readSections}
        onNavigate={navigateTo}
        onPrint={handlePrint}
        onDownload={handleDownload}
        allExpanded={allExpanded}
        onToggleAll={toggleAll}
        mobileOpen={mobileToc}
        onClose={() => setMobileToc(false)}
        width={tocWidth}
        onWidthChange={setTocWidth}
      />

      <button
        type="button"
        className={`toc-mobile-toggle${showMobileToc ? ' is-visible' : ''}`}
        onClick={() => setMobileToc(true)}
        aria-label="Abrir índice"
      >
        <List size={17} aria-hidden="true" />
        Índice
      </button>

      <DocumentScrollbar />
    </div>
  );
}
