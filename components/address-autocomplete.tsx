'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export type AddressSuggestion = {
  label: string;
  adresse: string;
  code_postal: string;
  ville: string;
  departement: string;
};

type AddressApiFeature = {
  properties?: {
    label?: string;
    context?: string;
    housenumber?: string;
    street?: string;
    name?: string;
    postcode?: string;
    city?: string;
  };
};

type AddressApiResponse = {
  features?: AddressApiFeature[];
};

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  inputClassName?: string;
  minChars?: number;
  debounceMs?: number;
  disabled?: boolean;
  inputId?: string;
};

const DEFAULT_MIN_CHARS = 3;
const DEFAULT_DEBOUNCE_MS = 300;

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  inputClassName,
  minChars = DEFAULT_MIN_CHARS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  disabled = false,
  inputId,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const inputAriaLabel = placeholder || 'Adresse';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const query = value.trim();

    if (query.length < minChars) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      setErrorMessage('');
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setErrorMessage('');

    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=6&autocomplete=1`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Adresse API error');
        }

        const data = (await response.json()) as AddressApiResponse;
        if (requestIdRef.current !== requestId) return;

        const results = (data.features ?? []).map((feature) => {
          const props = feature.properties || {};
          const contextParts = (props.context || '')
            .split(',')
            .map((part: string) => part.trim())
            .filter(Boolean);

          const department =
            contextParts.length >= 2
              ? `${contextParts[0]} ${contextParts[1]}`
              : contextParts[0] || '';

          const streetParts = [props.housenumber, props.street || props.name].filter(Boolean);
          const street = streetParts.join(' ').trim();

          return {
            label: props.label || street,
            adresse: street || props.label || '',
            code_postal: props.postcode || '',
            ville: props.city || '',
            departement: department,
          } as AddressSuggestion;
        });

        setSuggestions(results);
        setIsOpen(true);
        setActiveIndex(-1);
      } catch (error) {
        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'AbortError') return;
        if (requestIdRef.current !== requestId) return;
        setSuggestions([]);
        setIsOpen(true);
        setErrorMessage('Aucune suggestion disponible. Saisie manuelle possible.');
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [value, minChars, debounceMs]);

  const handleSelect = (suggestion: AddressSuggestion) => {
    onSelect(suggestion);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        placeholder={placeholder}
        aria-label={inputAriaLabel}
        title={inputAriaLabel}
        disabled={disabled}
        autoComplete="off"
        className={inputClassName}
      />

      {isOpen && value.trim().length >= minChars && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          {isLoading && (
            <div className="px-3 py-2 text-sm text-gray-500">Recherche en cours...</div>
          )}

          {!isLoading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              {errorMessage || 'Aucune adresse trouvee.'}
            </div>
          )}

          {!isLoading && suggestions.length > 0 && (
            <ul role="listbox" className="max-h-64 overflow-auto">
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.label}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    index === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(suggestion)}
                >
                  <div className="font-medium text-gray-900">{suggestion.label}</div>
                  {suggestion.departement && (
                    <div className="text-xs text-gray-500">{suggestion.departement}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
