import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cardCls } from '@/lib/ui-tokens';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return <View className={`${cardCls}${className ? ` ${className}` : ''}`}>{children}</View>;
}
