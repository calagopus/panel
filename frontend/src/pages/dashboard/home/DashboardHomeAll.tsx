import { Group } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import getServers from '@/api/server/getServers.ts';
import { AdminCan } from '@/elements/Can.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import Divider from '@/elements/Divider.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { Pagination } from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverPowerAction, serverSchema } from '@/lib/schemas/server/server.ts';
import { useBulkPowerActions } from '@/plugins/useBulkPowerActions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useUserStore } from '@/stores/user.ts';
import BulkActionBar from './BulkActionBar.tsx';
import DashboardHomeTitle from './DashboardHomeTitle.tsx';
import ServerItem from './ServerItem.tsx';

export default function DashboardHomeAll() {
  const { t } = useTranslations();
  const { setServerGroups } = useUserStore();
  const { serverListShowOthers, setServerListShowOthers } = useGlobalStore();
  const { addToast } = useToast();

  const [selectedServers, setSelectedServers] = useState(new ObjectSet<z.infer<typeof serverSchema>, 'uuid'>('uuid'));
  const [sKeyPressed, setSKeyPressed] = useState(false);

  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();

  useEffect(() => {
    getServerGroups()
      .then((response) => {
        setServerGroups(response);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  }, [addToast, setServerGroups]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only track 'S' key if not typing in an input field
      if (e.key === 's' || e.key === 'S') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          setSKeyPressed(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        setSKeyPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.servers.all(),
    fetcher: (page, search) => getServers(page, search, serverListShowOthers),
    deps: [serverListShowOthers],
  });

  const servers = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  const handleServerSelectionChange = (server: z.infer<typeof serverSchema>, selected: boolean) => {
    setSelectedServers((prev) => {
      const newSet = new ObjectSet('uuid', prev.values());
      if (selected) {
        newSet.add(server);
      } else {
        newSet.delete(server);
      }
      return newSet;
    });
  };

  const handleServerClick = (server: z.infer<typeof serverSchema>, event: React.MouseEvent) => {
    if (sKeyPressed) {
      event.preventDefault();
      event.stopPropagation();
      handleServerSelectionChange(server, !selectedServers.has(server));
    }
  };

  const onBulkAction = async (action: z.infer<typeof serverPowerAction>) => {
    await handleBulkPowerAction(selectedServers.keys(), action);
    setSelectedServers(new ObjectSet('uuid'));
  };

  return (
    <AccountContentContainer
      title={t('pages.account.home.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.dashboard.home.containerAll}
    >
      <DashboardHomeTitle />

      <Group mb='md' justify='space-between'>
        <TextInput
          placeholder={t('common.input.search', {})}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          w={250}
        />
        <AdminCan action='servers.read'>
          <Switch
            label={t('pages.account.home.tabs.allServers.page.input.showOtherUsersServers', {})}
            checked={serverListShowOthers}
            onChange={(e) => {
              setPage(1);
              setServerListShowOthers(e.currentTarget.checked);
            }}
          />
        </AdminCan>
      </Group>
      {servers.total > servers.perPage && (
        <>
          <Pagination data={servers} onPageSelect={setPage} />
          <Divider my='md' />
        </>
      )}
      {loading ? (
        <Spinner.Centered />
      ) : servers.total === 0 ? (
        <p className='text-gray-400'>{t('pages.account.home.noServers', {})}</p>
      ) : (
        <div className='gap-4 grid md:grid-cols-2'>
          {servers.data.map((server) => (
            <ServerItem
              key={server.uuid}
              server={server}
              showGroupAddButton={!serverListShowOthers}
              isSelected={selectedServers.has(server.uuid)}
              onSelectionChange={(selected) => handleServerSelectionChange(server, selected)}
              onClick={(e) => handleServerClick(server, e)}
              sKeyPressed={sKeyPressed}
            />
          ))}
        </div>
      )}
      <BulkActionBar
        selectedCount={selectedServers.size}
        onClear={() => setSelectedServers(new ObjectSet('uuid'))}
        onAction={onBulkAction}
        loading={bulkActionLoading}
      />
      {servers.total > servers.perPage && (
        <>
          <Divider my='md' />
          <Pagination data={servers} onPageSelect={setPage} />
        </>
      )}
    </AccountContentContainer>
  );
}
