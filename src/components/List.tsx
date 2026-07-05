// FlashList adapter — the ONLY list primitive screens use. One adapter file
// de-risks a future swap (FlatList / another virtualizer).
import type { ReactElement } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { RefreshControl } from 'react-native';
import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';

export type { ListRenderItemInfo };

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
    <FlashList
      data={data}
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
