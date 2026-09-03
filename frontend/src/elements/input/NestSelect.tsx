import { SelectProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import getNests from '@/api/admin/nests/getNests.ts';
import Select from '@/elements/input/Select.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';

type Nest = z.infer<typeof adminNestSchema>;

type Props = Omit<SelectProps, 'data' | 'value' | 'onChange'> & {
  value: string | null;
  onChange: (uuid: string | null, nest: Nest | null) => void;
  includeItems?: Nest[];
};

export default function NestSelect({ value, onChange, includeItems = [], ...rest }: Props) {
  const [lastSelected, setLastSelected] = useState<Nest | null>(null);

  const nests = useSearchableResource<Nest>({
    queryKey: queryKeys.admin.nests.all(),
    fetcher: (search) => getNests(1, search),
  });

  const known = new Map<string, Nest>();
  for (const nest of [...includeItems, ...nests.items, ...(lastSelected ? [lastSelected] : [])]) {
    known.set(nest.uuid, nest);
  }

  const data = [...known.values()].map((nest) => ({ label: nest.name, value: nest.uuid }));

  return (
    <Select
      data={data}
      value={value}
      onChange={(uuid) => {
        const nest = uuid ? (known.get(uuid) ?? null) : null;
        if (nest) {
          setLastSelected(nest);
        }
        onChange(uuid, nest);
      }}
      searchable
      searchValue={nests.search}
      onSearchChange={nests.setSearch}
      loading={nests.loading}
      {...rest}
    />
  );
}
