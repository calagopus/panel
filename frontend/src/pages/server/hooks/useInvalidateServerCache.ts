import { QueryFilters, useQueryClient } from '@tanstack/react-query';

export default function useInvalidateServerCache() {
  const queryClient = useQueryClient();

  return (queryKey: QueryFilters['queryKey']) => {
    queryClient
      .invalidateQueries({
        queryKey,
      })
      .catch((e) => console.error(e));
  };
}
