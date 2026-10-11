import { memo } from 'react';
import { Link } from 'react-router-dom';
import { roleLabelSingular } from '../lib/labels';
import type { CatalogueComponent, Density } from '../lib/types';
import { viewerPath } from '../lib/urls';
import { useActions } from './Actions';
import { Icon } from './Icon';
import { LivePreview } from './LivePreview';
import { MenuButton } from './ui';

export const VIRTUAL_SIZE: Record<Density, { width: number; height: number }> = {
  compact: { width: 320, height: 240 },
  comfortable: { width: 400, height: 300 },
  large: { width: 560, height: 400 },
};

interface Props {
  component: CatalogueComponent;
  density: Density;
  theme: 'dark' | 'light';
  favourite: boolean;
  comparing: boolean;
}

export const ComponentCard = memo(function ComponentCard({ component, density, theme, favourite, comparing }: Props) {
  const actions = useActions();
  const tags = component.tags.slice(0, density === 'large' ? 5 : 3);
  // Components that only play by themselves have nothing to click, so the whole preview opens
  // the quick preview. Interactive ones stay directly usable with a mouse; on touch screens a
  // tap opens the quick preview (where they are fully interactive) so scrolling stays smooth.
  const passive = component.kind === 'passive';

  return (
    <article className="card" data-density={density} data-testid="component-card" data-id={component.id}>
      <div className="card-preview">
        <LivePreview component={component} theme={theme} virtual={VIRTUAL_SIZE[density]} interactive={!passive} />
        <button
          type="button"
          className={`card-open ${passive ? 'card-open-always' : 'card-open-touch'}`}
          aria-label={`Quick preview of ${component.title}`}
          tabIndex={-1}
          onClick={() => actions.quickPreview(component.id)}
        />
        <div className="card-actions">
          <button
            type="button"
            className="icon-btn icon-btn-solid"
            aria-pressed={favourite}
            aria-label={favourite ? `Remove ${component.title} from favourites` : `Add ${component.title} to favourites`}
            title={favourite ? 'Remove from favourites' : 'Add to favourites'}
            data-testid="favourite-button"
            onClick={() => actions.toggleFavourite(component)}
          >
            <Icon name="heart" filled={favourite} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-solid"
            aria-label={`Quick preview of ${component.title}`}
            title="Quick preview"
            data-testid="quick-preview-button"
            onClick={() => actions.quickPreview(component.id)}
          >
            <Icon name="expand" />
          </button>
          <MenuButton
            label="More actions"
            className="icon-btn icon-btn-solid"
            items={[
              { label: 'Add to collection…', icon: 'folder', onSelect: () => actions.addToCollection(component.id) },
              {
                label: comparing ? 'Remove from comparison' : 'Add to comparison',
                icon: 'compare',
                checked: comparing,
                onSelect: () => actions.toggleCompare(component),
              },
              { label: 'Copy for AI', icon: 'copy', onSelect: () => actions.copyForAi(component) },
            ]}
          />
        </div>
        {component.kind === 'interactive' && (
          <span className="card-badge" title="Interactive: responds to your pointer, clicks or keys">
            Interactive
          </span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">
          <Link to={viewerPath(component.id)} title={component.title}>
            {component.title}
          </Link>
          {favourite && (
            <span className="card-fav-mark" title="In your favourites">
              <Icon name="heart" size={12} filled />
            </span>
          )}
        </h3>
        <p className="card-meta">
          {roleLabelSingular(component.role)} · {component.theme}
        </p>
        {density === 'large' && component.description && <p className="card-description">{component.description}</p>}
        {tags.length > 0 && (
          <ul className="tags" aria-label="Tags">
            {tags.map((tag) => (
              <li key={tag} className="tag">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
});
