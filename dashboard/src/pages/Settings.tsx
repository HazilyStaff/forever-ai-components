import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Dialog, Segmented, useToast } from '../components/ui';
import { downloadText } from '../lib/browser';
import { useCatalogue } from '../lib/catalogue';
import { formatDate } from '../lib/labels';
import type { ChangeEntry } from '../lib/types';
import { setPrefs, usePrefs, type Prefs } from '../store/prefs';
import { parseBackup, storageIsPersistent, userStore, useUserData, type ImportMode, type ImportSummary, type UserData } from '../store/userData';

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'bad' }) {
  return (
    <div className="stat" data-tone={tone}>
      <dt>{label}</dt>
      <dd>{typeof value === 'number' ? value.toLocaleString('en-GB') : value}</dd>
    </div>
  );
}

function ChangeList({ title, items }: { title: string; items: ChangeEntry[] }) {
  if (!items.length) return null;
  return (
    <details className="advanced">
      <summary>
        {title} ({items.length})
      </summary>
      <ul className="plain-list">
        {items.slice(0, 200).map((item) => (
          <li key={item.id}>
            {item.title} <code>{item.id}</code>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Settings() {
  const { meta } = useCatalogue();
  const prefs = usePrefs();
  const data = useUserData();
  const toast = useToast();
  const location = useLocation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: UserData; summary: ImportSummary; name: string } | null>(null);
  const [canUndo, setCanUndo] = useState(() => userStore.canUndoImport());
  const health = meta.health;
  const sync = meta.lastSync;
  const collectionItems = data.collections.reduce((n, c) => n + c.items.length, 0);
  const problems = health.missing.length + health.broken.length;
  const repoUrl = `https://github.com/${meta.site.repoOwner}/${meta.site.repoName}`;

  useEffect(() => {
    document.title = `Settings · ${meta.site.siteName}`;
  }, [meta.site.siteName]);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);

  const exportBackup = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`forever-components-backup-${stamp}.json`, JSON.stringify(userStore.exportBackup(), null, 2), 'application/json');
    toast('Backup file downloaded. Keep it somewhere safe.', { tone: 'success' });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const result = parseBackup(await file.text());
    if (fileInput.current) fileInput.current.value = '';
    if (!result.ok) {
      toast(result.message, { tone: 'error' });
      return;
    }
    setPending({ data: result.data, summary: result.summary, name: file.name });
  };

  const runImport = (mode: ImportMode) => {
    if (!pending) return;
    userStore.importBackup(pending.data, mode);
    setPending(null);
    setCanUndo(true);
    toast(mode === 'merge' ? 'Backup added to what you already had.' : 'Your saved items were replaced by the backup.', {
      tone: 'success',
      action: {
        label: 'Undo',
        run: () => {
          userStore.undoImport();
          setCanUndo(false);
        },
      },
    });
  };

  return (
    <div className="page settings">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <section className="panel" id="appearance">
        <h2>Appearance</h2>
        <div className="setting-row">
          <div>
            <strong>Theme</strong>
            <p className="muted small">Live previews follow this where a component has a light version.</p>
          </div>
          <Segmented<Prefs['theme']>
            label="Theme"
            value={prefs.theme}
            onChange={(theme) => setPrefs({ theme })}
            options={[
              { value: 'dark', label: 'Dark', icon: 'moon' },
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'system', label: 'Match device', icon: 'desktop' },
            ]}
          />
        </div>
      </section>

      <section className="panel" id="backup">
        <h2>Your saved items</h2>
        <dl className="stats">
          <Stat label="Favourites" value={Object.keys(data.favourites).length} />
          <Stat label="Collections" value={data.collections.length} />
          <Stat label="Components in collections" value={collectionItems} />
        </dl>
        <div className="callout">
          <Icon name="info" />
          <div>
            <strong>Saved on this device, in this browser — not synced.</strong>
            <p>
              Favourites, collections and notes live inside this browser. Your Windows PC, iPad and iPhone each keep their own separate set,
              and nothing is uploaded anywhere. To move them to another device, or to keep a safe copy, export a backup file here and import
              it there.
            </p>
            <p className="muted small">
              Clearing this browser’s website data removes them. On iPhone and iPad, Safari may clear a website’s saved data if you don’t
              visit for several weeks — adding this site to your Home Screen avoids that. Export a backup now and then.
            </p>
            {!storageIsPersistent && (
              <p className="notice notice-error">This browser is blocking storage (private browsing?), so nothing will be kept after you close this tab.</p>
            )}
          </div>
        </div>
        <div className="source-actions">
          <button type="button" className="btn btn-primary" onClick={exportBackup} data-testid="export-backup">
            <Icon name="download" /> Export backup file
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} data-testid="import-backup">
            <Icon name="upload" /> Import backup file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Choose a backup file"
            data-testid="import-file"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {canUndo && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                userStore.undoImport();
                setCanUndo(false);
                toast('Your saved items are back to how they were before the last import.', { tone: 'success' });
              }}
            >
              <Icon name="restart" /> Undo last import
            </button>
          )}
        </div>
      </section>

      <section className="panel" id="ai">
        <h2>Copy for AI</h2>
        <div className="setting-row">
          <div>
            <strong>Level of detail</strong>
            <p className="muted small">Quick is short and direct. Detailed adds technical background, expected behaviour and testing steps.</p>
          </div>
          <Segmented
            label="Level of detail"
            value={prefs.aiMode}
            onChange={(aiMode) => setPrefs({ aiMode })}
            options={[
              { value: 'quick', label: 'Quick' },
              { value: 'detailed', label: 'Detailed' },
            ]}
          />
        </div>
        <div className="setting-row">
          <div>
            <strong>Include the complete source code</strong>
            <p className="muted small">
              {meta.site.repoIsPrivate
                ? 'Your repository is marked private, so AI agents may not be able to open source links. Keeping this on makes every copy self-contained.'
                : 'Your repository is public, so AI agents can fetch each component from its link. Switch this on only if your agent has no internet access.'}
            </p>
          </div>
          <Segmented<'auto' | 'on' | 'off'>
            label="Include source code"
            value={prefs.aiIncludeSource === null ? 'auto' : prefs.aiIncludeSource ? 'on' : 'off'}
            onChange={(v) => setPrefs({ aiIncludeSource: v === 'auto' ? null : v === 'on' })}
            options={[
              { value: 'auto', label: `Automatic (${meta.site.repoIsPrivate ? 'on' : 'off'})` },
              { value: 'on', label: 'Always' },
              { value: 'off', label: 'Never' },
            ]}
          />
        </div>
      </section>

      <section className="panel" id="health" data-testid="health-report">
        <h2>Library health</h2>
        <p className={`health-summary ${health.ok ? 'is-good' : 'is-bad'}`}>
          <Icon name={health.ok ? 'check' : 'alert'} />
          {health.ok
            ? 'Everything checks out. Every listed component has a working file.'
            : `${problems} component${problems === 1 ? '' : 's'} could not be verified. They stay listed but show “Preview unavailable”.`}
        </p>
        <dl className="stats">
          <Stat label="Components in the index" value={health.indexed} />
          <Stat label="Valid component files" value={health.validFiles} tone="good" />
          <Stat label="Missing or broken" value={problems} tone={problems ? 'bad' : undefined} />
          <Stat label="Categories" value={health.categories} />
          <Stat label="Component types" value={health.types} />
          <Stat label="Last successful build" value={formatDate(health.builtAt)} />
        </dl>
        <details className="advanced">
          <summary>Details (advanced)</summary>
          <dl className="facts">
            <div className="fact"><dt>Listed in the library</dt><dd>{health.listed}</dd></div>
            <div className="fact"><dt>Files found but not in the index (still shown)</dt><dd>{health.unindexed.length}</dd></div>
            <div className="fact"><dt>Duplicate index entries ignored</dt><dd>{health.duplicates.length}</dd></div>
            <div className="fact"><dt>Entries without a usable file path</dt><dd>{health.invalidEntries.length}</dd></div>
            <div className="fact"><dt>Components without author guidance</dt><dd>{health.withoutGuidance}</dd></div>
            <div className="fact"><dt>Built from version</dt><dd><code>{meta.commit || 'unknown'}</code></dd></div>
          </dl>
          {[...health.missing, ...health.broken].length > 0 && (
            <>
              <h3>Problem files</h3>
              <ul className="plain-list">{[...health.missing, ...health.broken].map((f) => <li key={f}><code>{f}</code></li>)}</ul>
            </>
          )}
          {health.warnings.length > 0 && (
            <>
              <h3>Warnings</h3>
              <ul className="plain-list">{health.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </>
          )}
        </details>
      </section>

      <section className="panel" id="updates">
        <h2>Updates from the original collection</h2>
        <p>
          Once a week this library checks the original collection (
          <a href={`https://github.com/${meta.site.upstreamOwner}/${meta.site.upstreamName}`} target="_blank" rel="noopener noreferrer">
            {meta.site.upstreamOwner}/{meta.site.upstreamName}
          </a>
          ) for new, changed and removed components. When there is something new it prepares a proposal on GitHub for you to approve — nothing
          changes here until you press <strong>Merge</strong> there.
        </p>
        {sync ? (
          <>
            <dl className="stats">
              <Stat label="Last update applied" value={formatDate(sync.checkedAt)} />
              <Stat label="Added" value={sync.added.length} tone={sync.added.length ? 'good' : undefined} />
              <Stat label="Changed" value={sync.modified.length} />
              <Stat label="Removed" value={sync.deleted.length} tone={sync.deleted.length ? 'bad' : undefined} />
            </dl>
            <ChangeList title="Added" items={sync.added} />
            <ChangeList title="Changed" items={sync.modified} />
            <ChangeList title="Removed" items={sync.deleted} />
          </>
        ) : (
          <p className="muted">No update has been applied since this library was set up.</p>
        )}
        <div className="source-actions">
          <a className="btn" href={`${repoUrl}/pulls`} target="_blank" rel="noopener noreferrer">
            <Icon name="external" /> See update proposals on GitHub
          </a>
          <a className="btn" href={`${repoUrl}/actions/workflows/upstream-sync.yml`} target="_blank" rel="noopener noreferrer">
            <Icon name="restart" /> Check for updates now
          </a>
        </div>
      </section>

      <section className="panel" id="about">
        <h2>About</h2>
        <p className="muted small">
          {meta.site.siteName} dashboard version {meta.version || '—'}. Components © their authors, MIT licence, from{' '}
          <a href={`https://github.com/${meta.site.upstreamOwner}/${meta.site.upstreamName}`} target="_blank" rel="noopener noreferrer">
            Forever AI Components
          </a>
          . Private access is enforced by Cloudflare Access before any page or component is served.
        </p>
      </section>

      {pending && (
        <Dialog
          title="Import backup"
          size="small"
          onClose={() => setPending(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button type="button" className="btn" onClick={() => runImport('replace')} data-testid="import-replace">
                Replace everything
              </button>
              <button type="button" className="btn btn-primary" onClick={() => runImport('merge')} data-testid="import-merge" data-autofocus>
                Add to what I have
              </button>
            </>
          }
        >
          <p>
            <strong>{pending.name}</strong> contains {pending.summary.favourites} favourite{pending.summary.favourites === 1 ? '' : 's'} and{' '}
            {pending.summary.collections} collection{pending.summary.collections === 1 ? '' : 's'} ({pending.summary.items} component
            {pending.summary.items === 1 ? '' : 's'} in total).
          </p>
          <ul className="plain-list">
            <li>
              <strong>Add to what I have</strong> keeps everything already here and adds anything new from the backup.
            </li>
            <li>
              <strong>Replace everything</strong> swaps your current favourites and collections for the backup’s.
            </li>
          </ul>
          <p className="muted small">Either way, you can undo the import afterwards.</p>
        </Dialog>
      )}
    </div>
  );
}
