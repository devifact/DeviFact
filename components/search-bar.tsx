'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';

type SearchBarProps = {
  value?: string;
  onChange?: (value: string) => void;
  onDebouncedChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchBar({
  value,
  onChange,
  onDebouncedChange,
  placeholder = 'Rechercher...',
  className = '',
}: SearchBarProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(value ?? '');
  const inputValue = isControlled ? value ?? '' : internalValue;

  useEffect(() => {
    if (isControlled) {
      setInternalValue(value ?? '');
    }
  }, [isControlled, value]);

  useEffect(() => {
    if (!onDebouncedChange) return;
    const handle = setTimeout(() => onDebouncedChange(inputValue), 250);
    return () => clearTimeout(handle);
  }, [inputValue, onDebouncedChange]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  };

  return (
    <div className={`w-full sm:max-w-sm ${className}`}>
      <input
        type="search"
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label={placeholder}
      />
    </div>
  );
}
