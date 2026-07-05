// Shared NativeWind class tokens — single source of truth (mirrors the web
// ui-tokens.ts pattern). Semantics come from class conventions over the default
// Tailwind palette: blue=primary · emerald=success · amber=warning/receivable ·
// rose=destructive-ONLY · gray=neutral. Mutating these updates every consumer.

// ── Surfaces ─────────────────────────────────────────────────────────────────
export const surface = {
  base: 'bg-gray-50 dark:bg-gray-900',        // screen background (never pure black)
  raised: 'bg-white dark:bg-gray-800',        // card / sheet / row
  sunken: 'bg-gray-100 dark:bg-gray-900',     // input wells, section headers
};

// ── Text ─────────────────────────────────────────────────────────────────────
export const text = {
  primary: 'text-gray-900 dark:text-gray-50',
  secondary: 'text-gray-600 dark:text-gray-300',
  muted: 'text-gray-600 dark:text-gray-400',  // floor gray-600 at small sizes
  onPrimary: 'text-white',
};

// ── Borders / elevation ──────────────────────────────────────────────────────
export const borderTok = 'border border-gray-200 dark:border-gray-700';
// Dark elevation comes from the gray-900→gray-800 surface step, not shadow.
export const elevation1 = `${borderTok} shadow-sm dark:shadow-none`;
export const elevation2 = 'shadow-lg dark:shadow-none dark:border dark:border-gray-700';

// ── Card / input ─────────────────────────────────────────────────────────────
export const cardCls = `rounded-xl p-4 ${surface.raised} ${elevation1}`;
export const inputCls =
  'rounded-md px-3 py-3 text-base bg-white dark:bg-gray-800 ' +
  'border border-gray-200 dark:border-gray-700 ' +
  'text-gray-900 dark:text-gray-100';
export const inputFocusCls = 'border-blue-500 dark:border-blue-400';
export const inputErrorCls = 'border-rose-500 dark:border-rose-400';

// ── Soft badges (never solid-bright bg + white text) ─────────────────────────
export const badge = {
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};
