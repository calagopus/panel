import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import debounce from 'debounce';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

const EMPTY_ITEMS: never[] = [];

interface UseInfiniteSearchableResourceOptions<T> {
  queryKey: readonly unknown[];
  fetcher: (page: number, search: string) => Promise<Pagination<T>>;
  defaultSearchValue?: string;
  deps?: unknown[];
  debounceMs?: number;
  canRequest?: boolean;
}

export function useInfiniteSearchableResource<T>({
  queryKey,
  fetcher,
  defaultSearchValue = '',
  deps = [],
  debounceMs = 150,
  canRequest = true,
}: UseInfiniteSearchableResourceOptions<T>) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState(defaultSearchValue);
  const [debouncedSearch, setDebouncedSearch] = useState(defaultSearchValue);

  const updateDebouncedSearch = useMemo(() => debounce((s: string) => setDebouncedSearch(s), debounceMs), [debounceMs]);

  useEffect(() => {
    updateDebouncedSearch(search);
  }, [search]);

  const { data, isFetching, isFetchingNextPage, isPlaceholderData, hasNextPage, fetchNextPage, error, refetch } =
    useInfiniteQuery({
      queryKey: [...queryKey, ...deps, 'infinite', { search: debouncedSearch }],
      queryFn: ({ pageParam }) => fetcher(pageParam, debouncedSearch),
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) => {
        const loaded = allPages.reduce((sum, p) => sum + p.data.length, 0);
        return lastPage.data.length > 0 && loaded < lastPage.total ? allPages.length + 1 : undefined;
      },
      enabled: canRequest && (!deps.length || deps.every(Boolean)),
      placeholderData: keepPreviousData,
    });

  useEffect(() => {
    if (error) {
      addToast(httpErrorToHuman(error), 'error');
    }
  }, [error]);

  const items = useMemo(() => data?.pages.flatMap((page) => page.data) ?? EMPTY_ITEMS, [data]);
  const loading = (isFetching && !isFetchingNextPage) || search !== debouncedSearch;
  const hasMore = hasNextPage && !isPlaceholderData && !error;

  const loadMore = useCallback(() => {
    if (hasMore && !isFetchingNextPage) fetchNextPage();
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  const infiniteScroll = useMemo(
    () => ({ hasMore, loadingMore: isFetchingNextPage, onLoadMore: loadMore }),
    [hasMore, isFetchingNextPage, loadMore],
  );

  return {
    items,
    loading,
    search,
    setSearch,
    infiniteScroll,
    refetch: () => refetch(),
    invalidate: () => queryClient.invalidateQueries({ queryKey: [...queryKey, ...deps] }),
  };
}

export function asSinglePage<T>(page: Promise<Pagination<T>>): Promise<Pagination<T>> {
  return page.then((result) => ({ ...result, total: result.data.length }));
}
