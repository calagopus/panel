import { keepPreviousData, useQuery } from '@tanstack/react-query';
import debounce from 'debounce';
import { useEffect, useMemo, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface UseSearchableResourceOptions<T> {
  queryKey: readonly unknown[];
  fetcher: (search: string) => Promise<Pagination<T>>;
  defaultSearchValue?: string;
  deps?: unknown[];
  debounceMs?: number;
  canRequest?: boolean;
}

export function useSearchableResource<T>({
  queryKey,
  fetcher,
  defaultSearchValue = '',
  deps = [],
  debounceMs = 150,
  canRequest = true,
}: UseSearchableResourceOptions<T>) {
  const { addToast } = useToast();

  const [search, setSearch] = useState(defaultSearchValue);
  const [debouncedSearch, setDebouncedSearch] = useState(defaultSearchValue);

  const updateDebouncedSearch = useMemo(() => debounce((s: string) => setDebouncedSearch(s), debounceMs), [debounceMs]);

  useEffect(() => {
    updateDebouncedSearch(search);
  }, [search]);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: [...queryKey, ...deps, { search: debouncedSearch }],
    queryFn: () => fetcher(debouncedSearch),
    enabled: canRequest && (!deps.length || deps.every(Boolean)),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (error) {
      addToast(httpErrorToHuman(error), 'error');
    }
  }, [error]);

  return {
    items: data?.data ?? [],
    loading: isFetching,
    search,
    setSearch,
    refetch: () => refetch(),
  };
}
