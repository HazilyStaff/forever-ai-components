// App-wide actions that open a dialog: quick preview, add to collection, copy for AI.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogue } from '../lib/catalogue';
import { roleLabelSingular } from '../lib/labels';
import type { CatalogueComponent } from '../lib/types';
import { viewerPath } from '../lib/urls';
import { resolvedTheme, toggleCompare, usePrefs } from '../store/prefs';
import { COLLECTION_NAME_LIMIT, userStore, useUserData } from '../store/userData';
import { CopyForAiDialog, copyComponentForAi } from './CopyForAi';
import { Icon } from './Icon';
import { LivePreview } from './LivePreview';
import { Dialog, useToast } from './ui';

interface Actions {
  quickPreview: (id: string) => void;
  addToCollection: (id: string) => void;
  copyOptions: (id: string) => void;
  /** Copies straight away with the remembered options. */
  copyForAi: (component: CatalogueComponent) => void;
  toggleFavourite: (component: CatalogueComponent) => void;
  toggleCompare: (component: CatalogueComponent) => void;
}

const ActionsContext = createContext<Actions | null>(null);

export function useActions(): Actions {
  const value = useContext(ActionsContext);
  if (!value) throw new Error('Actions are not available here.');
  return value;
}

type Open = { kind: 'quick' | 'collect' | 'copy'; id: string } | null;

export function ActionsProvider({ children }: { children: ReactNode }) {
  const { byId, meta } = useCatalogue();
  const toast = useToast();
  const [open, setOpen] = useState<Open>(null);
  const [stacked, setStacked] = useState<Open>(null);

  const show = useCallback((next: NonNullable<Open>) => {
    // From inside the quick preview, other dialogs open on top and return to it when closed.
    setOpen((current) => {
      if (current?.kind === 'quick' && next.kind !== 'quick') {
        setStacked(next);
        return current;
      }
      return next;
    });
  }, []);

  const actions = useMemo<Actions>(
    () => ({
      quickPreview: (id) => show({ kind: 'quick', id }),
      addToCollection: (id) => show({ kind: 'collect', id }),
      copyOptions: (id) => show({ kind: 'copy', id }),
      copyForAi: (component) => {
        copyComponentForAi(component, meta.site)
          .then(({ ok, label }) => {
            if (ok) {
              toast(`Copied for AI: ${label}.`, {
                tone: 'success',
                action: { label: 'Options', run: () => show({ kind: 'copy', id: component.id }) },
              });
            } else {
              show({ kind: 'copy', id: component.id });
            }
          })
          .catch(() => show({ kind: 'copy', id: component.id }));
      },
      toggleFavourite: (component) => {
        const added = userStore.toggleFavourite(component.id);
        toast(added ? `Added “${component.title}” to favourites.` : `Removed “${component.title}” from favourites.`, {
          action: { label: 'Undo', run: () => userStore.toggleFavourite(component.id) },
        });
      },
      toggleCompare: (component) => {
        const result = toggleCompare(component.id);
        if (result === 'full') toast('You can compare up to four components. Remove one first.', { tone: 'error' });
      },
    }),
    [show, toast, meta.site],
  );

  const render = (target: Open, close: () => void) => {
    if (!target) return null;
    const component = byId.get(target.id);
    if (!component) return null;
    if (target.kind === 'quick') return <QuickPreviewDialog component={component} onClose={close} />;
    if (target.kind === 'collect') return <AddToCollectionDialog component={component} onClose={close} />;
    return <CopyForAiDialog component={component} onClose={close} />;
  };

  return (
    <ActionsContext.Provider value={actions}>
      {children}
      {render(open, () => {
        setOpen(null);
        setStacked(null);
      })}
      {render(stacked, () => setStacked(null))}
    </ActionsContext.Provider>
  );
}

function QuickPreviewDialog({ component, onClose }: { component: CatalogueComponent; onClose: () => void }) {
  const actions = useActions();
  const data = useUserData();
  const prefs = usePrefs();
  const [restart, setRestart] = useState(0);
  const favourite = component.id in data.favourites;
  const comparing = prefs.compare.includes(component.id);

  useEffect(() => {
    userStore.markViewed(component.id);
  }, [component.id]);

  return (
    <Dialog title={component.title} size="wide" onClose={onClose}>
      <div className="quick">
        <div className="quick-stage">
          <LivePreview component={component} theme={resolvedTheme(prefs.theme)} mode="always" restartKey={restart} />
        </div>
        <div className="quick-side">
          <p className="eyebrow">
            {roleLabelSingular(component.role)} · {component.theme}
          </p>
          {component.description && <p className="quick-description">{component.description}</p>}
          {component.kind === 'interactive' && (
            <p className="muted small">
              <Icon name="sparkle" size={14} /> Interactive — try it in the preview.
            </p>
          )}
          <div className="quick-actions">
            <button type="button" className="btn btn-primary btn-ai" onClick={() => actions.copyForAi(component)}>
              <Icon name="copy" /> Copy for AI
            </button>
            <button type="button" className="btn" aria-pressed={favourite} onClick={() => actions.toggleFavourite(component)}>
              <Icon name="heart" filled={favourite} /> {favourite ? 'Favourited' : 'Favourite'}
            </button>
            <button type="button" className="btn" onClick={() => actions.addToCollection(component.id)}>
              <Icon name="folder" /> Add to collection
            </button>
            <button type="button" className="btn" aria-pressed={comparing} onClick={() => actions.toggleCompare(component)}>
              <Icon name="compare" /> {comparing ? 'In comparison' : 'Compare'}
            </button>
            <button type="button" className="btn" onClick={() => setRestart((n) => n + 1)}>
              <Icon name="restart" /> Restart
            </button>
          </div>
          <Link className="quick-more" to={viewerPath(component.id)} onClick={onClose}>
            Open full details <Icon name="right" size={14} />
          </Link>
        </div>
      </div>
    </Dialog>
  );
}

function AddToCollectionDialog({ component, onClose }: { component: CatalogueComponent; onClose: () => void }) {
  const data = useUserData();
  const toast = useToast();
  const [name, setName] = useState('');

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    userStore.createCollection(trimmed, component.id);
    toast(`Created “${trimmed}” and added “${component.title}”.`, { tone: 'success' });
    setName('');
  };

  return (
    <Dialog
      title="Add to collection"
      size="small"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <p className="dialog-intro">
        Choose where to keep <strong>{component.title}</strong>. It can be in several collections at once.
      </p>
      {data.collections.length === 0 ? (
        <p className="muted">You don’t have any collections yet. Create your first one below.</p>
      ) : (
        <ul className="collect-list">
          {data.collections.map((collection) => {
            const inside = collection.items.some((i) => i.id === component.id);
            return (
              <li key={collection.id}>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={inside}
                    onChange={() =>
                      inside
                        ? userStore.removeFromCollection(collection.id, component.id)
                        : userStore.addToCollection(collection.id, component.id)
                    }
                  />
                  <span>
                    <strong>{collection.name}</strong>
                    <small>
                      {collection.items.length} component{collection.items.length === 1 ? '' : 's'}
                    </small>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <input
          className="input"
          value={name}
          maxLength={COLLECTION_NAME_LIMIT}
          placeholder="New collection name, e.g. Login page ideas"
          aria-label="New collection name"
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="btn" disabled={!name.trim()}>
          <Icon name="plus" /> Create
        </button>
      </form>
    </Dialog>
  );
}
