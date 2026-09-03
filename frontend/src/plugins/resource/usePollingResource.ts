import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface UsePollingResourceOptions<T> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  interval: number;
  enabled?: boolean;
  silent?: boolean;
  pollInBackground?: boolean;
  retryOnError?: number;
  stopWhen?: (data: T) => boolean;
}

export function usePollingResource<T>({
  queryKey,
  queryFn,
  interval,
  enabled,
  silent = false,
  pollInBackground = false,
  retryOnError = 0,
  stopWhen,
}: UsePollingResourceOptions<T>) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const errorsAtLastSuccess = useRef(0);

  const { data, isFetching, error, refetch, dataUpdatedAt, errorUpdateCount } = useQuery({
    queryKey,
    queryFn,
    enabled,
    refetchInterval: (query) => {
      if (query.state.status === 'error') {
        return query.state.errorUpdateCount - errorsAtLastSuccess.current <= retryOnError ? interval : false;
      }
      if (stopWhen && query.state.data !== undefined && stopWhen(query.state.data)) return false;
      return interval;
    },
    refetchIntervalInBackground: pollInBackground,
  });

  useEffect(() => {
    errorsAtLastSuccess.current = errorUpdateCount;
  }, [dataUpdatedAt]);

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
