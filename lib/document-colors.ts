export const DEFAULT_DOCUMENT_COLOR = '#2563eb';

export const DOCUMENT_COLOR_OPTIONS = [
  { label: 'Bleu classique', value: '#2563eb' },
  { label: 'Bleu ciel', value: '#0ea5e9' },
  { label: 'Turquoise', value: '#14b8a6' },
  { label: 'Vert', value: '#22c55e' },
  { label: 'Lime', value: '#84cc16' },
  { label: 'Ambre', value: '#f59e0b' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Rose', value: '#fb7185' },
];

const allowedColors = new Set(DOCUMENT_COLOR_OPTIONS.map((option) => option.value));

export const resolveDocumentColor = (value?: string | null) =>
  value && allowedColors.has(value) ? value : DEFAULT_DOCUMENT_COLOR;
