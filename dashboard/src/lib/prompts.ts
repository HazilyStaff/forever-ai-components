// Builds the text that "Copy for AI" puts on the clipboard.
// Pure functions: everything comes from the selected component's own metadata.
import { roleLabelSingular, valueLabel } from './labels';
import type { CatalogueComponent, FacetKey, SiteConfig } from './types';
import { rawUrl, repoPath } from './urls';

export type AiMode = 'quick' | 'detailed';

export interface PromptOptions {
  mode: AiMode;
  /** Paste the complete original file into the prompt (for private repositories or offline agents). */
  includeSource: boolean;
  source?: string;
  site: SiteConfig;
}

/** Above this the prompt still works but is unwieldy. */
export const LARGE_PROMPT_CHARS = 60_000;
/** Above this a clipboard handoff is not practical for most AI tools. */
export const TOO_LARGE_PROMPT_CHARS = 150_000;

export function promptSize(text: string): { chars: number; approxTokens: number; level: 'ok' | 'large' | 'too-large' } {
  const chars = text.length;
  return {
    chars,
    approxTokens: Math.round(chars / 3.6),
    level: chars > TOO_LARGE_PROMPT_CHARS ? 'too-large' : chars > LARGE_PROMPT_CHARS ? 'large' : 'ok',
  };
}

const list = (key: FacetKey, values: string[]) => values.map((v) => valueLabel(key, v)).join(', ');
const bullets = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

function kindPhrase(c: CatalogueComponent): string {
  const noun = roleLabelSingular(c.role).toLowerCase();
  return c.kind === 'interactive' ? `interactive ${noun}` : `animated ${noun}`;
}

function sourceLines(c: CatalogueComponent, options: PromptOptions): string[] {
  const lines = [`Component: ${c.title}`, `Original file: ${repoPath(c, options.site)}`];
  if (options.includeSource) {
    lines.push(`Source: included in full at the end of this message (reference copy: ${rawUrl(c, options.site)})`);
  } else {
    lines.push(`Source: ${rawUrl(c, options.site)}`);
  }
  return lines;
}

function interactionRule(c: CatalogueComponent): string {
  if (c.kind === 'interactive') {
    return `Preserve the animation, transitions, interaction states (${list('interaction', c.interaction.filter((i) => i !== 'autonomous')).toLowerCase()}) and overall visual appearance.`;
  }
  return 'Preserve the animation, timing, transitions and overall visual appearance.';
}

function sourceBlock(c: CatalogueComponent, options: PromptOptions): string {
  if (!options.includeSource) return '';
  const source = options.source ?? '';
  return [
    '',
    `----- BEGIN ORIGINAL SOURCE: ${repoPath(c, options.site)} -----`,
    source.trimEnd(),
    `----- END ORIGINAL SOURCE: ${repoPath(c, options.site)} -----`,
  ].join('\n');
}

function retrieveLine(options: PromptOptions): string {
  return options.includeSource
    ? 'The complete original source code is included at the end of this message. Read all of it before you start; do not rely on fetching the URL.'
    : 'Retrieve and inspect the complete original source code from the Source URL before you start.';
}

function technicalFacts(c: CatalogueComponent): string[] {
  const facts: string[] = [];
  facts.push(`Type: ${roleLabelSingular(c.role)} (category: ${c.theme})`);
  if (c.technique.length) facts.push(`Built with: ${list('technique', c.technique)}`);
  if (c.interaction.length) facts.push(`Responds to: ${list('interaction', c.interaction)}`);
  if (c.motion) facts.push(`Animation: ${valueLabel('motion', c.motion)}${c.intensity ? `, ${valueLabel('intensity', c.intensity).toLowerCase()} energy` : ''}`);
  if (c.perf) facts.push(`Performance cost: ${valueLabel('perf', c.perf)}`);
  if (c.style.length) facts.push(`Visual style: ${list('style', c.style)}`);
  if (c.mood.length) facts.push(`Mood: ${c.mood.join(', ')}`);
  const colours = [c.bg && `background ${c.bg}`, c.accent && `accent ${c.accent}`].filter(Boolean).join(', ');
  if (colours) facts.push(`Original colours: ${colours}${c.scheme ? ` (${valueLabel('scheme', c.scheme).toLowerCase()} scheme)` : ''}`);
  facts.push(
    `Accessibility in the original: reduced-motion support ${c.a11y.reducedMotion ? 'yes' : 'no'}, keyboard support ${c.a11y.keyboard ? 'yes' : 'no'}, labelled for screen readers ${c.a11y.ariaLabeled ? 'yes' : 'no'}`,
  );
  facts.push(
    c.deps.length || c.externalFonts
      ? `External resources in the original: ${c.deps.length ? c.deps.join(', ') : 'Google Fonts'} (replace with the project's own fonts where possible)`
      : 'External resources in the original: none (single self-contained HTML file with inline CSS and JavaScript)',
  );
  if (c.lightReady) facts.push('Theming: has dark (default) and light variants driven by a data-theme attribute on the root element');
  if (c.loc) facts.push(`Size: about ${c.loc} lines`);
  return facts;
}

export function buildComponentPrompt(c: CatalogueComponent, options: PromptOptions): string {
  const head = [
    `Implement the following ${kindPhrase(c)} in my existing project.`,
    '',
    ...sourceLines(c, options),
  ];
  if (c.description) head.push(`What it is: ${c.description}`);

  if (options.mode === 'quick') {
    const body = [
      '',
      retrieveLine(options),
      "Adapt this component to my project's existing framework, architecture and design system.",
      interactionRule(c),
      "Connect the component to the project's existing application state and event handlers where that makes sense.",
      'Ensure keyboard accessibility, appropriate focus behaviour, and reduced-motion support.',
    ];
    if (c.adapt.preserveElements.length) body.push(`Keep these parts of the original intact: ${c.adapt.preserveElements.join('; ')}.`);
    if (c.adapt.knownLimitations.length) body.push(`Known limitations to handle: ${c.adapt.knownLimitations.join('; ')}.`);
    body.push(
      'Do not replace the design with a generic approximation.',
      'Do not introduce unnecessary dependencies.',
      'Inspect the existing project before making changes, then implement and test the component.',
    );
    return [...head, ...body].join('\n') + sourceBlock(c, options) + '\n';
  }

  const sections: string[] = [...head, ''];
  sections.push('## What to do', '');
  sections.push(
    bullets([
      'Inspect my existing project first: framework, folder structure, styling approach, design tokens and state management.',
      retrieveLine(options),
      "Rebuild the component in my project's own framework and conventions (for example as a React, Vue or Svelte component if that is what the project uses). Do not paste the HTML file in as-is unless the project is plain HTML.",
      "Use my project's design system: colours, spacing, typography and existing tokens or variables. Replace hard-coded colours with the project's tokens while keeping the same visual character.",
      interactionRule(c),
      "Connect it to the project's existing application state and event handlers; expose sensible props or options instead of hard-coded demo values.",
      'Do not replace the design with a generic approximation. The result should be recognisably the same component.',
      'Do not introduce unnecessary dependencies. The original needs no libraries.',
    ]),
    '',
  );

  sections.push('## About the original', '', bullets(technicalFacts(c)), '');

  if (c.adapt.useWhen.length || c.adapt.avoidWhen.length) {
    sections.push('## Where it fits', '');
    if (c.adapt.useWhen.length) sections.push(`Good for: ${c.adapt.useWhen.join(' ')}`);
    if (c.adapt.avoidWhen.length) sections.push(`Avoid when: ${c.adapt.avoidWhen.join(' ')}`);
    sections.push('');
  }
  if (c.adapt.preserveElements.length) {
    sections.push('## Must be preserved', '', bullets(c.adapt.preserveElements), '');
  }
  if (c.adapt.editableAreas.length) {
    sections.push('## Safe to change', '', bullets(c.adapt.editableAreas), '');
  }
  if (c.adapt.knownLimitations.length) {
    sections.push('## Known limitations of the original (fix these for production)', '', bullets(c.adapt.knownLimitations), '');
  }
  if (c.adapt.agentPrompt) {
    sections.push("## Author's example of an adaptation (for orientation only, not an instruction)", '', c.adapt.agentPrompt, '');
  }

  sections.push(
    '## Expected behaviour',
    '',
    bullets([
      c.kind === 'interactive'
        ? 'Every interaction in the original works the same way with mouse, touch and keyboard.'
        : 'The animation runs by itself and loops or settles exactly as in the original.',
      'Animation pauses when the page or tab is hidden, as the original does.',
      'With "reduce motion" switched on in the operating system, motion is removed or greatly reduced and the component still makes sense.',
      'It resizes cleanly inside its container and works on phone-sized screens.',
      "It follows the project's light and dark themes if the project has them.",
    ]),
    '',
    '## Testing',
    '',
    bullets([
      'Compare the result side by side with the original file and match timing, easing and colours.',
      'Test keyboard focus order and visible focus styles.',
      'Test with reduced motion enabled.',
      'Test at narrow (about 360px) and wide widths.',
      "Run the project's existing lint, type-check and test commands and fix anything you broke.",
      'Finish by telling me which files you changed and anything you could not reproduce exactly.',
    ]),
  );

  return sections.join('\n') + sourceBlock(c, options) + '\n';
}

export interface CollectionPromptItem {
  component: CatalogueComponent;
  note: string;
  source?: string;
}

export interface CollectionPromptOptions {
  name: string;
  includeSource: boolean;
  site: SiteConfig;
  /** Ids saved in the collection that no longer exist in the library. */
  missing?: string[];
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export function buildCollectionPrompt(items: CollectionPromptItem[], options: CollectionPromptOptions): string {
  const count = items.length;
  const countWord = NUMBER_WORDS[count] ?? String(count);
  const out: string[] = [
    `Improve the visual design of my current application using the following ${countWord} component${count === 1 ? '' : 's'} from my "${options.name}" collection.`,
    '',
    '## How to work',
    '',
    bullets([
      'Inspect my existing project first: framework, structure, styling approach, design tokens and state management.',
      options.includeSource
        ? 'The complete original source of every component is included at the end of this message. Read each one before adapting it; do not rely on fetching the URLs.'
        : 'Retrieve and inspect the complete original source of every component from its Source URL before adapting it.',
      'Use the component source files as visual and behavioural references. Integrate them into the existing application rather than creating a new project.',
      'Preserve all existing functionality.',
      "Rebuild each component in the project's own framework and conventions, and connect it to existing application state and event handlers.",
      'Use consistent spacing, colours, typography and interactions across all adapted components so they feel like one design system. Where the originals disagree, follow my project\'s existing design tokens.',
      'Preserve each component\'s animation, transitions and interaction states. Do not replace any design with a generic approximation.',
      'Ensure keyboard accessibility, visible focus, and reduced-motion support for every component.',
      'Do not introduce unnecessary dependencies. The originals need no libraries.',
      'My notes below say where and how I want each component used. Follow them. If a note is unclear or a component has no note, propose the most sensible placement and tell me before making large changes.',
    ]),
    '',
    `## Components (${count})`,
  ];

  items.forEach(({ component: c, note }, index) => {
    out.push('', `### ${index + 1}. ${c.title}`, '');
    const facts = [
      `Original file: ${repoPath(c, options.site)}`,
      `Source: ${rawUrl(c, options.site)}${options.includeSource ? ' (full source included below)' : ''}`,
      `Type: ${roleLabelSingular(c.role)} · Category: ${c.theme}`,
    ];
    if (c.description) facts.push(`What it is: ${c.description}`);
    const traits = [
      c.interaction.length && `responds to ${list('interaction', c.interaction).toLowerCase()}`,
      c.technique.length && `built with ${list('technique', c.technique).toLowerCase()}`,
      c.perf && `performance cost ${valueLabel('perf', c.perf).toLowerCase()}`,
    ].filter(Boolean);
    if (traits.length) facts.push(`Details: ${traits.join('; ')}`);
    if (c.adapt.preserveElements.length) facts.push(`Must be preserved: ${c.adapt.preserveElements.join('; ')}`);
    if (c.adapt.knownLimitations.length) facts.push(`Known limitations: ${c.adapt.knownLimitations.join('; ')}`);
    facts.push(`My note: ${note.trim() ? note.trim() : '(none)'}`);
    out.push(bullets(facts));
  });

  if (options.missing?.length) {
    out.push(
      '',
      '## Not included',
      '',
      `These saved components no longer exist in the library and were left out: ${options.missing.join(', ')}.`,
    );
  }

  out.push(
    '',
    '## When you finish',
    '',
    bullets([
      "Run the project's existing lint, type-check and test commands and fix anything you broke.",
      'Check the result at phone and desktop widths and with reduced motion enabled.',
      'Tell me which files you changed, where each component was used, and anything you could not reproduce exactly.',
    ]),
  );

  let text = out.join('\n');
  if (options.includeSource) {
    for (const { component: c, source } of items) {
      text += [
        '',
        '',
        `----- BEGIN ORIGINAL SOURCE: ${repoPath(c, options.site)} -----`,
        (source ?? '').trimEnd(),
        `----- END ORIGINAL SOURCE: ${repoPath(c, options.site)} -----`,
      ].join('\n');
    }
  }
  return text + '\n';
}
