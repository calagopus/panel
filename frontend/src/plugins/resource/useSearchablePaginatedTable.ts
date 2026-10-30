import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import debounce from 'debounce';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useTablePerPage } from '@/plugins/resource/useTablePerPage.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface UseSearchablePaginatedTableOptions<T> {
  queryKey: readonly unknown[];
  fetcher: (page: number, search: string, perPage: number) => Promise<T>;
  setStoreData?: (data: T) => void;
  paginationKey?: string;
  deps?: unknown[];
  debounceMs?: number;
  initialPage?: number;
  modifyParams?: boolean;
  canRequest?: boolean;
  refetchInterval?: number | false | ((data: T | undefined) => number | false);
  backgroundRefetch?: boolean;
}

function parseNumber(num: string | null): number | null {
  if (!num) return null;

  const parsed = parseInt(num);

  return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}

export function paginatedTableQueryKey(queryKey: readonly unknown[], page: number, search: string, perPage: number) {
  return [...queryKey, { page, search, perPage }];
}

export function useSearchablePaginatedTable<T>({
  queryKey = [],
  fetcher,
  setStoreData,
  paginationKey,
  deps = [],
  debounceMs = 150,
  initialPage = 1,
  modifyParams = true,
  canRequest = true,
  refetchInterval = false,
  backgroundRefetch = false,
}: UseSearchablePaginatedTableOptions<T>) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(modifyParams ? searchParams.get('search') || '' : '');
  const [page, setPage] = useState(modifyParams ? (parseNumber(searchParams.get('page')) ?? initialPage) : initialPage);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [perPage, setStoredPerPage] = useTablePerPage();

  const setPerPage = (next: number) => {
    if (next === perPage) return;

    // keep the first visible item on screen
    setPage(Math.floor(((page - 1) * perPage) / next) + 1);
    setStoredPerPage(next);
  };

  useEffect(() => {
    if (!modifyParams) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        if (page !== initialPage) {
          next.set('page', page.toString());
        } else {
          next.delete('page');
        }

        if (search) {
          next.set('search', search);
        } else {
          next.delete('search');
        }

        return next;
      },
      { replace: true },
    );
  }, [modifyParams, page, search]);

  const updateDebouncedSearch = useMemo(() => debounce((s: string) => setDebouncedSearch(s), debounceMs), [debounceMs]);

  useEffect(() => {
    if (!search) {
      updateDebouncedSearch.clear();
      setDebouncedSearch('');
    } else {
      updateDebouncedSearch(search);
    }
  }, [search]);

  const { data, isFetching, isPlaceholderData, error, refetch } = useQuery({
    queryKey: paginatedTableQueryKey([...queryKey, ...deps], page, debouncedSearch, perPage),
    queryFn: () => fetcher(page, debouncedSearch, perPage),
    placeholderData: keepPreviousData,
    enabled: canRequest,
    refetchInterval:
      typeof refetchInterval === 'function' ? (query) => refetchInterval(query.state.data) : refetchInterval,
  });

  useEffect(() => {
    if (error) {
      addToast(httpErrorToHuman(error), 'error');
    }
  }, [error]);

  useEffect(() => {
    if (!data) return;

    const paginationData = paginationKey
      ? data && typeof data === 'object' && paginationKey in data
        ? data[paginationKey as never]
        : data
      : data;

    if (
      paginationData &&
      typeof paginationData === 'object' &&
      'total' in paginationData &&
      typeof paginationData.total === 'number' &&
      'perPage' in paginationData &&
      typeof paginationData.perPage === 'number' &&
      'page' in paginationData &&
      typeof paginationData.page === 'number'
    ) {
      const totalPages = Math.ceil(paginationData.total / paginationData.perPage);

      if (paginationData.total === 0 && paginationData.page !== 1) {
        setPage(1);
      } else if (page > totalPages && totalPages !== 0) {
        setPage(totalPages);
      } else {
        setStoreData?.(data);
      }
    } else {
      setStoreData?.(data);
    }
  }, [data]);

  return {
    data: data as T | undefined,
    loading:
      isFetching && ((refetchInterval === false && !backgroundRefetch) || isPlaceholderData || data === undefined),
    error: error ? httpErrorToHuman(error) : null,
    search,
    debouncedSearch,
    setSearch,
    page,
    setPage,
    perPage,
    setPerPage,
    refetch: () => refetch(),
    invalidate: () => queryClient.invalidateQueries({ queryKey: [...queryKey, ...deps] }),
  };
}
