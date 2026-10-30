import { faServer } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import getServers from '@/api/server/getServers.ts';
import { AdminCan } from '@/elements/Can.tsx';
import AccountContentContainer from '@/elements/containers/AccountContentContainer.tsx';
import { NoItems, Pagination } from '@/elements/data-display/Table.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { eventKeyMatches } from '@/lib/quickActions/shortcuts.ts';
import { serverPowerAction, serverSchema } from '@/lib/schemas/server/server.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useBulkPowerActions } from '@/plugins/server/useBulkPowerActions.ts';
import { useServerListShowOthers } from '@/plugins/server/useServerListShowOthers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useUserStore } from '@/stores/user.ts';
import BulkActionBar from './BulkActionBar.tsx';
import DashboardHomeTitle from './DashboardHomeTitle.tsx';
import ServerItem from './ServerItem.tsx';

export default function DashboardHomeAll() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const setServerGroups = useUserStore((state) => state.setServerGroups);
  const [serverListShowOthers, setServerListShowOthers] = useServerListShowOthers();
  const { addToast } = useToast();

  const [selectedServers, setSelectedServers] = useState(new ObjectSet<z.infer<typeof serverSchema>, 'uuid'>('uuid'));
  const sKeyPressedRef = useRef(false);

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
      if (eventKeyMatches(e, 's')) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          sKeyPressedRef.current = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (eventKeyMatches(e, 's')) {
        sKeyPressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const {
    data: servers,
    loading,
    error,
    refetch,
    search,
    debouncedSearch,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.user.servers.all(),
    fetcher: (page, search) => getServers(page, search, serverListShowOthers),
    deps: [serverListShowOthers],
  });

  const selectedPageCount = servers?.data.filter((server) => selectedServers.has(server)).length ?? 0;
  const allSelected = selectedPageCount > 0 && selectedPageCount === servers?.data.length;

  const handleServerSelectionChange = (server: z.infer<typeof serverSchema>, selected: boolean) => {
    setSelectedServers((prev) => {
      const newSet = prev.clone();
      if (selected) {
        newSet.add(server);
      } else {
        newSet.delete(server);
      }
      return newSet;
    });
  };

  const handleServerClick = (server: z.infer<typeof serverSchema>, event: React.MouseEvent) => {
    if (sKeyPressedRef.current) {
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
        <Group wrap='nowrap' className='w-full md:w-auto'>
          <Checkbox
            aria-label={t('common.button.selectAll', {})}
            title={t('common.button.selectAll', {})}
            className='shrink-0'
            checked={allSelected}
            indeterminate={selectedPageCount > 0 && !allSelected}
            disabled={loading || !servers?.data.length}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              setSelectedServers((previous) => {
                const next = previous.clone();
                for (const server of servers?.data ?? []) {
                  if (checked) {
                    next.add(server);
                  } else {
                    next.delete(server);
                  }
                }
                return next;
              });
            }}
          />
          <TextInput
            placeholder={t('common.input.search', {})}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              const firstServer = servers?.data[0];
              if (e.key === 'Enter' && firstServer && !loading && search === debouncedSearch) {
                e.preventDefault();
                navigate(`/server/${firstServer.uuidShort}`);
              }
            }}
            className='flex-1 min-w-0 md:w-62.5'
          />
        </Group>
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
      {(servers?.total ?? 0) > (servers?.perPage ?? 0) && (
        <>
          <Pagination data={servers ?? getEmptyPaginationSet()} onPageSelect={setPage} />
          <Divider my='md' />
        </>
      )}
      {loading && !servers ? (
        <Spinner.Centered />
      ) : error && !servers ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : servers?.total === 0 ? (
        debouncedSearch ? (
          <NoItems />
        ) : (
          <EmptyState
            icon={faServer}
            title={t('pages.account.home.empty.title', {})}
            description={t('pages.account.home.empty.description', {})}
          />
        )
      ) : (
        <div
          className={classNames(
            'gap-4 grid md:grid-cols-2',
            loading && 'opacity-50 pointer-events-none transition-opacity',
          )}
        >
          {servers?.data.map((server) => (
            <ServerItem
              key={server.uuid}
              server={server}
              showContextMenu
              showGroupAddButton
              showForeignServerBadge
              isSelected={selectedServers.has(server.uuid)}
              onSelectionChange={(selected) => handleServerSelectionChange(server, selected)}
              onClick={(e) => handleServerClick(server, e)}
              sKeyPressedRef={sKeyPressedRef}
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
      {(servers?.total ?? 0) > (servers?.perPage ?? 0) && (
        <>
          <Divider my='md' />
          <Pagination data={servers ?? getEmptyPaginationSet()} onPageSelect={setPage} />
        </>
      )}
    </AccountContentContainer>
  );
}
