import { ArrowDownLeft, ArrowUpRight, Check } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Text, View } from 'react-native';

import { MoneyText } from '@/components/MoneyText';
import { useLang } from '@/context/lang';
import type { TranslationKey } from '@/lib/i18n';
import { formatTRY, fromCents, toCents } from '@/lib/money';
import { badge } from '@/lib/ui-tokens';

// THE single source of the balance-direction mapping (spec §0). Direction is
// conveyed by icon + label + amount together — color never carries it alone,
// and a receivable is NEVER rose (rose = destructive only).
//   balance > 0 → amber  "receivable" (customer owes shop)   ArrowUpRight
//   balance = 0 → emerald "settled"                          Check
//   balance < 0 → blue   "in credit" (shop owes customer)    ArrowDownLeft

type Direction = 'receivable' | 'settled' | 'credit';

// Icon hex pairs match the soft-badge text tokens (-700 light / -300 dark).
const directionCfg: Record<
  Direction,
  {
    badgeCls: string;
    labelKey: TranslationKey;
    Icon: typeof ArrowUpRight;
    icon: { light: string; dark: string };
  }
> = {
  receivable: {
    badgeCls: badge.amber,
    labelKey: 'ledger_balance_receivable',
    Icon: ArrowUpRight,
    icon: { light: '#b45309', dark: '#fcd34d' }, // amber-700 / amber-300
  },
  settled: {
    badgeCls: badge.emerald,
    labelKey: 'ledger_balance_settled',
    Icon: Check,
    icon: { light: '#047857', dark: '#6ee7b7' }, // emerald-700 / emerald-300
  },
  credit: {
    badgeCls: badge.blue,
    labelKey: 'ledger_balance_credit',
    Icon: ArrowDownLeft,
    icon: { light: '#1d4ed8', dark: '#93c5fd' }, // blue-700 / blue-300
  },
};

// Amount text tracks the badge's own soft-token text color, not the tx-type palette.
const amountCls: Record<Direction, string> = {
  receivable: 'text-amber-700 dark:text-amber-300',
  settled: 'text-emerald-700 dark:text-emerald-300',
  credit: 'text-blue-700 dark:text-blue-300',
};

export interface BalanceBadgeProps {
  balance: string;
  size?: 'sm' | 'lg';
}

export function BalanceBadge({ balance, size = 'sm' }: BalanceBadgeProps) {
  const { t } = useLang();
  const { colorScheme } = useColorScheme();

  const cents = toCents(balance);
  const direction: Direction = cents > 0 ? 'receivable' : cents === 0 ? 'settled' : 'credit';
  const cfg = directionCfg[direction];
  const displayValue = fromCents(Math.abs(cents));
  const iconColor = colorScheme === 'dark' ? cfg.icon.dark : cfg.icon.light;
  const label = t(cfg.labelKey);
  const spokenAmount = direction === 'settled' ? '' : `${formatTRY(displayValue)} `;

  if (size === 'lg') {
    return (
      <View
        accessible
        accessibilityLabel={`${spokenAmount}${label}`}
        className={`items-center gap-1 rounded-full px-3 py-1 ${cfg.badgeCls}`}
      >
        <View className="flex-row items-center gap-1">
          <cfg.Icon size={16} color={iconColor} />
          <Text className={`text-xs font-semibold ${amountCls[direction]}`}>{label}</Text>
        </View>
        <MoneyText value={displayValue} size="lg" className={amountCls[direction]} />
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`${spokenAmount}${label}`}
      className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${cfg.badgeCls}`}
    >
      <cfg.Icon size={14} color={iconColor} />
      <Text className={`text-xs font-semibold ${amountCls[direction]}`}>{label}</Text>
      <MoneyText value={displayValue} size="sm" className={amountCls[direction]} />
    </View>
  );
}
