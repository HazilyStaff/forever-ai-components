import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useActions } from '../components/Actions';
import { VIRTUAL_SIZE } from '../components/ComponentCard';
import { CopyCollectionDialog } from '../components/CopyForAi';
import { Icon } from '../components/Icon';
import { LivePreview } from '../components/LivePreview';
import { ConfirmDialog, Dialog, EmptyState, useToast } from '../components/ui';
import { useCatalogue } from '../lib/catalogue';
import { formatDate, roleLabelSingular } from '../lib/labels';
import { viewerPath } from '../lib/urls';
import { resolvedTheme, usePrefs } from '../store/prefs';
import { COLLECTION_NAME_LIMIT, NOTE_LIMIT, userStore, useUserData, type Collection, type CollectionItem } from '../store/userData';

function NameDialog({
  title,
  initial,
  confirmLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  initial: string;
  confirmLabel: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
    onClose();
  };
  return (
    <Dialog
      title={title}
      size="small"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={submit} data-testid="name-dialog-confirm">
            {confirmLabel}
          </button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={name}
            maxLength={COLLECTION_NAME_LIMIT}
            placeholder="e.g. My Dashboard"
            data-autofocus
            data-testid="name-dialog-input"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      </form>
    </Dialog>
  );
}

export function Collections() {
  const data = useUserData();
  const { byId, meta } = useCatalogue();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    document.title = `Collections · ${meta.site.siteName}`;
  }, [meta.site.siteName]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Collections</h1>
          <p className="muted">Group components for a project, add notes, then hand the whole set to your AI agent in one go.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)} data-testid="new-collection">
          <Icon name="plus" /> New collection
        </button>
      </header>

      {data.collections.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No collections yet"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Icon name="plus" /> Create your first collection
            </button>
          }
        >
          <p>
            A collection is a named set of components — for example “Login page ideas” or “My Dashboard”. You can also add a component to a
            collection from any card’s <strong>⋯</strong> menu.
          </p>
        </EmptyState>
      ) : (
        <ul className="collection-grid">
          {data.collections.map((collection) => {
            const found = collection.items.map((i) => byId.get(i.id)).filter((c) => !!c);
            return (
              <li key={collection.id}>
                <Link className="collection-card" to={`/collections/${collection.id}`} data-testid="collection-card">
                  <div className="collection-swatches" aria-hidden="true">
                    {[0, 1, 2, 3].map((slot) => {
                      const c = found[slot];
                      return (
                        <span key={slot} style={c ? { background: c.bg || undefined } : undefined} data-empty={c ? undefined : ''}>
                          {c && <i style={{ background: c.accent || undefined }} />}
                        </span>
                      );
                    })}
                  </div>
                  <h2>{collection.name}</h2>
                  <p className="muted small">
                    {collection.items.length} component{collection.items.length === 1 ? '' : 's'} · updated {formatDate(collection.updatedAt)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="storage-note">
        <Icon name="info" size={14} /> Collections are saved in this browser on this device only. They do not sync between your computer,
        iPad and iPhone. <Link to="/settings#backup">Back up or move them</Link>.
      </p>

      {creating && (
        <NameDialog
          title="New collection"
          initial=""
          confirmLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={(name) => navigate(`/collections/${userStore.createCollection(name).id}`)}
        />
      )}
    </div>
  );
}

function NoteEditor({ collectionId, item, title }: { collectionId: string; item: CollectionItem; title: string }) {
  const [value, setValue] = useState(item.note);
  useEffect(() => setValue(item.note), [item.note]);
  // Saved as you type (shortly after you pause) and again when you leave the box.
  useEffect(() => {
    if (value === item.note) return;
    const timer = window.setTimeout(() => userStore.setNote(collectionId, item.id, value), 500);
    return () => window.clearTimeout(timer);
  }, [value, item.note, item.id, collectionId]);
  return (
    <label className="note">
      <span>Your note for the AI</span>
      <textarea
        className="input"
        rows={2}
        value={value}
        maxLength={NOTE_LIMIT}
        placeholder="e.g. Use this for the dark-mode switch in Settings"
        aria-label={`Note for ${title}`}
        data-testid="note-input"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => value !== item.note && userStore.setNote(collectionId, item.id, value)}
      />
    </label>
  );
}

function CollectionView({ collection }: { collection: Collection }) {
  const { byId, removedById, meta } = useCatalogue();
  const actions = useActions();
  const prefs = usePrefs();
  const data = useUserData();
  const toast = useToast();
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);
  const theme = resolvedTheme(prefs.theme);
  const usable = collection.items.filter((i) => byId.get(i.id)?.status === 'ok').length;

  useEffect(() => {
    document.title = `${collection.name} · ${meta.site.siteName}`;
  }, [collection.name, meta.site.siteName]);

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/collections">Collections</Link>
      </nav>
      <header className="page-head">
        <div>
          <h1 data-testid="collection-title">{collection.name}</h1>
          <p className="muted">
            {collection.items.length} component{collection.items.length === 1 ? '' : 's'} · updated {formatDate(collection.updatedAt)}
          </p>
        </div>
        <div className="viewer-actions">
          <button type="button" className="btn" onClick={() => setRenaming(true)} data-testid="rename-collection">
            <Icon name="edit" /> Rename
          </button>
          <button type="button" className="btn" onClick={() => setDeleting(true)} data-testid="delete-collection">
            <Icon name="trash" /> Delete
          </button>
          <button
            type="button"
            className="btn btn-primary btn-ai"
            disabled={usable === 0}
            onClick={() => setCopying(true)}
            data-testid="copy-collection"
          >
            <Icon name="copy" /> COPY COLLECTION FOR AI
          </button>
        </div>
      </header>

      {collection.items.length === 0 ? (
        <EmptyState
          icon="folder"
          title="This collection is empty"
          action={
            <Link className="btn btn-primary" to="/">
              Browse the library
            </Link>
          }
        >
          <p>
            Open any component and choose <strong>Add to collection</strong>, or use the <strong>⋯</strong> menu on a card.
          </p>
        </EmptyState>
      ) : (
        <ol className="collection-items" data-testid="collection-items">
          {collection.items.map((item, index) => {
            const component = byId.get(item.id);
            const title = component?.title ?? removedById.get(item.id)?.title ?? item.id;
            return (
              <li key={item.id} className="collection-item" data-testid="collection-item" data-id={item.id}>
                <div className="collection-item-preview">
                  {component ? (
                    <LivePreview component={component} theme={theme} virtual={VIRTUAL_SIZE.comfortable} />
                  ) : (
                    <div className="preview" data-state="unavailable">
                      <div className="preview-message">
                        <Icon name="alert" />
                        <strong>No longer in the library</strong>
                        <span>This component was removed from the original collection.</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="collection-item-body">
                  <div className="collection-item-head">
                    <span className="order-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div>
                      <h2>{component ? <Link to={viewerPath(component.id)}>{title}</Link> : title}</h2>
                      {component && (
                        <p className="card-meta">
                          {roleLabelSingular(component.role)} · {component.theme}
                        </p>
                      )}
                    </div>
                  </div>
                  {component && <NoteEditor collectionId={collection.id} item={item} title={title} />}
                  <div className="collection-item-actions">
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={index === 0}
                      aria-label={`Move ${title} earlier`}
                      data-testid="move-up"
                      onClick={() => userStore.moveItem(collection.id, item.id, index - 1)}
                    >
                      <Icon name="up" size={14} /> Earlier
                    </button>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={index === collection.items.length - 1}
                      aria-label={`Move ${title} later`}
                      data-testid="move-down"
                      onClick={() => userStore.moveItem(collection.id, item.id, index + 1)}
                    >
                      <Icon name="down" size={14} /> Later
                    </button>
                    {component && (
                      <>
                        <button type="button" className="btn btn-small" onClick={() => actions.quickPreview(component.id)}>
                          <Icon name="expand" size={14} /> Preview
                        </button>
                        <button
                          type="button"
                          className="btn btn-small"
                          aria-pressed={component.id in data.favourites}
                          onClick={() => actions.toggleFavourite(component)}
                        >
                          <Icon name="heart" size={14} filled={component.id in data.favourites} /> Favourite
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn-small"
                      aria-label={`Remove ${title} from this collection`}
                      data-testid="remove-item"
                      onClick={() => {
                        userStore.removeFromCollection(collection.id, item.id);
                        toast(`Removed “${title}”.`, {
                          action: {
                            label: 'Undo',
                            run: () => {
                              userStore.addToCollection(collection.id, item.id);
                              userStore.setNote(collection.id, item.id, item.note);
                              userStore.moveItem(collection.id, item.id, index);
                            },
                          },
                        });
                      }}
                    >
                      <Icon name="close" size={14} /> Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="storage-note">
        <Icon name="info" size={14} /> Saved in this browser on this device only — not synced to your other devices.{' '}
        <Link to="/settings#backup">Back up or move your collections</Link>.
      </p>

      {renaming && (
        <NameDialog
          title="Rename collection"
          initial={collection.name}
          confirmLabel="Save"
          onClose={() => setRenaming(false)}
          onSubmit={(name) => userStore.renameCollection(collection.id, name)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this collection?"
          confirmLabel="Delete collection"
          danger
          onClose={() => setDeleting(false)}
          onConfirm={() => {
            const removed = userStore.deleteCollection(collection.id);
            navigate('/collections');
            if (removed) {
              toast(`Deleted “${removed.name}”.`, { action: { label: 'Undo', run: () => userStore.restoreCollection(removed) } });
            }
          }}
        >
          <p>
            “{collection.name}” and its notes will be removed from this browser. The components themselves stay in the library and in your
            favourites.
          </p>
        </ConfirmDialog>
      )}
      {copying && <CopyCollectionDialog collection={collection} onClose={() => setCopying(false)} />}
    </div>
  );
}

export function CollectionDetail() {
  const { id } = useParams();
  const data = useUserData();
  const collection = data.collections.find((c) => c.id === id);
  if (!collection) {
    return (
      <div className="page">
        <EmptyState
          icon="folder"
          title="Collection not found"
          action={
            <Link className="btn btn-primary" to="/collections">
              See all collections
            </Link>
          }
        >
          <p>It may have been deleted, or it was created in a different browser or device. Collections are stored per browser.</p>
        </EmptyState>
      </div>
    );
  }
  return <CollectionView collection={collection} />;
}
