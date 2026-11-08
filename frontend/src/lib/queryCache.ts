import { InfiniteData, QueryClient } from '@tanstack/react-query';
import { startTransition } from 'react';

const isPage = <T>(data: unknown): data is Pagination<T> =>
  !!data && typeof data === 'object' && 'data' in data && Array.isArray(data.data);

const isInfinitePages = <T>(data: unknown): data is InfiniteData<Pagination<T>> =>
  !!data && typeof data === 'object' && 'pages' in data && Array.isArray(data.pages) && data.pages.every(isPage);

function updatePaginatedItems<T>(queryClient: QueryClient, queryKey: readonly unknown[], update: (items: T[]) => T[]) {
  startTransition(() => {
    queryClient.setQueriesData({ queryKey }, (data: unknown) => {
      if (isPage<T>(data)) {
        const items = update(data.data);
        if (items === data.data) return data;

        return { ...data, data: items, total: data.total - (data.data.length - items.length) };
      }
      if (!isInfinitePages<T>(data)) return data;

      const pageItems = data.pages.map((page) => update(page.data));
      if (pageItems.every((items, i) => items === data.pages[i].data)) return data;

      const removed = pageItems.reduce((sum, items, i) => sum + data.pages[i].data.length - items.length, 0);

      return {
        ...data,
        pages: data.pages.map((page, i) => ({ ...page, data: pageItems[i], total: page.total - removed })),
      };
    });
  });
}

export function patchPaginatedItems<T>(queryClient: QueryClient, queryKey: readonly unknown[], patch: (item: T) => T) {
  updatePaginatedItems<T>(queryClient, queryKey, (items) => {
    let changed = false;
    const next = items.map((item) => {
      const patched = patch(item);
      if (patched !== item) changed = true;
      return patched;
    });

    return changed ? next : items;
  });
}

export function removePaginatedItems<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  match: (item: T) => boolean,
) {
  updatePaginatedItems<T>(queryClient, queryKey, (items) => {
    const next = items.filter((item) => !match(item));

    return next.length === items.length ? items : next;
  });
}
