import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { listenToFrame, observeVisibility, requestPreviewSlot } from '../lib/previewManager';
import type { CatalogueComponent } from '../lib/types';
import { previewUrl } from '../lib/urls';
import { Icon } from './Icon';

export type PreviewState = 'idle' | 'loading' | 'ready' | 'error';

interface Props {
  component: CatalogueComponent;
  theme: 'dark' | 'light';
  /** Size the component believes it has. Omit to fill the box at its real size. */
  virtual?: { width: number; height: number };
  /** cover: scale to the box width (gallery). contain: fit inside the box (viewer). */
  fit?: 'cover' | 'contain';
  /** lazy: only run while on screen and within the gallery budget. always: run immediately. */
  mode?: 'lazy' | 'always';
  /** Whether the pointer can reach the component. Off when a card overlay handles taps. */
  interactive?: boolean;
  paused?: boolean;
  /** Overrides the component's background colour (#rrggbb), or null for its own. */
  background?: string | null;
  /** Change this number to restart the component from the beginning. */
  restartKey?: number;
  onStateChange?: (state: PreviewState) => void;
  className?: string;
}

const READY_GRACE_MS = 2500;
const LOAD_TIMEOUT_MS = 15000;
const LEAVE_GRACE_MS = 900;

export function LivePreview({
  component,
  theme,
  virtual,
  fit = 'cover',
  mode = 'lazy',
  interactive = true,
  paused = false,
  background = null,
  restartKey = 0,
  onStateChange,
  className,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [live, setLive] = useState(mode === 'always');
  const [state, setState] = useState<PreviewState>(mode === 'always' ? 'loading' : 'idle');
  const [errorDetail, setErrorDetail] = useState('');
  const [retry, setRetry] = useState(0);
  const [scale, setScale] = useState(1);
  // The theme used for the address. Later theme changes are sent as a message, not a reload.
  const [initialTheme, setInitialTheme] = useState(theme);
  const unavailable = component.status !== 'ok';

  const stateRef = useRef(onStateChange);
  stateRef.current = onStateChange;
  useEffect(() => {
    stateRef.current?.(state);
  }, [state]);

  // Lazy mode: run only while visible and while the gallery budget allows.
  useEffect(() => {
    if (mode !== 'lazy' || unavailable) return;
    const box = boxRef.current;
    if (!box) return;
    let release: (() => void) | null = null;
    let leaveTimer: number | null = null;
    const stopObserving = observeVisibility(box, (visible) => {
      if (visible) {
        if (leaveTimer !== null) {
          window.clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        if (!release) {
          release = requestPreviewSlot(component.perf === 'heavy' ? 2 : 1, () => {
            setInitialTheme(themeRef.current);
            setState('loading');
            setLive(true);
          });
        }
      } else if (release && leaveTimer === null) {
        leaveTimer = window.setTimeout(() => {
          leaveTimer = null;
          release?.();
          release = null;
          setLive(false);
          setState('idle');
        }, LEAVE_GRACE_MS);
      }
    });
    return () => {
      stopObserving();
      if (leaveTimer !== null) window.clearTimeout(leaveTimer);
      release?.();
    };
  }, [mode, unavailable, component.id, component.perf]);

  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Restart: reload the frame from scratch.
  useEffect(() => {
    if (mode === 'always' && !unavailable) {
      setInitialTheme(themeRef.current);
      setState('loading');
      setErrorDetail('');
    }
  }, [restartKey, retry, mode, unavailable, component.id]);

  // Scale the frame to its box.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !virtual) {
      setScale(1);
      return;
    }
    const measure = () => {
      const { width, height } = box.getBoundingClientRect();
      if (!width) return;
      const next = fit === 'cover' ? width / virtual.width : Math.min(width / virtual.width, height / virtual.height, 1);
      setScale(Math.max(0.05, Math.round(next * 1000) / 1000));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [virtual?.width, virtual?.height, fit]);

  const frameKey = `${component.id}:${component.hash}:${restartKey}:${retry}`;

  // Readiness and failure detection for the running frame. Layout effect: the listener must be
  // in place before the frame can possibly finish loading.
  useLayoutEffect(() => {
    if (!live || unavailable) return;
    const frame = frameRef.current;
    const target = frame?.contentWindow;
    if (!frame || !target) return;
    let settled = false;
    let graceTimer: number | null = null;
    const fail = (detail: string) => {
      if (settled) return;
      settled = true;
      setErrorDetail(detail);
      setState('error');
    };
    const stopListening = listenToFrame(target, (message) => {
      if (message.type === 'fc:ready') {
        settled = true;
        setState('ready');
      }
    });
    const onLoad = () => {
      // A real component announces itself. Anything else (a missing file, a sign-in page) does not.
      graceTimer = window.setTimeout(() => fail('The file loaded but is not a working component.'), READY_GRACE_MS);
    };
    frame.addEventListener('load', onLoad);
    const timeout = window.setTimeout(() => fail('The preview took too long to load.'), LOAD_TIMEOUT_MS);
    return () => {
      stopListening();
      frame.removeEventListener('load', onLoad);
      window.clearTimeout(timeout);
      if (graceTimer !== null) window.clearTimeout(graceTimer);
    };
  }, [live, unavailable, frameKey]);

  // Controls are sent as messages; the component's own code is never edited.
  const post = (message: unknown) => frameRef.current?.contentWindow?.postMessage(message, '*');
  useEffect(() => {
    if (state === 'ready') post({ type: paused ? 'fc:pause' : 'fc:resume' });
  }, [paused, state]);
  useEffect(() => {
    if (state === 'ready') post({ type: 'fc:bg', color: background ?? '' });
  }, [background, state]);
  useEffect(() => {
    if (state === 'ready' && theme !== initialTheme) post({ type: 'forever:theme', theme });
  }, [theme, state, initialTheme]);

  const placeholderStyle = {
    '--pv-bg': component.bg || undefined,
    '--pv-accent': component.accent || undefined,
  } as CSSProperties;

  const frameStyle: CSSProperties = virtual
    ? {
        width: virtual.width,
        height: virtual.height,
        transform: `scale(${scale})`,
        ...(fit === 'contain'
          ? { left: '50%', top: '50%', marginLeft: (-virtual.width * scale) / 2, marginTop: (-virtual.height * scale) / 2 }
          : {}),
      }
    : { width: '100%', height: '100%' };

  return (
    <div
      ref={boxRef}
      className={`preview ${className ?? ''}`}
      data-state={unavailable ? 'unavailable' : state}
      data-fit={virtual ? fit : 'fill'}
      style={{ ...placeholderStyle, ...(virtual && fit === 'cover' ? { aspectRatio: `${virtual.width} / ${virtual.height}` } : {}) }}
    >
      {!unavailable && live && state !== 'error' && (
        <iframe
          key={frameKey}
          ref={frameRef}
          className="preview-frame"
          title={`Live preview of ${component.title}`}
          src={previewUrl(component, initialTheme)}
          sandbox="allow-scripts"
          allow=""
          referrerPolicy="no-referrer"
          loading="eager"
          tabIndex={interactive ? 0 : -1}
          style={{ ...frameStyle, pointerEvents: interactive ? 'auto' : 'none' }}
        />
      )}
      {!unavailable && state !== 'ready' && state !== 'error' && (
        <div className="preview-placeholder" aria-hidden="true">
          <span className="preview-pulse" />
        </div>
      )}
      {unavailable && (
        <div className="preview-message" role="img" aria-label="Preview unavailable">
          <Icon name="alert" />
          <strong>Preview unavailable</strong>
          <span>{component.issues[0] ?? 'This component’s file is missing from the library.'}</span>
        </div>
      )}
      {!unavailable && state === 'error' && (
        <div className="preview-message" role="alert">
          <Icon name="alert" />
          <strong>Preview didn’t load</strong>
          <span>{errorDetail}</span>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              setErrorDetail('');
              setState('loading');
              setLive(true);
              setRetry((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
