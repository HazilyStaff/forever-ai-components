// Keeps the gallery smooth: only previews that are on screen run, never more than a fixed
// budget at once, and they start one after another instead of all in the same instant.

type Grant = () => void;

interface Request {
  cost: number;
  grant: Grant;
  active: boolean;
}

const lowPower =
  typeof navigator !== 'undefined' &&
  ((navigator.hardwareConcurrency ?? 8) <= 4 ||
    (typeof window !== 'undefined' && window.matchMedia('(hover: none), (pointer: coarse)').matches));

/** Budget in "cost units": a normal preview costs 1, a resource-intensive one costs 2. */
export const PREVIEW_BUDGET = lowPower ? 14 : 32;
const START_INTERVAL_MS = 70;

const queue: Request[] = [];
let used = 0;
let timer: number | null = null;

function pump() {
  timer = null;
  const next = queue.find((r) => !r.active && used + r.cost <= PREVIEW_BUDGET);
  if (!next) return;
  queue.splice(queue.indexOf(next), 1);
  next.active = true;
  used += next.cost;
  next.grant();
  schedule();
}

function schedule() {
  if (timer === null && queue.length) timer = window.setTimeout(pump, START_INTERVAL_MS);
}

/** Asks for permission to run a preview. Returns a function that gives the slot back. */
export function requestPreviewSlot(cost: number, grant: Grant): () => void {
  const request: Request = { cost, grant, active: false };
  queue.push(request);
  schedule();
  return () => {
    const index = queue.indexOf(request);
    if (index >= 0) queue.splice(index, 1);
    if (request.active) {
      request.active = false;
      used = Math.max(0, used - request.cost);
    }
    schedule();
  };
}

// One shared observer for every card, instead of one per card.
const visibilityCallbacks = new WeakMap<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | null = null;

export function observeVisibility(element: Element, callback: (visible: boolean) => void): () => void {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visibilityCallbacks.get(entry.target)?.(entry.isIntersecting);
      },
      { rootMargin: '120px 0px' },
    );
  }
  visibilityCallbacks.set(element, callback);
  observer.observe(element);
  return () => {
    visibilityCallbacks.delete(element);
    observer?.unobserve(element);
  };
}

// One shared listener for messages coming from preview frames.
type FrameMessage = { type: 'fc:ready' } | { type: 'fc:error'; message: string };
const frameHandlers = new Map<MessageEventSource, (message: FrameMessage) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (!event.source) return;
    const handler = frameHandlers.get(event.source);
    const data = event.data as { type?: unknown; message?: unknown } | null;
    if (!handler || !data || typeof data.type !== 'string') return;
    if (data.type === 'fc:ready') handler({ type: 'fc:ready' });
    else if (data.type === 'fc:error') handler({ type: 'fc:error', message: String(data.message ?? '').slice(0, 300) });
  });
}

export function listenToFrame(frame: Window, handler: (message: FrameMessage) => void): () => void {
  frameHandlers.set(frame, handler);
  return () => {
    frameHandlers.delete(frame);
  };
}
