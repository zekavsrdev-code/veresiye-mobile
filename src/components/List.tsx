// List adapter — the ONLY list primitive screens use. One adapter file
// de-risks virtualizer swaps, and that paid off: FlashList v2 has an OPEN
// infinite-render-loop bug on some Android devices (internal ViewHolder
// components re-render forever when the data reference changes — JS thread
// saturates, every tap dies, spinners never clear; Shopify/flash-list#1966).
// Swapped to core FlatList; the prop surface is unchanged for all screens.
// Revisit FlashList when #1966 ships a fix.
import type { ReactElement } from 'react';
import type { ListRenderItemInfo as RNListRenderItemInfo, StyleProp, ViewStyle } from 'react-native';
import { FlatList, RefreshControl } from 'react-native';

// Keep the FlashList-compatible name so call sites stay untouched.
export type ListRenderItemInfo<T> = RNListRenderItemInfo<T>;

interface ListProps<T> {
  data: readonly T[];
  renderItem: (info: ListRenderItemInfo<T>) => ReactElement | null;
  keyExtractor: (item: T, index: number) => string;
  ListHeaderComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
  ListFooterComponent?: ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  extraData?: unknown;
}

export function List<T>({
  data,
  renderItem,
  keyExtractor,
  ListHeaderComponent,
  ListEmptyComponent,
  ListFooterComponent,
  refreshing,
  onRefresh,
  onEndReached,
  onEndReachedThreshold,
  contentContainerStyle,
  extraData,
}: ListProps<T>) {
  return (
    <FlatList
      data={data as T[]}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      contentContainerStyle={contentContainerStyle}
      extraData={extraData}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
        ) : undefined
      }
    />
  );
}
