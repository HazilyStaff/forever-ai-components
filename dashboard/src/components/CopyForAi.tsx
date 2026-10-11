import { useEffect, useMemo, useState } from 'react';
import { copyText, fetchSource } from '../lib/browser';
import { useCatalogue } from '../lib/catalogue';
import {
  buildCollectionPrompt,
  buildComponentPrompt,
  promptSize,
  type AiLook,
  type AiMode,
  type AiMotion,
  type CollectionPromptItem,
} from '../lib/prompts';
import type { CatalogueComponent, SiteConfig } from '../lib/types';
import { getPrefs, setPrefs, usePrefs } from '../store/prefs';
import type { Collection } from '../store/userData';
import { Icon } from './Icon';
import { Dialog, Segmented, useToast } from './ui';

export function includeSourceDefault(site: SiteConfig): boolean {
  return getPrefs().aiIncludeSource ?? site.repoIsPrivate;
}

/** One-click copy using the remembered options. Returns false if the clipboard refused. */
export async function copyComponentForAi(c: CatalogueComponent, site: SiteConfig): Promise<{ ok: boolean; label: string }> {
  const { aiMode, aiLook, aiMotion } = getPrefs();
  const includeSource = includeSourceDefault(site);
  const source = includeSource ? await fetchSource(c) : undefined;
  const text = buildComponentPrompt(c, { mode: aiMode, includeSource, source, site, look: aiLook, motion: aiMotion });
  const label = `${aiMode === 'quick' ? 'Quick' : 'Detailed'} instructions${includeSource ? ' with full source' : ''}`;
  return { ok: await copyText(text), label };
}

function SizeNote({ text }: { text: string }) {
  const size = promptSize(text);
  return (
    <div className="prompt-size" data-level={size.level}>
      <span>
        {size.chars.toLocaleString('en-GB')} characters · about {size.approxTokens.toLocaleString('en-GB')} tokens
      </span>
      {size.level === 'large' && (
        <p role="status">
          <Icon name="alert" /> This is a long message. It will still work, but it uses a lot of the AI’s working memory. Consider
          switching off “Include the complete source code”.
        </p>
      )}
      {size.level === 'too-large' && (
        <p role="alert">
          <Icon name="alert" /> This is too large for a practical copy-and-paste. Many AI tools will reject or cut it off. Switch off
          “Include the complete source code”, or split the collection into smaller ones.
        </p>
      )}
    </div>
  );
}

/** The two choices that stop an AI copying the showcase literally. Shared by both dialogs. */
function IntentOptions() {
  const prefs = usePrefs();
  return (
    <>
      <div className="option-row">
        <Segmented<AiLook>
          label="Look"
          value={prefs.aiLook}
          onChange={(aiLook) => setPrefs({ aiLook })}
          options={[
            { value: 'project', label: 'Match my project’s design', title: 'Take the behaviour and motion only; colours and fonts come from your project' },
            { value: 'original', label: 'Keep original look', title: 'Keep the component’s own colours and fonts' },
          ]}
        />
        <span className="muted small">
          {prefs.aiLook === 'project'
            ? 'Takes the essence only. Colours, fonts and spacing must come from your project’s existing design.'
            : 'Keeps the component’s own colours and fonts.'}
        </span>
      </div>
      <div className="option-row">
        <Segmented<AiMotion>
          label="Animation"
          value={prefs.aiMotion}
          onChange={(aiMotion) => setPrefs({ aiMotion })}
          options={[
            { value: 'triggered', label: 'Only when triggered', title: 'Animates on tap, hover or a change of state — not by itself' },
            { value: 'continuous', label: 'Plays by itself', title: 'Runs continuously, as in the preview' },
          ]}
        />
        <span className="muted small">
          {prefs.aiMotion === 'triggered'
            ? 'The self-playing preview is treated as a demo. The AI is told to animate only on tap, hover or a change of state.'
            : 'Runs continuously, exactly as the preview does.'}
        </span>
      </div>
    </>
  );
}

function SourceToggle({
  checked,
  onChange,
  site,
  plural,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  site: SiteConfig;
  plural?: boolean;
}) {
  return (
    <label className="check-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong>Include the complete source code</strong>
        <small>
          {site.repoIsPrivate
            ? `Recommended: your repository is private, so an AI agent may not be able to open the source link${plural ? 's' : ''}.`
            : `Usually not needed: your AI agent can fetch the source from the link${plural ? 's' : ''}. Switch on if the agent has no internet access.`}
        </small>
      </span>
    </label>
  );
}

export function CopyForAiDialog({ component, onClose }: { component: CatalogueComponent; onClose: () => void }) {
  const { meta } = useCatalogue();
  const prefs = usePrefs();
  const toast = useToast();
  const includeSource = prefs.aiIncludeSource ?? meta.site.repoIsPrivate;
  const [source, setSource] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setSourceError('');
    fetchSource(component)
      .then((text) => !cancelled && setSource(text))
      .catch((error: Error) => !cancelled && setSourceError(error.message));
    return () => {
      cancelled = true;
    };
  }, [component]);

  const waiting = includeSource && source === null && !sourceError;
  const blocked = includeSource && !!sourceError;
  const text = useMemo(
    () =>
      buildComponentPrompt(component, {
        mode: prefs.aiMode,
        includeSource,
        source: source ?? '',
        site: meta.site,
        look: prefs.aiLook,
        motion: prefs.aiMotion,
      }),
    [component, prefs.aiMode, prefs.aiLook, prefs.aiMotion, includeSource, source, meta.site],
  );

  const copy = async () => {
    const ok = await copyText(text);
    toast(ok ? 'Copied. Paste it into Claude Code or Codex.' : 'Copying was blocked. Select the text and copy it manually.', {
      tone: ok ? 'success' : 'error',
    });
    if (ok) onClose();
  };

  return (
    <Dialog
      title={`Copy for AI — ${component.title}`}
      size="large"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary btn-ai" disabled={waiting || blocked} onClick={copy} data-autofocus>
            <Icon name="copy" /> {waiting ? 'Preparing…' : 'Copy for AI'}
          </button>
        </>
      }
    >
      <p className="dialog-intro">
        This copies ready-made instructions. Paste them into Claude Code or Codex inside the project where you want this component.
      </p>
      <div className="option-row">
        <Segmented<AiMode>
          label="Level of detail"
          value={prefs.aiMode}
          onChange={(aiMode) => setPrefs({ aiMode })}
          options={[
            { value: 'quick', label: 'Quick', title: 'Short instructions for a straightforward job' },
            { value: 'detailed', label: 'Detailed', title: 'Full brief with technical details, expected behaviour and testing steps' },
          ]}
        />
        <span className="muted small">
          {prefs.aiMode === 'quick'
            ? 'Short and direct. Best for simple additions.'
            : 'A full brief: technical details, expected behaviour and testing.'}
        </span>
      </div>
      <IntentOptions />
      <SourceToggle checked={includeSource} onChange={(aiIncludeSource) => setPrefs({ aiIncludeSource })} site={meta.site} />
      {blocked && (
        <p className="notice notice-error" role="alert">
          {sourceError} Switch off “Include the complete source code” to copy the instructions without it.
        </p>
      )}
      <pre className="prompt-preview" tabIndex={0} aria-label="Instructions that will be copied" data-testid="prompt-text">
        {waiting ? 'Loading the original source…' : text}
      </pre>
      {!waiting && <SizeNote text={text} />}
    </Dialog>
  );
}

export function CopyCollectionDialog({
  collection,
  onClose,
}: {
  collection: Collection;
  onClose: () => void;
}) {
  const { meta, byId } = useCatalogue();
  const toast = useToast();
  const prefs = usePrefs();
  const [includeSource, setIncludeSource] = useState(() => includeSourceDefault(meta.site));
  const [sources, setSources] = useState<Map<string, string>>(new Map());
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);

  const present = useMemo(
    () => collection.items.filter((i) => byId.get(i.id)?.status === 'ok').map((i) => ({ item: i, component: byId.get(i.id)! })),
    [collection, byId],
  );
  const missing = useMemo(() => collection.items.filter((i) => byId.get(i.id)?.status !== 'ok').map((i) => i.id), [collection, byId]);

  useEffect(() => {
    if (!includeSource) return;
    let cancelled = false;
    setLoaded(0);
    setFailed([]);
    const next = new Map<string, string>();
    (async () => {
      for (const { component } of present) {
        try {
          next.set(component.id, await fetchSource(component));
        } catch {
          if (!cancelled) setFailed((f) => [...f, component.title]);
        }
        if (cancelled) return;
        setLoaded((n) => n + 1);
      }
      if (!cancelled) setSources(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [includeSource, present]);

  const waiting = includeSource && loaded < present.length;
  const blocked = includeSource && failed.length > 0;
  const text = useMemo(() => {
    const items: CollectionPromptItem[] = present.map(({ item, component }) => ({
      component,
      note: item.note,
      source: sources.get(component.id),
    }));
    return buildCollectionPrompt(items, {
      name: collection.name,
      includeSource,
      site: meta.site,
      missing,
      look: prefs.aiLook,
      motion: prefs.aiMotion,
    });
  }, [present, sources, collection.name, includeSource, meta.site, missing, prefs.aiLook, prefs.aiMotion]);

  const copy = async () => {
    const ok = await copyText(text);
    toast(ok ? 'Collection copied. Paste it into Claude Code or Codex.' : 'Copying was blocked. Select the text and copy it manually.', {
      tone: ok ? 'success' : 'error',
    });
    if (ok) onClose();
  };

  return (
    <Dialog
      title={`Copy collection for AI — ${collection.name}`}
      size="large"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-ai"
            disabled={waiting || blocked || !present.length}
            onClick={copy}
            data-autofocus=""
          >
            <Icon name="copy" /> {waiting ? `Preparing ${loaded} of ${present.length}…` : 'Copy collection for AI'}
          </button>
        </>
      }
    >
      <p className="dialog-intro">
        One request covering {present.length === 1 ? 'the component' : `all ${present.length} components`} in this collection, with your
        notes. Paste it into Claude Code or Codex inside the project you want to improve.
      </p>
      <div className="option-row">
        <Segmented<'concise' | 'full'>
          label="What to include"
          value={includeSource ? 'full' : 'concise'}
          onChange={(value) => setIncludeSource(value === 'full')}
          options={[
            { value: 'concise', label: 'Concise', title: 'Instructions with a link to each source file' },
            { value: 'full', label: 'With complete source code', title: 'Instructions plus every component’s full source' },
          ]}
        />
        <span className="muted small">
          {includeSource
            ? 'Self-contained: works even if the AI cannot open the links.'
            : meta.site.repoIsPrivate
              ? 'Your repository is private — the AI may not be able to open these links. Prefer “With complete source code”.'
              : 'The AI fetches each source file from its link.'}
        </span>
      </div>
      <IntentOptions />
      {missing.length > 0 && (
        <p className="notice">
          {missing.length} saved component{missing.length === 1 ? ' is' : 's are'} no longer in the library and will be left out.
        </p>
      )}
      {blocked && (
        <p className="notice notice-error" role="alert">
          The source for {failed.join(', ')} could not be loaded. Choose “Concise” to copy without source code.
        </p>
      )}
      <pre className="prompt-preview" tabIndex={0} aria-label="Instructions that will be copied" data-testid="prompt-text">
        {waiting ? `Loading source code… ${loaded} of ${present.length}` : text}
      </pre>
      {!waiting && <SizeNote text={text} />}
    </Dialog>
  );
}
