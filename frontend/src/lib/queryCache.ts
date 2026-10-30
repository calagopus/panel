import { QueryClient } from '@tanstack/react-query';
import { startTransition } from 'react';

const isPage = <T>(data: unknown): data is Pagination<T> =>
  !!data && typeof data === 'object' && 'data' in data && Array.isArray(data.data);

export function patchPaginatedItems<T>(queryClient: QueryClient, queryKey: readonly unknown[], patch: (item: T) => T) {
  startTransition(() => {
    queryClient.setQueriesData({ queryKey }, (data: unknown) => {
      if (!isPage<T>(data)) return data;

      let changed = false;
      const items = data.data.map((item) => {
        const next = patch(item);
        if (next !== item) changed = true;
        return next;
      });

      return changed ? { ...data, data: items } : data;
    });
  });
}

export function removePaginatedItems<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  match: (item: T) => boolean,
) {
  startTransition(() => {
    queryClient.setQueriesData({ queryKey }, (data: unknown) => {
      if (!isPage<T>(data)) return data;

      const items = data.data.filter((item) => !match(item));
      const removed = data.data.length - items.length;

      return removed > 0 ? { ...data, data: items, total: data.total - removed } : data;
    });
  });
}
