import { useState } from 'react';
import { FACETS, valueHint, valueLabel, type FacetDef } from '../lib/labels';
import type { FacetCount } from '../lib/search';
import type { FacetKey, FilterState } from '../lib/types';

const COLLAPSED_COUNT = 8;

interface Props {
  filters: FilterState;
  counts: Record<FacetKey, FacetCount[]>;
  themes: Record<string, string>;
  onToggle: (key: FacetKey, value: string) => void;
  onClear: () => void;
  activeCount: number;
}

function FacetSection({
  facet,
  values,
  selected,
  themes,
  onToggle,
}: {
  facet: FacetDef;
  values: FacetCount[];
  selected: string[];
  themes: Record<string, string>;
  onToggle: (value: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [find, setFind] = useState('');
  const searchable = values.length > 16;
  const needle = find.trim().toLowerCase();
  const matching = needle
    ? values.filter((v) => valueLabel(facet.key, v.value, themes).toLowerCase().includes(needle))
    : values;
  // Keep ticked values visible even when the list is collapsed.
  const visible =
    showAll || needle ? matching : matching.filter((v, index) => index < COLLAPSED_COUNT || selected.includes(v.value));
  const hidden = matching.length - visible.length;

  return (
    <details className="facet" open={facet.primary || selected.length > 0 || undefined}>
      <summary title={facet.hint}>
        <span>{facet.label}</span>
        {selected.length > 0 && <span className="facet-selected">{selected.length}</span>}
      </summary>
      {searchable && (
        <input
          className="input input-small"
          type="search"
          value={find}
          placeholder={`Find a ${facet.label.toLowerCase()}`}
          aria-label={`Find within ${facet.label}`}
          onChange={(event) => setFind(event.target.value)}
        />
      )}
      <ul className="facet-values">
        {visible.map(({ value, count }) => {
          const checked = selected.includes(value);
          return (
            <li key={value}>
              <label className="facet-value" data-empty={count === 0 && !checked ? '' : undefined} title={valueHint(facet.key, value)}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(value)} />
                <span className="facet-label">{valueLabel(facet.key, value, themes)}</span>
                <span className="facet-count">{count}</span>
              </label>
            </li>
          );
        })}
        {!visible.length && <li className="muted small">Nothing matches.</li>}
      </ul>
      {(hidden > 0 || (showAll && matching.length > COLLAPSED_COUNT && !needle)) && (
        <button type="button" className="link-btn" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show fewer' : `Show all ${matching.length}`}
        </button>
      )}
    </details>
  );
}

export function FilterPanel({ filters, counts, themes, onToggle, onClear, activeCount }: Props) {
  return (
    <div className="filters" data-testid="filter-panel">
      <div className="filters-head">
        <h2>Filters</h2>
        <button type="button" className="link-btn" onClick={onClear} disabled={activeCount === 0} data-testid="clear-filters">
          Clear all
        </button>
      </div>
      {FACETS.map((facet) => {
        const values = counts[facet.key] ?? [];
        // A filter is only offered when the metadata gives it at least two real choices.
        if (values.length < 2 && !(filters[facet.key]?.length)) return null;
        return (
          <FacetSection
            key={facet.key}
            facet={facet}
            values={values}
            selected={filters[facet.key] ?? []}
            themes={themes}
            onToggle={(value) => onToggle(facet.key, value)}
          />
        );
      })}
    </div>
  );
}
