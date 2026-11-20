import { InfiniteData, QueryClient } from '@tanstack/react-query';
import { startTransition } from 'react';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

export function replaceEqualDeepWithDates(a: unknown, b: unknown, depth = 0): unknown {
  if (a === b) return a;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime() ? a : b;
  if (depth > 500) return b;

  const array = Array.isArray(a) && Array.isArray(b);
  if (!array && !(isPlainObject(a) && isPlainObject(b))) return b;

  const aRecord = a as Record<string | number, unknown>;
  const bRecord = b as Record<string | number, unknown>;
  const aSize = array ? (a as unknown[]).length : Object.keys(aRecord).length;
  const bKeys = array ? null : Object.keys(bRecord);
  const bSize = array ? (b as unknown[]).length : bKeys!.length;
  const copy = (array ? [] : {}) as Record<string | number, unknown>;
  let equalItems = 0;

  for (let i = 0; i < bSize; i++) {
    const key = array ? i : bKeys![i];
    const value = replaceEqualDeepWithDates(aRecord[key], bRecord[key], depth + 1);
    copy[key] = value;
    if (value === aRecord[key] && (array ? i < aSize : Object.hasOwn(aRecord, key))) equalItems++;
  }

  return aSize === bSize && equalItems === aSize ? a : copy;
}

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
