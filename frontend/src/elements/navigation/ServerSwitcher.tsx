import { SelectProps } from '@mantine/core';
import classNames from 'classnames';
import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import getServers from '@/api/server/getServers.ts';
import Select from '@/elements/input/Select.tsx';
import { serverStatusInfo } from '@/lib/domain/server.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverPowerState, serverSchema, serverStatus } from '@/lib/schemas/server/server.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useServerStats } from '@/plugins/server/useServerStats.ts';
import { usePageBreakpoint } from '@/plugins/viewport/usePageBreakpoint.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const getStatusColor = (
  powerState?: z.infer<typeof serverPowerState>,
  status?: z.infer<typeof serverStatus> | null,
  suspended?: boolean,
) => {
  if (suspended) return 'bg-server-status-offline';
  if (status) {
    return serverStatusInfo[status].failed ? 'bg-server-status-offline' : 'bg-server-status-starting';
  }

  switch (powerState) {
    case 'running':
      return 'bg-server-status-running';
    case 'starting':
      return 'bg-server-status-starting';
    case 'stopping':
      return 'bg-server-status-stopping';
    default:
      return 'bg-server-status-offline';
  }
};

function ServerSwitcherOption({ server }: { server: z.infer<typeof serverSchema> }) {
  const stats = useServerStats(server);

  return (
    <div className='flex items-center gap-2'>
      <span
        className={classNames(
          'w-2 h-2 rounded-full shrink-0',
          getStatusColor(stats?.state, server.status, server.isSuspended),
        )}
      />
      <span className='truncate'>{server.name}</span>
    </div>
  );
}

export default function ServerSwitcher({ className, isServer }: { className?: string; isServer?: boolean }) {
  const { t } = useTranslations();
  const currentServer = useServerStore((state) => state.server);
  const location = useLocation();
  const navigate = useNavigate();
  const wide = usePageBreakpoint('md');
  const [opened, setOpened] = useState(false);

  const servers = useInfiniteSearchableResource<z.infer<typeof serverSchema>>({
    queryKey: queryKeys.user.servers.all(),
    fetcher: (page, search) => getServers(page, search),
    canRequest: opened,
  });

  const otherServers = servers.items.filter((s) => s.uuid !== currentServer?.uuid);

  const renderOption: SelectProps['renderOption'] = ({ option }) => {
    const server = otherServers.find((s) => s.uuid === option.value);
    if (!server) return option.label;

    return <ServerSwitcherOption server={server} />;
  };

  const handleChange = useCallback(
    (value: string | null) => {
      if (value) {
        const currentPath = location.pathname.replace(/^\/server\/[^/]+/, '');
        const uuidShort = value.slice(0, 8);

        if (isServer) navigate(`/server/${uuidShort}${currentPath}${location.search}${location.hash}`);
        else navigate(`/server/${uuidShort}`);
      }
    },
    [location, isServer, navigate],
  );

  return (
    <Select
      className={className}
      placeholder={currentServer.name ? currentServer.name : t('common.input.search', {})}
      data={otherServers.map((server) => ({
        label: server.name,
        value: server.uuid,
      }))}
      value={null}
      onChange={handleChange}
      onDropdownOpen={() => setOpened(true)}
      searchable
      selectFirstOptionOnChange
      searchValue={servers.search}
      onSearchChange={servers.setSearch}
      infiniteScroll={servers.infiniteScroll}
      loading={servers.loading}
      renderOption={renderOption}
      comboboxProps={{ withinPortal: wide, position: 'top' }}
    />
  );
}
