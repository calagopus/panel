import { useCallback } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export function useMutateWithToast() {
  const { addToast } = useToast();

  return useCallback(
    <T>(promise: Promise<T>, onSuccess?: (result: T) => void, onError?: (error: unknown) => void) => {
      promise
        .then((result) => onSuccess?.(result))
        .catch((error) => {
          addToast(httpErrorToHuman(error), 'error');
          onError?.(error);
        });
    },
    [addToast],
  );
}
