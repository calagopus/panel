import { keepPreviousData, useQuery } from '@tanstack/react-query';
import debounce from 'debounce';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface UseSearchablePaginatedTableOptions<T> {
  queryKey: readonly unknown[];
  fetcher: (page: number, search: string) => Promise<T>;
  setStoreData?: (data: T) => void;
  paginationKey?: string;
  deps?: unknown[];
  debounceMs?: number;
  initialPage?: number;
  modifyParams?: boolean;
  canRequest?: boolean;
}

function parseNumber(num: string | null): number | null {
  if (!num) return null;

  const parsed = parseInt(num);

  return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}

// TODO 1.1.x: Rename this to match file name/rename file
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
}: UseSearchablePaginatedTableOptions<T>) {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(modifyParams ? searchParams.get('search') || '' : '');
  const [page, setPage] = useState(modifyParams ? (parseNumber(searchParams.get('page')) ?? initialPage) : initialPage);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    if (modifyParams) {
      setSearchParams({ page: page.toString(), search });
    }
  }, [modifyParams, page, search]);

  const updateDebouncedSearch = useCallback(
    debounce((s: string) => setDebouncedSearch(s), debounceMs),
    [],
  );

  useEffect(() => {
    if (!search) {
      updateDebouncedSearch.clear();
      setDebouncedSearch('');
    } else {
      updateDebouncedSearch(search);
    }
  }, [search]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...queryKey, ...deps, { page, search: debouncedSearch }],
    queryFn: () => fetcher(page, debouncedSearch),
    placeholderData: keepPreviousData,
    enabled: canRequest,
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
    loading: isLoading,
    search,
    setSearch,
    page,
    setPage,
    refetch: () => refetch(),
  };
}
