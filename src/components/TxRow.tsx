import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MoneyText } from '@/components/MoneyText';
import { useLang } from '@/context/lang';
import type { LedgerTransaction } from '@/lib/api';
import { timeOfDay } from '@/lib/dates';
import type { TranslationKey } from '@/lib/i18n';
import { formatSignedTRY, formatTRY, type TxType } from '@/lib/money';
import { badge, text } from '@/lib/ui-tokens';

// Transaction-type mapping (spec §0) — the other half of the money-color source
// of truth alongside BalanceBadge. borc grows the receivable (+, amber, up-right);
// odeme shrinks it (−, emerald, down-left). Rows are append-only: no edit/delete
// affordance ever — onLongPress is the storno (reverse) entry point.
const typeCfg: Record<
  TxType,
  {
    bgCls: string;
    labelKey: TranslationKey;
    Icon: typeof ArrowUpRight;
    icon: { light: string; dark: string };
  }
> = {
  borc: {
    bgCls: badge.amber,
    labelKey: 'ledger_type_debt',
    Icon: ArrowUpRight,
    icon: { light: '#b45309', dark: '#fcd34d' }, // amber-700 / amber-300
  },
  odeme: {
    bgCls: badge.emerald,
    labelKey: 'ledger_type_payment',
    Icon: ArrowDownLeft,
    icon: { light: '#047857', dark: '#6ee7b7' }, // emerald-700 / emerald-300
  },
};

export interface TxRowProps {
  tx: LedgerTransaction;
  runningBalance?: string;
  onLongPress?: (tx: LedgerTransaction) => void;
}

function TxRowInner({ tx, runningBalance, onLongPress }: TxRowProps) {
  const { t, lang } = useLang();
  const { colorScheme } = useColorScheme();

  const cfg = typeCfg[tx.type];
  const iconColor = colorScheme === 'dark' ? cfg.icon.dark : cfg.icon.light;
  const typeLabel = t(cfg.labelKey);
  const title = tx.note || typeLabel;
  const time = timeOfDay(tx.created_at, lang);
  const signedAmount = formatSignedTRY(tx.amount, tx.type);
  const balanceCaption =
    runningBalance !== undefined
      ? `${t('ledger_running_balance')}: ${formatTRY(runningBalance)}`
      : undefined;

  const a11yLabel = [typeLabel, signedAmount, tx.note, time, balanceCaption]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onLongPress={onLongPress ? () => onLongPress(tx) : undefined}
      // Snappier storno affordance — the default 500ms hold reads as "broken".
      delayLongPress={350}
      className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800"
    >
      <View className={`h-10 w-10 items-center justify-center rounded-full ${cfg.bgCls}`}>
        <cfg.Icon size={18} color={iconColor} />
      </View>

      <View className="flex-1 gap-0.5">
        <Text className={`text-base ${text.primary}`} numberOfLines={1}>
          {title}
        </Text>
        <Text className={`text-sm ${text.muted}`}>{time}</Text>
      </View>

      <View className="items-end gap-0.5">
        <MoneyText value={tx.amount} type={tx.type} size="md" />
        {balanceCaption !== undefined && (
          <Text className={`text-sm ${text.muted}`} style={{ fontVariant: ['tabular-nums'] }}>
            {balanceCaption}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export const TxRow = memo(TxRowInner);
