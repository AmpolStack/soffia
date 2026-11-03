import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { getScrollThumbMetrics } from '../../lib/reader/scrollbar';

type Metrics = ReturnType<typeof getScrollThumbMetrics>;

const EMPTY: Metrics = {
  visible: false,
  top: 0,
  height: 0,
  maxScroll: 0,
  progress: 0,
};

export function DocumentScrollbar() {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef(0);
  const visibleRef = useRef(false);

  const setVisibleState = useCallback((next: boolean) => {
    visibleRef.current = next;
    setVisible(next);
  }, []);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const railHeight = rail.getBoundingClientRect().height;
    setMetrics(
      getScrollThumbMetrics({
        scrollTop: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        railHeight,
      }),
    );
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('has-doc-scrollbar');
    return () => {
      document.documentElement.classList.remove('has-doc-scrollbar');
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(schedule);
    observer?.observe(document.documentElement);
    observer?.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    void document.fonts?.ready.then(schedule);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [measure]);

  useEffect(() => {
    let headerOffset = 64;
    const updateHeaderOffset = () => {
      const header = document.querySelector<HTMLElement>('.app-header');
      headerOffset = header?.getBoundingClientRect().height ?? 64;
    };
    updateHeaderOffset();

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const nearEdge =
        window.innerWidth - event.clientX <= 28 &&
        event.clientY >= headerOffset;
      if (nearEdge || draggingRef.current) {
        if (!visibleRef.current) setVisibleState(true);
      } else if (!draggingRef.current && visibleRef.current) {
        setVisibleState(false);
      }
    };

    const hide = () => {
      if (!draggingRef.current) setVisibleState(false);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', updateHeaderOffset);
    document.addEventListener('mouseleave', hide);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', updateHeaderOffset);
      document.removeEventListener('mouseleave', hide);
    };
  }, [setVisibleState]);

  const scrollToRatio = (ratio: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    window.scrollTo({
      top: Math.min(max, Math.max(0, ratio * max)),
      behavior: 'instant',
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !metrics.visible) return;
    const rail = railRef.current;
    if (!rail) return;

    const rect = rail.getBoundingClientRect();
    const thumbTop = rect.top + metrics.top;
    const thumbBottom = thumbTop + metrics.height;
    const y = event.clientY;

    if (y >= thumbTop && y <= thumbBottom) {
      dragOffsetRef.current = y - thumbTop;
    } else {
      dragOffsetRef.current = metrics.height / 2;
      const travel = Math.max(1, rect.height - metrics.height);
      scrollToRatio((y - rect.top - dragOffsetRef.current) / travel);
    }

    draggingRef.current = true;
    setDragging(true);
    setVisibleState(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const rail = railRef.current;
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const travel = Math.max(1, rect.height - metrics.height);
    scrollToRatio(
      (event.clientY - rect.top - dragOffsetRef.current) / travel,
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const page = window.innerHeight * 0.9;
    const moves: Record<string, number> = {
      ArrowDown: 48,
      ArrowUp: -48,
      PageDown: page,
      PageUp: -page,
    };

    if (event.key === 'Home') {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'instant',
      });
      return;
    }

    const delta = moves[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    window.scrollBy({ top: delta, behavior: 'instant' });
  };

  const disabled = !metrics.visible;
  const className = `doc-scrollbar${
    visible && !disabled ? ' is-visible' : ''
  }${disabled ? ' is-disabled' : ''}${dragging ? ' is-dragging' : ''}`;

  return (
    <div
      ref={railRef}
      className={className}
      role="scrollbar"
      aria-label="Desplazamiento del documento"
      aria-controls="contenido"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(metrics.progress * 100)}
      tabIndex={metrics.visible ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => {
        draggingRef.current = false;
        setDragging(false);
      }}
      onKeyDown={onKeyDown}
      onFocus={() => setVisibleState(true)}
      onBlur={() => {
        if (!draggingRef.current) setVisibleState(false);
      }}
    >
      <span
        className="doc-scrollbar__thumb"
        style={{ top: `${metrics.top}px`, height: `${metrics.height}px` }}
      />
    </div>
  );
}
