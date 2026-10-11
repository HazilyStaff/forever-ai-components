import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LibrarySearch, Suggestion } from '../lib/search';
import type { FacetKey } from '../lib/types';
import { viewerPath } from '../lib/urls';
import { Icon } from './Icon';

interface Props {
  value: string;
  onChange: (value: string) => void;
  search: LibrarySearch;
  onPickFilter: (key: FacetKey, value: string) => void;
  placeholder: string;
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function SearchBox({ value, onChange, search, onPickFilter, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useMemo<Suggestion[]>(() => (focused ? search.suggest(value) : []), [focused, search, value]);
  const open = focused && suggestions.length > 0;

  useEffect(() => setActive(-1), [value]);

  // "/" or Ctrl/Cmd+K jumps to the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = (event.key === '/' && !isTypingTarget(event.target)) || (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey));
      if (!shortcut || document.documentElement.classList.contains('dialog-open')) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const pick = (s: Suggestion) => {
    if (s.kind === 'component' && s.id) {
      navigate(viewerPath(s.id));
    } else if (s.facet && s.value) {
      onPickFilter(s.facet, s.value);
      onChange('');
    }
    inputRef.current?.blur();
  };

  return (
    <div className="search" role="search">
      <Icon name="search" />
      <input
        ref={inputRef}
        className="search-input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label="Search components"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        data-testid="search-input"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (value) onChange('');
            else inputRef.current?.blur();
          } else if (open && event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (open && event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          } else if (event.key === 'Enter') {
            if (open && active >= 0) {
              event.preventDefault();
              pick(suggestions[active]);
            } else {
              inputRef.current?.blur();
            }
          }
        }}
      />
      {value ? (
        <button type="button" className="icon-btn search-clear" aria-label="Clear search" title="Clear search" onClick={() => onChange('')}>
          <Icon name="close" size={14} />
        </button>
      ) : (
        <kbd className="search-key" title="Press / to search">
          /
        </kbd>
      )}
      {open && (
        <ul className="suggestions" id={listId} role="listbox" aria-label="Suggestions">
          {suggestions.map((s, index) => (
            <li
              key={`${s.kind}:${s.id ?? `${s.facet}:${s.value}`}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className="suggestion"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <Icon name={s.kind === 'filter' ? 'filter' : 'right'} size={14} />
              <span className="suggestion-label">{s.label}</span>
              <span className="suggestion-detail">{s.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
