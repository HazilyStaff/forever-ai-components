// Builds the text that "Copy for AI" puts on the clipboard.
// Pure functions: everything comes from the selected component's own metadata.
//
// Two principles shape the default output, because AI agents otherwise copy the showcase file
// literally:
//   1. Essence, not skin. The mechanism, motion and behaviour are what is wanted. Colours, fonts,
//      spacing and so on must come from the target project's own design language.
//   2. The preview is a demo. Showcase files animate by themselves so they look alive in a gallery.
//      In a real project the animation belongs to a trigger (tap, hover, state change…).
import { roleLabelSingular, valueLabel } from './labels';
import type { CatalogueComponent, FacetKey, SiteConfig } from './types';
import { rawUrl, repoPath } from './urls';

export type AiMode = 'quick' | 'detailed';
/** project: restyle with the target project's design language. original: keep the component's own look. */
export type AiLook = 'project' | 'original';
/** triggered: animate only in response to its trigger. continuous: plays by itself, as in the preview. */
export type AiMotion = 'triggered' | 'continuous';

export interface PromptOptions {
  mode: AiMode;
  /** Paste the complete original file into the prompt (for private repositories or offline agents). */
  includeSource: boolean;
  source?: string;
  site: SiteConfig;
  look?: AiLook;
  motion?: AiMotion;
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

const realInteractions = (c: CatalogueComponent) => c.interaction.filter((i) => i !== 'autonomous');

// Items in the author's "must keep" list that only serve the showcase gallery (its theme switcher,
// its wrapper) or pin the original colours. They contradict "use my project's design".
const SHOWCASE_ONLY = /theme hook|theme token|\?theme=|forever:theme|data-theme|iife|caption|colou?r|palette|font|hex\b/i;

// Items that describe the self-playing demo itself. They contradict "animate only when triggered".
const DEMO_ONLY = /demo|auto[- ]?cycl|auto[- ]?play|idle/i;

function mechanismsToKeep(c: CatalogueComponent, look: AiLook, motion: AiMotion): string[] {
  return c.adapt.preserveElements.filter(
    (item) => (look === 'original' || !SHOWCASE_ONLY.test(item)) && (motion === 'continuous' || !DEMO_ONLY.test(item)),
  );
}

/** When should this component animate in a real project? Derived from its type and interactions. */
export function triggerGuidance(c: CatalogueComponent): string {
  const interactions = realInteractions(c);
  const named = interactions.length ? list('interaction', interactions).toLowerCase() : '';
  switch (c.role) {
    case 'loader':
      return 'Trigger: my app actually being busy. It animates only while a real loading or working state is active, and is stopped and removed the moment that state ends.';
    case 'feedback':
      return `Trigger: the matching event in my app (for example success, error, saved, notification${named ? `, or the user's ${named}` : ''}). It plays once when that happens, then settles.`;
    case 'button':
    case 'input':
    case 'nav':
    case 'card':
    case 'cursor':
      return `Trigger: the user's own action${named ? ` (${named})` : ' (tap, click, hover, focus or a change of its value, whichever suits the control)'}. It animates once per action and otherwise sits still in its resting state.`;
    case 'dataviz':
      return `Trigger: its data appearing or changing${named ? `, and the user's ${named}` : ''}. It animates into place when the data arrives or updates, then holds still.`;
    default:
      return interactions.length
        ? `Trigger: the user's ${named}. It responds to that and otherwise rests.`
        : 'Trigger: this is an ambient piece with no natural user action. Do not start an endless loop by default. Play it on the trigger that fits where I am using it (coming into view, hover on its container, or a change of state). If my request does not make the trigger obvious, ask me one short question before you build it.';
  }
}

function motionRules(c: CatalogueComponent, motion: AiMotion): string[] {
  if (motion === 'continuous') {
    return [
      'Motion: I want it to play by itself, as in the original preview. Keep it paused while the page or tab is hidden.',
      'Still remove the showcase extras: the corner caption label, the full-page background and any fixed demo sizing.',
    ];
  }
  return [
    'The original file is a SHOWCASE DEMO. It plays by itself (auto-cycling timers, looping or idle "demo" animation) only so that it looks alive in a gallery. That self-running behaviour is NOT part of the component. Do not reproduce it.',
    triggerGuidance(c),
    'If I named a trigger in my own message, mine wins.',
    'Delete every demo driver: auto-cycle timers and intervals, idle or "resume demo" loops, self-starting animation on load. Also drop the showcase extras: the corner caption label, the full-page background and any fixed demo sizing.',
    'At rest, nothing moves.',
  ];
}

function lookRules(look: AiLook): string[] {
  if (look === 'original') {
    return [
      "Look: keep the original's colours, typography and proportions, as close to the source as the project allows.",
      "Still use the project's own framework, file structure and coding conventions.",
    ];
  }
  return [
    'I want the ESSENCE of this component, not its skin. The essence is: what it does, how it moves (timing, easing, sequence, physics), its structure and its interaction behaviour.',
    "Its skin is NOT wanted: do not carry over the original's colours, gradients, fonts, font sizes, spacing, corner radii, shadows, borders or background.",
    "My project already has a visual design language and it must be strictly adhered to. Take every colour, typeface, size, spacing value, radius and shadow from the project's existing tokens, variables, theme or established components. Introduce no new colour values and no new fonts.",
    'Where the original uses a colour for a role (accent, track, surface, text), map that role to the nearest existing token in my project. If there is no suitable token, ask me rather than inventing one.',
    'The result should look like it was always part of my project, and behave like the original.',
  ];
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

function technicalFacts(c: CatalogueComponent, look: AiLook): string[] {
  const facts: string[] = [];
  facts.push(`Type: ${roleLabelSingular(c.role)} (category: ${c.theme})`);
  if (c.technique.length) facts.push(`Built with: ${list('technique', c.technique)}`);
  if (realInteractions(c).length) facts.push(`Real interactions: ${list('interaction', realInteractions(c))}`);
  if (c.interaction.includes('autonomous')) facts.push('The showcase file also runs a self-playing demo (see "When it animates").');
  if (c.motion) facts.push(`Animation: ${valueLabel('motion', c.motion)}${c.intensity ? `, ${valueLabel('intensity', c.intensity).toLowerCase()} energy` : ''}`);
  if (c.perf) facts.push(`Performance cost: ${valueLabel('perf', c.perf)}`);
  const colours = [c.bg && `background ${c.bg}`, c.accent && `accent ${c.accent}`].filter(Boolean).join(', ');
  if (colours) {
    facts.push(
      look === 'original'
        ? `Original colours: ${colours}`
        : `Original colours (for orientation only, do NOT use them): ${colours}`,
    );
  }
  facts.push(
    `Accessibility in the original: reduced-motion support ${c.a11y.reducedMotion ? 'yes' : 'no'}, keyboard support ${c.a11y.keyboard ? 'yes' : 'no'}, labelled for screen readers ${c.a11y.ariaLabeled ? 'yes' : 'no'}`,
  );
  facts.push(
    c.deps.length || c.externalFonts
      ? `External resources in the original: ${c.deps.length ? c.deps.join(', ') : 'Google Fonts'} (do not add them; use the project's own fonts)`
      : 'External resources in the original: none (single self-contained HTML file with inline CSS and JavaScript)',
  );
  if (c.loc) facts.push(`Size: about ${c.loc} lines`);
  return facts;
}

const PLAN_LINE =
  'Before you write code, tell me in two or three lines: (1) what will trigger the animation, and (2) which of my existing design tokens you will use for its colours and type. Then carry on without waiting, unless you had to ask me a question above.';

export function buildComponentPrompt(c: CatalogueComponent, options: PromptOptions): string {
  const look = options.look ?? 'project';
  const motion = options.motion ?? 'triggered';
  const keep = mechanismsToKeep(c, look, motion);
  const head = [`Add the following ${kindPhrase(c)} to my existing project.`, '', ...sourceLines(c, options)];
  if (c.description) head.push(`What it is: ${c.description}`);

  if (options.mode === 'quick') {
    const body = [
      '',
      'Inspect my existing project before making changes (framework, structure, styling approach, design tokens), then:',
      retrieveLine(options),
      '',
      'WHAT I WANT FROM IT',
      ...lookRules(look),
      '',
      'WHEN IT ANIMATES',
      ...motionRules(c, motion),
      '',
      'HOW TO BUILD IT',
      "Rebuild it in my project's own framework and conventions; do not paste the HTML file in.",
      'Reproduce the motion faithfully: same sequence, timing and easing. Do not water the mechanism down to a generic fade or slide.',
      "Connect it to the project's existing application state and event handlers.",
      'Ensure keyboard accessibility, visible focus, and reduced-motion support.',
    ];
    if (keep.length) body.push(`Mechanisms worth keeping (adapt them, do not copy literally): ${keep.join('; ')}.`);
    if (c.adapt.knownLimitations.length) body.push(`Known limitations of the original to fix: ${c.adapt.knownLimitations.join('; ')}.`);
    body.push('Do not introduce unnecessary dependencies.', '', PLAN_LINE, 'Then implement and test the component.');
    return [...head, ...body].join('\n') + sourceBlock(c, options) + '\n';
  }

  const sections: string[] = [...head, ''];
  sections.push('## What I want from it', '', bullets(lookRules(look)), '');
  sections.push('## When it animates', '', bullets(motionRules(c, motion)), '');
  sections.push(
    '## How to build it',
    '',
    bullets([
      'Inspect my existing project first: framework, folder structure, styling approach, design tokens and state management.',
      retrieveLine(options),
      "Rebuild the component in my project's own framework and conventions (for example as a React, Vue or Svelte component if that is what the project uses). Do not paste the HTML file in as-is unless the project is plain HTML.",
      'Reproduce the motion faithfully: same sequence, timing, easing and physics. Do not water the mechanism down to a generic fade or slide.',
      "Connect it to the project's existing application state and event handlers; expose sensible props or options instead of hard-coded demo values.",
      'Do not introduce unnecessary dependencies. The original needs no libraries.',
      PLAN_LINE,
    ]),
    '',
  );

  sections.push('## About the original', '', bullets(technicalFacts(c, look)), '');

  if (c.adapt.useWhen.length || c.adapt.avoidWhen.length) {
    sections.push('## Where it fits', '');
    if (c.adapt.useWhen.length) sections.push(`Good for: ${c.adapt.useWhen.join(' ')}`);
    if (c.adapt.avoidWhen.length) sections.push(`Avoid when: ${c.adapt.avoidWhen.join(' ')}`);
    sections.push('');
  }
  if (keep.length) {
    sections.push('## Mechanisms worth keeping (adapt them, do not copy literally)', '', bullets(keep), '');
  }
  if (c.adapt.knownLimitations.length) {
    sections.push('## Known limitations of the original (fix these)', '', bullets(c.adapt.knownLimitations), '');
  }

  const behaviour =
    motion === 'continuous'
      ? [
          'The animation runs by itself and loops or settles as in the original.',
          'Animation pauses when the page or tab is hidden.',
        ]
      : [
          'On load and at rest, nothing moves.',
          'The animation plays when its trigger happens, and only then. It does not repeat by itself.',
          c.kind === 'interactive'
            ? 'Every real interaction in the original works the same way with mouse, touch and keyboard.'
            : 'It works with mouse, touch and keyboard wherever a user action is the trigger.',
        ];
  sections.push(
    '## Expected behaviour',
    '',
    bullets([
      ...behaviour,
      'With "reduce motion" switched on in the operating system, motion is removed or greatly reduced and the component still makes sense.',
      'It resizes cleanly inside its container and works on phone-sized screens.',
      "It follows the project's light and dark themes if the project has them.",
    ]),
    '',
    '## Check your own work',
    '',
    bullets([
      ...(motion === 'triggered' ? ['Load the page and wait: confirm nothing animates until the trigger happens, and that no timer or loop was carried over from the demo.'] : []),
      ...(look === 'project'
        ? ["Search your change for colour values and font names: every one must come from my project's existing tokens. None may come from the original file."]
        : []),
      'Compare the motion with the original file and match its sequence, timing and easing.',
      'Test keyboard focus order and visible focus styles.',
      'Test with reduced motion enabled.',
      'Test at narrow (about 360px) and wide widths.',
      "Run the project's existing lint, type-check and test commands and fix anything you broke.",
      'Finish by telling me which files you changed, what triggers the animation, which tokens you used, and anything you could not reproduce exactly.',
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
  look?: AiLook;
  motion?: AiMotion;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export function buildCollectionPrompt(items: CollectionPromptItem[], options: CollectionPromptOptions): string {
  const look = options.look ?? 'project';
  const motion = options.motion ?? 'triggered';
  const count = items.length;
  const countWord = NUMBER_WORDS[count] ?? String(count);
  const out: string[] = [
    `Improve my current application using the following ${countWord} component${count === 1 ? '' : 's'} from my "${options.name}" collection.`,
    '',
    '## What I want from them',
    '',
    bullets(
      look === 'project'
        ? [
            'I want the ESSENCE of each component, not its skin: what it does, how it moves (timing, easing, sequence, physics), its structure and its interaction behaviour.',
            "Do not carry over the originals' colours, gradients, fonts, sizes, spacing, corner radii, shadows or backgrounds.",
            "My project already has a visual design language and it must be strictly adhered to. Take every colour, typeface, size, spacing value, radius and shadow from the project's existing tokens, variables, theme or established components. Introduce no new colour values and no new fonts. If no suitable token exists for something, ask me rather than inventing one.",
            'All of them must end up looking like one family that was always part of my project.',
          ]
        : [
            "Keep each original's colours, typography and proportions as close to the source as the project allows.",
            'Use consistent spacing, colours, typography and interactions across all adapted components so they feel like one design system.',
          ],
    ),
    '',
    '## When they animate',
    '',
    bullets(
      motion === 'triggered'
        ? [
            'The original files are SHOWCASE DEMOS. They play by themselves (auto-cycling timers, looping or idle "demo" animation) only so that they look alive in a gallery. That is NOT part of the components. Do not reproduce it.',
            'Each component below lists its trigger. It animates only when that trigger happens; at rest, nothing moves. If I named a trigger in a note or in my own message, mine wins.',
            'Delete every demo driver (auto-cycle timers, intervals, idle loops, self-starting animation) and the showcase extras: corner caption labels, full-page backgrounds, fixed demo sizing.',
          ]
        : [
            'I want them to play by themselves, as in the original previews. Keep them paused while the page or tab is hidden.',
            'Still remove the showcase extras: corner caption labels, full-page backgrounds, fixed demo sizing.',
          ],
    ),
    '',
    '## How to work',
    '',
    bullets([
      'Inspect my existing project first: framework, structure, styling approach, design tokens and state management.',
      options.includeSource
        ? 'The complete original source of every component is included at the end of this message. Read each one before adapting it; do not rely on fetching the URLs.'
        : 'Retrieve and inspect the complete original source of every component from its Source URL before adapting it.',
      'Use the source files as behavioural references. Integrate them into the existing application rather than creating a new project.',
      'Preserve all existing functionality.',
      "Rebuild each component in the project's own framework and conventions, and connect it to existing application state and event handlers.",
      'Reproduce each motion faithfully: same sequence, timing and easing. Do not water a mechanism down to a generic fade or slide.',
      'Ensure keyboard accessibility, visible focus, and reduced-motion support for every component.',
      'Do not introduce unnecessary dependencies. The originals need no libraries.',
      'My notes below say where and how I want each component used. Follow them. If a note is unclear or a component has no note, propose the most sensible placement and tell me before making large changes.',
      'Before you write code, list for each component in one line: its trigger and the project tokens you will use. Then carry on without waiting, unless you had to ask me a question.',
    ]),
    '',
    `## Components (${count})`,
  ];

  items.forEach(({ component: c, note }, index) => {
    out.push('', `### ${index + 1}. ${c.title}`, '');
    const keep = mechanismsToKeep(c, look, motion);
    const facts = [
      `Original file: ${repoPath(c, options.site)}`,
      `Source: ${rawUrl(c, options.site)}${options.includeSource ? ' (full source included below)' : ''}`,
      `Type: ${roleLabelSingular(c.role)} · Category: ${c.theme}`,
    ];
    if (c.description) facts.push(`What it is: ${c.description}`);
    if (motion === 'triggered') facts.push(triggerGuidance(c));
    const traits = [
      c.technique.length && `built with ${list('technique', c.technique).toLowerCase()}`,
      c.perf && `performance cost ${valueLabel('perf', c.perf).toLowerCase()}`,
    ].filter(Boolean);
    if (traits.length) facts.push(`Details: ${traits.join('; ')}`);
    if (keep.length) facts.push(`Mechanisms worth keeping (adapt, do not copy literally): ${keep.join('; ')}`);
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
      ...(motion === 'triggered' ? ['Load each screen and wait: confirm nothing animates until its trigger happens.'] : []),
      ...(look === 'project' ? ["Confirm every colour and font in your change comes from my project's existing tokens, none from the original files."] : []),
      "Run the project's existing lint, type-check and test commands and fix anything you broke.",
      'Check the result at phone and desktop widths and with reduced motion enabled.',
      'Tell me which files you changed, where each component was used, what triggers each one, and anything you could not reproduce exactly.',
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
