import { ComboboxData, Input, SelectProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import getServers from '@/api/server/getServers.ts';
import { AdminCan } from '@/elements/Can.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ServerSelectItem {
  uuid: string;
  name: string;
}

type Props<T extends ServerSelectItem> = Omit<SelectProps, 'data' | 'value' | 'onChange'> & {
  value: string | null;
  onChange: (uuid: string | null, server: T | null) => void;
  queryKey?: readonly unknown[];
  fetcher?: (search: string, showOthers: boolean) => Promise<Pagination<T>>;
  exclude?: string[];
  groupBy?: (server: T) => string;
  selectedItem?: T | null;
  withOthersSwitch?: boolean;
};

const defaultFetcher = (search: string, showOthers: boolean) => getServers(1, search, showOthers);

export default function ServerSelect<T extends ServerSelectItem = z.infer<typeof serverSchema>>({
  value,
  onChange,
  queryKey = queryKeys.user.servers.all(),
  fetcher = defaultFetcher as unknown as (search: string, showOthers: boolean) => Promise<Pagination<T>>,
  exclude,
  groupBy,
  selectedItem,
  withOthersSwitch,
  label,
  withAsterisk,
  placeholder,
  ...rest
}: Props<T>) {
  const { t } = useTranslations();

  const [showOthers, setShowOthers] = useState(false);
  const [lastSelected, setLastSelected] = useState<T | null>(null);

  const servers = useSearchableResource<T>({
    queryKey: [...queryKey, { showOthers }],
    fetcher: (search) => fetcher(search, showOthers),
  });

  const items = exclude?.length ? servers.items.filter((s) => !exclude.includes(s.uuid)) : servers.items;

  let data: ComboboxData;
  if (groupBy) {
    data = items.reduce(
      (acc, server) => {
        const groupName = groupBy(server);
        const group = acc.find((g) => g.group === groupName);
        const item = { label: server.name, value: server.uuid };

        if (group) {
          group.items.push(item);
        } else {
          acc.push({ group: groupName, items: [item] });
        }

        return acc;
      },
      [] as Array<{ group: string; items: Array<{ label: string; value: string }> }>,
    );
  } else {
    data = items.map((server) => ({ label: server.name, value: server.uuid }));
  }

  if (value && !items.some((s) => s.uuid === value)) {
    const known = selectedItem?.uuid === value ? selectedItem : lastSelected?.uuid === value ? lastSelected : null;
    data = [{ label: known?.name ?? value, value }, ...(data as Array<never>)];
  }

  const renderSelect = (inlineLabel: boolean) => (
    <Select
      data={data}
      value={value}
      onChange={(v) => {
        const server =
          items.find((s) => s.uuid === v) ??
          (selectedItem?.uuid === v ? selectedItem : null) ??
          (lastSelected?.uuid === v ? lastSelected : null);
        if (server) {
          setLastSelected(server);
        }
        onChange(v || null, server);
      }}
      searchable
      searchValue={servers.search}
      onSearchChange={servers.setSearch}
      loading={servers.loading}
      label={inlineLabel ? undefined : label}
      withAsterisk={inlineLabel ? undefined : withAsterisk}
      placeholder={placeholder ?? (typeof label === 'string' ? label : undefined)}
      {...rest}
    />
  );

  if (!withOthersSwitch) {
    return renderSelect(false);
  }

  return (
    <AdminCan action='servers.read' renderOnCant={renderSelect(false)}>
      <div>
        <div className='flex items-center justify-between mb-1'>
          <Input.Label required={withAsterisk}>{label}</Input.Label>
          <Switch
            size='xs'
            labelPosition='left'
            label={t('elements.serverSelect.showOtherUsersServers', {})}
            checked={showOthers}
            onChange={(e) => setShowOthers(e.currentTarget.checked)}
          />
        </div>
        {renderSelect(true)}
      </div>
    </AdminCan>
  );
}
