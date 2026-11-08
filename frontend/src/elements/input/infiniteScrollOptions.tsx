import {
  ComboboxData,
  ComboboxItem,
  ComboboxLikeRenderOptionInput,
  defaultOptionsFilter,
  getParsedComboboxData,
  isOptionsGroup,
  OptionsFilter,
} from '@mantine/core';
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import Spinner from '@/elements/feedback/Spinner.tsx';

export interface InfiniteScroll {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

const LOAD_MORE_VALUE = '__infinite_scroll_load_more__';

function LoadMoreOption({ loadingMore, onLoadMore }: Omit<InfiniteScroll, 'hasMore'>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || loadingMore) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore();
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [loadingMore, onLoadMore]);

  return (
    <div ref={ref} className='select-load-more flex w-full justify-center'>
      <Spinner size={16} />
    </div>
  );
}

type ParsedOptions = ReturnType<typeof getParsedComboboxData>;

function dedupeOptions(data: ParsedOptions): ParsedOptions {
  const seen = new Set<unknown>();
  const keep = (item: { value: unknown }) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  };

  return data
    .map((item) => (isOptionsGroup(item) ? { ...item, items: item.items.filter(keep) } : item))
    .filter((item) => (isOptionsGroup(item) ? item.items.length > 0 : keep(item)));
}

export function useInfiniteScrollOptions<Item extends ComboboxItem>({
  infiniteScroll,
  data,
  filter,
  renderOption,
}: {
  infiniteScroll?: InfiniteScroll;
  data?: ComboboxData;
  filter?: OptionsFilter;
  renderOption?: (input: ComboboxLikeRenderOptionInput<Item>) => ReactNode;
}) {
  const parsedData = useMemo(
    () => (infiniteScroll ? (dedupeOptions(getParsedComboboxData(data)) as ComboboxData) : data),
    [data, !infiniteScroll],
  );

  if (!infiniteScroll) return { data, filter, renderOption };

  const { hasMore, loadingMore, onLoadMore } = infiniteScroll;

  return {
    data: parsedData,
    filter: ((input: Parameters<OptionsFilter>[0]) => {
      const filtered = (filter ?? defaultOptionsFilter)(input);
      if (!hasMore) return filtered;

      return [
        ...filtered,
        {
          value: LOAD_MORE_VALUE,
          label: (<LoadMoreOption loadingMore={loadingMore} onLoadMore={onLoadMore} />) as unknown as string,
          disabled: true,
        },
      ];
    }) as OptionsFilter,
    renderOption: renderOption
      ? (input: ComboboxLikeRenderOptionInput<Item>) =>
          input.option.value === LOAD_MORE_VALUE ? input.option.label : renderOption(input)
      : undefined,
  };
}
