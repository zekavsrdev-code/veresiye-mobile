// Money display — single source of truth. Amounts travel as decimal STRINGS
// end-to-end (backend Decimal → JSON string); Number() cast is display-only,
// never used for arithmetic on money.
export type TxType = 'borc' | 'odeme';

const fmt = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatTRY(decimalStr: string): string {
  const n = Number(decimalStr);
  if (Number.isNaN(n)) return '0,00 ₺';
  return `${fmt.format(n)} ₺`;
}

// Signed relative to the running receivable: borc grows it (+), odeme shrinks it (−).
export function formatSignedTRY(decimalStr: string, type: TxType): string {
  return (type === 'borc' ? '+' : '−') + formatTRY(decimalStr);
}

// Fold transactions (oldest→newest) into per-row running balances, newest-first
// aligned with the API ordering. Integer-cent arithmetic — no float drift.
export function toCents(decimalStr: string): number {
  const [int, frac = ''] = decimalStr.replace('-', '').split('.');
  const cents = parseInt(int || '0', 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  return decimalStr.trim().startsWith('-') ? -cents : cents;
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
