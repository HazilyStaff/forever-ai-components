// Plain-English names for the metadata values that upstream uses.
// Anything not listed here still appears: it is shown with a tidied version of its raw name,
// so new upstream values turn up automatically after a sync.
import type { CatalogueComponent, FacetKey } from './types';

interface ValueInfo {
  label: string;
  hint?: string;
}

export interface FacetDef {
  key: FacetKey;
  label: string;
  hint?: string;
  /** Shown open by default in the filter panel. */
  primary: boolean;
  /** Fixed display order; otherwise most common first. */
  order?: string[];
  values: Record<string, ValueInfo>;
  pick: (c: CatalogueComponent) => string[];
}

const one = (v: string) => (v ? [v] : []);

export const FACETS: FacetDef[] = [
  {
    key: 'role',
    label: 'Component type',
    primary: true,
    values: {
      background: { label: 'Backgrounds' },
      decoration: { label: 'Decorative visuals' },
      dataviz: { label: 'Data visualisations' },
      'text-effect': { label: 'Text effects' },
      input: { label: 'Inputs, toggles & switches' },
      loader: { label: 'Loaders' },
      card: { label: 'Cards' },
      feedback: { label: 'Feedback & status' },
      hero: { label: 'Hero sections' },
      button: { label: 'Buttons' },
      '3d': { label: '3D effects' },
      nav: { label: 'Menus & navigation' },
      cursor: { label: 'Cursor effects' },
      other: { label: 'Other' },
    },
    pick: (c) => one(c.role),
  },
  {
    key: 'kind',
    label: 'Interactivity',
    primary: true,
    order: ['interactive', 'passive'],
    values: {
      interactive: { label: 'Interactive', hint: 'Responds when you move, click, drag or type.' },
      passive: { label: 'Animated, not interactive', hint: 'Plays by itself. Nothing to click.' },
    },
    pick: (c) => [c.kind],
  },
  {
    key: 'interaction',
    label: 'Responds to',
    primary: true,
    order: ['pointer', 'click', 'drag', 'keyboard', 'audio', 'autonomous'],
    values: {
      pointer: { label: 'Hover or pointer movement' },
      click: { label: 'Click or tap' },
      drag: { label: 'Dragging' },
      keyboard: { label: 'Keyboard' },
      audio: { label: 'Sound', hint: 'Reacts to audio. Microphone access is switched off in previews.' },
      autonomous: { label: 'Nothing — plays on its own' },
    },
    pick: (c) => c.interaction,
  },
  {
    key: 'perf',
    label: 'Performance',
    primary: true,
    order: ['cheap', 'medium', 'heavy'],
    values: {
      cheap: { label: 'Lightweight', hint: 'Very little work for the device. Safe almost anywhere.' },
      medium: { label: 'Moderate', hint: 'Fine on most devices. Use a few at a time.' },
      heavy: { label: 'Resource-intensive', hint: 'Demanding. Best as a single centrepiece, not on older phones.' },
    },
    pick: (c) => one(c.perf),
  },
  {
    key: 'style',
    label: 'Visual style',
    primary: true,
    values: {
      minimal: { label: 'Minimalist' },
      geometric: { label: 'Geometric' },
      gradient: { label: 'Gradient' },
      neon: { label: 'Neon' },
      organic: { label: 'Organic' },
      monochrome: { label: 'Monochrome' },
      flat: { label: 'Flat' },
      retro: { label: 'Retro' },
      glass: { label: 'Glass' },
      cosmic: { label: 'Cosmic' },
      'op-art': { label: 'Op art' },
      'art-deco': { label: 'Art Deco' },
      'art-nouveau': { label: 'Art Nouveau' },
      'de-stijl': { label: 'De Stijl' },
      'ukiyo-e': { label: 'Ukiyo-e' },
    },
    pick: (c) => c.style,
  },
  {
    key: 'theme',
    label: 'Category',
    hint: 'The themed set the component belongs to.',
    primary: false,
    values: {},
    pick: (c) => one(c.themeSlug),
  },
  {
    key: 'scheme',
    label: 'Colour scheme',
    primary: false,
    values: {
      duotone: { label: 'Two-colour' },
      dark: { label: 'Dark' },
      vibrant: { label: 'Colourful' },
      monochrome: { label: 'Monochrome' },
      light: { label: 'Light' },
    },
    pick: (c) => one(c.scheme),
  },
  {
    key: 'motion',
    label: 'Animation type',
    primary: false,
    values: {
      loop: { label: 'Repeating loop' },
      ambient: { label: 'Gentle ambient motion' },
      physics: { label: 'Physics-based' },
      reactive: { label: 'Reacts to you' },
      generative: { label: 'Ever-changing (generative)' },
      reveal: { label: 'Reveal or entrance' },
    },
    pick: (c) => one(c.motion),
  },
  {
    key: 'intensity',
    label: 'Energy',
    primary: false,
    order: ['calm', 'moderate', 'energetic'],
    values: { calm: { label: 'Calm' }, moderate: { label: 'Moderate' }, energetic: { label: 'Energetic' } },
    pick: (c) => one(c.intensity),
  },
  {
    key: 'mood',
    label: 'Mood',
    primary: false,
    values: {},
    pick: (c) => c.mood,
  },
  {
    key: 'useCases',
    label: 'Good for',
    primary: false,
    values: {
      hero: { label: 'Hero / top of page' },
      background: { label: 'Page background' },
      splash: { label: 'Splash screen' },
      'section-divider': { label: 'Section divider' },
      loading: { label: 'Loading state' },
      dashboard: { label: 'Dashboard' },
      onboarding: { label: 'Onboarding' },
      cta: { label: 'Call to action' },
      footer: { label: 'Footer' },
      'logo-mark': { label: 'Logo mark' },
      'empty-state': { label: 'Empty state' },
      pricing: { label: 'Pricing' },
      '404': { label: 'Error / 404 page' },
      testimonial: { label: 'Testimonial' },
    },
    pick: (c) => c.useCases,
  },
  {
    key: 'technique',
    label: 'Built with',
    hint: 'How the component is made. Useful to tell your AI agent.',
    primary: false,
    values: {
      raf: { label: 'JavaScript animation' },
      canvas: { label: 'Canvas drawing' },
      'css-only': { label: 'CSS only (no JavaScript)' },
      svg: { label: 'SVG graphics' },
      smil: { label: 'SVG built-in animation' },
    },
    pick: (c) => c.technique,
  },
  {
    key: 'labels',
    label: 'Qualities',
    primary: false,
    values: {
      'minimal-deps': { label: 'No extra libraries' },
      'copy-paste-safe': { label: 'Self-contained' },
      accessible: { label: 'Accessible' },
      'mobile-ready': { label: 'Works on mobile' },
      'light-ready': { label: 'Has a light version' },
      'agent-ready': { label: 'AI-agent ready' },
      'easy-to-modify': { label: 'Easy to modify' },
      'animation-heavy': { label: 'Animation-heavy' },
      themeable: { label: 'Themeable' },
    },
    pick: (c) => c.labels,
  },
];

export const FACET_BY_KEY = new Map(FACETS.map((f) => [f.key, f]));

export function humanise(value: string): string {
  if (!value) return '';
  const spaced = value.replace(/[-_]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function valueLabel(key: FacetKey, value: string, themes?: Record<string, string>): string {
  if (key === 'theme' && themes?.[value]) return themes[value];
  return FACET_BY_KEY.get(key)?.values[value]?.label ?? humanise(value);
}

export function valueHint(key: FacetKey, value: string): string | undefined {
  return FACET_BY_KEY.get(key)?.values[value]?.hint;
}

export function roleLabelSingular(role: string): string {
  const map: Record<string, string> = {
    background: 'Background',
    decoration: 'Decorative visual',
    dataviz: 'Data visualisation',
    'text-effect': 'Text effect',
    input: 'Input control',
    loader: 'Loader',
    card: 'Card',
    feedback: 'Feedback',
    hero: 'Hero section',
    button: 'Button',
    '3d': '3D effect',
    nav: 'Navigation',
    cursor: 'Cursor effect',
  };
  return map[role] ?? humanise(role);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
