export type ComponentStatus = 'ok' | 'missing' | 'broken';

export interface Adaptation {
  useWhen: string[];
  avoidWhen: string[];
  agentPrompt: string;
  editableAreas: string[];
  preserveElements: string[];
  knownLimitations: string[];
}

export interface CatalogueComponent {
  /** Stable identity: path inside the collection without ".html". Never an array position. */
  id: string;
  file: string;
  title: string;
  theme: string;
  themeSlug: string;
  role: string;
  description: string;
  technique: string[];
  style: string[];
  motion: string;
  intensity: string;
  interaction: string[];
  perf: string;
  scheme: string;
  tone: string;
  bg: string;
  accent: string;
  colors: string[];
  deps: string[];
  useCases: string[];
  mood: string[];
  labels: string[];
  tags: string[];
  a11y: { reducedMotion: boolean; keyboard: boolean; ariaLabeled: boolean; seizureSafe: boolean };
  loc: number;
  bytes: number;
  hash: string;
  status: ComponentStatus;
  issues: string[];
  indexed: boolean;
  lightReady: boolean;
  externalFonts: boolean;
  microphone: boolean;
  adapt: Adaptation;
  /** Derived in the browser. */
  kind: 'interactive' | 'passive';
  /** Position in the upstream index: used only for the default sort order. */
  order: number;
}

export interface SiteConfig {
  siteName: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  upstreamOwner: string;
  upstreamName: string;
  componentsDir: string;
  repoIsPrivate: boolean;
}

export interface Health {
  builtAt: string;
  indexed: number;
  listed: number;
  validFiles: number;
  filesOnDisk: number;
  missing: string[];
  broken: string[];
  duplicates: string[];
  unindexed: string[];
  invalidEntries: string[];
  withoutGuidance: number;
  categories: number;
  types: number;
  warnings: string[];
  fatal: string[];
  ok: boolean;
}

export interface ChangeEntry {
  id: string;
  title: string;
}

export interface SyncReport {
  checkedAt: string;
  upstreamCommit: string;
  added: ChangeEntry[];
  modified: ChangeEntry[];
  deleted: ChangeEntry[];
}

export interface RemovedComponent {
  id: string;
  title: string;
  removedAt: string;
}

export interface Catalogue {
  meta: {
    builtAt: string;
    commit: string;
    version: string;
    upstreamSchemaVersion: number | null;
    health: Health;
    site: SiteConfig;
    lastSync: SyncReport | null;
  };
  themes: Record<string, string>;
  components: CatalogueComponent[];
  removed: RemovedComponent[];
  byId: Map<string, CatalogueComponent>;
  removedById: Map<string, RemovedComponent>;
}

export type FacetKey =
  | 'role'
  | 'kind'
  | 'interaction'
  | 'perf'
  | 'style'
  | 'theme'
  | 'motion'
  | 'intensity'
  | 'scheme'
  | 'mood'
  | 'useCases'
  | 'technique'
  | 'labels';

export type FilterState = Partial<Record<FacetKey, string[]>>;

export type Density = 'compact' | 'comfortable' | 'large';
export type SortKey = 'relevance' | 'default' | 'name' | 'category' | 'type' | 'lightest' | 'recent';
