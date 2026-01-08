'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'theme';

const applyTheme = (next: ThemeMode) => {
  const root = document.documentElement;
  root.classList.toggle('theme-dark', next === 'dark');
  root.classList.toggle('theme-light', next === 'light');
  root.style.colorScheme = next;
};

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const preferred =
      stored === 'light' || stored === 'dark'
        ? stored
        : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    setTheme(preferred);
    applyTheme(preferred);
  }, []);

  const toggleTheme = () => {
    if (!theme) return;
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 ${className}`}
      aria-label={isDark ? 'Passer en mode jour' : 'Passer en mode nuit'}
    >
      <span>{isDark ? 'Nuit' : 'Jour'}</span>
    </button>
  );
}
