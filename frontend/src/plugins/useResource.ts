import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface UseResourceOptions<T> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  silent?: boolean;
}

export function useResource<T>({ queryKey, queryFn, enabled, silent = false }: UseResourceOptions<T>) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isFetching, error, refetch } = useQuery({ queryKey, queryFn, enabled });

  useEffect(() => {
    if (error && !silent) addToast(httpErrorToHuman(error), 'error');
  }, [error]);

  return {
    data,
    loading: isFetching,
    error,
    refetch: () => refetch(),
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
  };
}
