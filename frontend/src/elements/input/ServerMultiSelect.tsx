import { ComboboxData, Input, MultiSelectProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import getServers from '@/api/server/getServers.ts';
import { AdminCan } from '@/elements/Can.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import Switch from '@/elements/input/Switch.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ServerSelectItem {
  uuid: string;
  name: string;
}

type Props<T extends ServerSelectItem> = Omit<MultiSelectProps, 'data' | 'value' | 'onChange'> & {
  value: T[];
  onChange: (servers: T[]) => void;
  queryKey?: readonly unknown[];
  fetcher?: (search: string, showOthers: boolean) => Promise<Pagination<T>>;
  exclude?: string[];
  groupBy?: (server: T) => string;
  withOthersSwitch?: boolean;
};

const defaultFetcher = (search: string, showOthers: boolean) => getServers(1, search, showOthers);

export default function ServerMultiSelect<T extends ServerSelectItem = z.infer<typeof serverSchema>>({
  value,
  onChange,
  queryKey = queryKeys.user.servers.all(),
  fetcher = defaultFetcher as unknown as (search: string, showOthers: boolean) => Promise<Pagination<T>>,
  exclude,
  groupBy,
  withOthersSwitch,
  label,
  withAsterisk,
  placeholder,
  ...rest
}: Props<T>) {
  const { t } = useTranslations();

  const [showOthers, setShowOthers] = useState(false);

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

  const missing = value.filter((s) => !items.some((item) => item.uuid === s.uuid));
  if (missing.length) {
    data = [...missing.map((s) => ({ label: s.name, value: s.uuid })), ...(data as Array<never>)];
  }

  const renderSelect = (inlineLabel: boolean) => (
    <MultiSelect
      data={data}
      value={value.map((s) => s.uuid)}
      onChange={(uuids) =>
        onChange(
          uuids
            .map((uuid) => value.find((s) => s.uuid === uuid) ?? items.find((s) => s.uuid === uuid))
            .filter((s): s is T => !!s),
        )
      }
      searchable
      searchValue={servers.search}
      onSearchChange={servers.setSearch}
      loading={servers.loading}
      hidePickedOptions
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
