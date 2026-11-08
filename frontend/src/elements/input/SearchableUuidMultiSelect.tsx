import { MultiSelectProps } from '@mantine/core';
import { useQueries } from '@tanstack/react-query';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import { asSinglePage, useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';

interface Item {
  uuid: string;
  name: string;
}

type Props<T extends Item> = Omit<MultiSelectProps, 'data' | 'value' | 'onChange'> & {
  value: string[];
  onChange: (value: string[]) => void;
  listQueryKey: readonly unknown[];
  detailQueryKey: (uuid: string) => readonly unknown[];
  fetchPage?: (search: string) => Promise<Pagination<T>>;
  paginatedFetcher?: (page: number, search: string) => Promise<Pagination<T>>;
  fetchOne: (uuid: string) => Promise<T>;
};

/**
 * Multi-select over a paginated, searchable resource that stores bare uuids. Selected uuids that
 * fall outside the current search page are fetched individually so their pills keep a name.
 */
export default function SearchableUuidMultiSelect<T extends Item>({
  value,
  onChange,
  listQueryKey,
  detailQueryKey,
  fetchPage,
  paginatedFetcher,
  fetchOne,
  ...rest
}: Props<T>) {
  const resource = useInfiniteSearchableResource<T>({
    queryKey: listQueryKey,
    fetcher: (page, search) => (paginatedFetcher ? paginatedFetcher(page, search) : asSinglePage(fetchPage!(search))),
  });

  const missing = value.filter((uuid) => !resource.items.some((item) => item.uuid === uuid));
  const details = useQueries({
    queries: missing.map((uuid) => ({
      queryKey: detailQueryKey(uuid),
      queryFn: () => fetchOne(uuid),
      retry: false,
    })),
  });

  const data = [
    ...missing.map((uuid, i) => ({ label: details[i].data?.name ?? uuid, value: uuid })),
    ...resource.items.map((item) => ({ label: item.name, value: item.uuid })),
  ];

  return (
    <MultiSelect
      data={data}
      value={value}
      onChange={onChange}
      filter={({ options }) => options}
      searchable
      searchValue={resource.search}
      onSearchChange={resource.setSearch}
      infiniteScroll={resource.infiniteScroll}
      loading={resource.loading}
      hidePickedOptions
      {...rest}
    />
  );
}
