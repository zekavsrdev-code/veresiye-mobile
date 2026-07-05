import { CircleAlert } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { text } from '@/lib/ui-tokens';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
  /** CTA button intent — ErrorState uses the neutral variant for Retry. */
  ctaIntent?: 'primary' | 'neutral';
}

export function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCta,
  ctaIntent = 'primary',
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-12">
      {icon}
      <Text className={`text-center text-lg font-semibold ${text.primary}`}>{title}</Text>
      {subtitle ? (
        <Text className={`text-center text-sm ${text.muted}`}>{subtitle}</Text>
      ) : null}
      {ctaLabel && onCta ? <Button label={ctaLabel} intent={ctaIntent} onPress={onCta} /> : null}
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  retryLabel: string;
}

export function ErrorState({ message, onRetry, retryLabel }: ErrorStateProps) {
  const { colorScheme } = useColorScheme();
  const roseIconColor = colorScheme === 'dark' ? '#fb7185' : '#e11d48'; // rose-400 / rose-600

  return (
    <EmptyState
      icon={<CircleAlert size={40} color={roseIconColor} />}
      title={message}
      ctaLabel={retryLabel}
      onCta={onRetry}
      ctaIntent="neutral"
    />
  );
}
