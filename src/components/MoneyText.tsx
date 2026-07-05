import { Text } from 'react-native';

import { formatSignedTRY, formatTRY, type TxType } from '@/lib/money';
import { text } from '@/lib/ui-tokens';

const sizeCls: Record<NonNullable<MoneyTextProps['size']>, string> = {
  hero: 'text-4xl font-bold',
  lg: 'text-xl font-semibold',
  md: 'text-base font-semibold',
  sm: 'text-sm font-medium',
};

// Transaction-type coloring (spec §0) — distinct from balance-direction badges.
const typeCls: Record<TxType, string> = {
  borc: 'text-amber-600 dark:text-amber-400',
  odeme: 'text-emerald-600 dark:text-emerald-400',
};

export interface MoneyTextProps {
  value: string;
  type?: TxType;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
}

export function MoneyText({ value, type, size = 'md', className }: MoneyTextProps) {
  const formatted = type ? formatSignedTRY(value, type) : formatTRY(value);
  const colorCls = type ? typeCls[type] : text.primary;
  return (
    <Text
      className={`${sizeCls[size]} ${colorCls}${className ? ` ${className}` : ''}`}
      // NativeWind has no tabular-nums utility in RN — style prop keeps digits column-aligned.
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {formatted}
    </Text>
  );
}
