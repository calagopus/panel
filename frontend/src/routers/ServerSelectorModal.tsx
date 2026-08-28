import { faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ScrollArea, Stack, Tabs, Text } from '@mantine/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getServerGroups from '@/api/me/servers/groups/getServerGroups.ts';
import getServers from '@/api/server/getServers.ts';
import Divider from '@/elements/Divider.tsx';
import { DndBoard, DndSortableList, SortableItem } from '@/elements/DragAndDrop.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal } from '@/elements/modals/Modal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { Pagination } from '@/elements/Table.tsx';
import { resolveString } from '@/lib/lazy.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import ServerGroupItem from '@/pages/dashboard/home/ServerGroupItem.tsx';
import ServerItem from '@/pages/dashboard/home/ServerItem.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { SERVER_GROUPS_CONTAINER_ID, useServerGroupsDnd } from '@/plugins/useServerGroupsDnd.ts';
import { useStartOnGroupedServers } from '@/plugins/useStartOnGroupedServers.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import serverRoutes from '@/routers/routes/serverRoutes.ts';
import { useUserStore } from '@/stores/user.ts';

const DUMMY_S_KEY_REF = { current: false } as React.RefObject<boolean>;

function AllServersView({ getServerTo }: { getServerTo: (server: z.infer<typeof serverSchema>) => string }) {
  const { t } = useTranslations();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable<
    Pagination<z.infer<typeof serverSchema>>
  >({
    queryKey: [...queryKeys.user.servers.all(), 'selector'],
    fetcher: (page, search) => getServers(page, search),
    modifyParams: false,
  });

  const servers = data ?? getEmptyPaginationSet<z.infer<typeof serverSchema>>();

  return (
    <Stack>
      <TextInput
        placeholder={t('common.input.search', {})}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        w={{ base: '100%', sm: 250 }}
      />
      {servers.total > servers.perPage && (
        <>
          <Pagination data={servers} onPageSelect={setPage} />
          <Divider />
        </>
      )}
      {loading ? (
        <Spinner.Centered />
      ) : servers.total === 0 ? (
        <p className='text-(--mantine-color-dimmed)'>{t('pages.account.home.noServers', {})}</p>
      ) : (
        <div className='gap-4 grid md:grid-cols-2'>
          {servers.data.map((server) => (
            <ServerItem key={server.uuid} server={server} to={getServerTo(server)} showSelection={false} />
          ))}
        </div>
      )}
      {servers.total > servers.perPage && (
        <>
          <Divider />
          <Pagination data={servers} onPageSelect={setPage} />
        </>
      )}
    </Stack>
  );
}

function GroupedServersView({ getServerTo }: { getServerTo: (server: z.infer<typeof serverSchema>) => string }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const serverGroups = useUserStore((state) => state.serverGroups);
  const setServerGroups = useUserStore((state) => state.setServerGroups);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServerGroups()
      .then(setServerGroups)
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  }, [addToast, setServerGroups]);

  const sortedServerGroups = useMemo(() => [...serverGroups].sort((a, b) => a.order - b.order), [serverGroups]);
  const serverGroupUuids = useMemo(() => sortedServerGroups.map((g) => g.uuid), [sortedServerGroups]);

  const {
    collisionDetection,
    describeItem,
    activeServer,
    activeServerDndId,
    activeServerSourceUuid,
    blockedTarget,
    placement,
    pendingMove,
    ...dndHandlers
  } = useServerGroupsDnd();

  if (loading) return <Spinner.Centered />;

  if (serverGroups.length === 0) {
    return (
      <p className='text-gray-400 light:text-gray-600!'>
        {t('pages.account.home.tabs.groupedServers.page.noGroups', {})}
      </p>
    );
  }

  return (
    <DndBoard
      collisionDetection={collisionDetection}
      describeItem={describeItem}
      {...dndHandlers}
      renderOverlay={() =>
        activeServer ? (
          <div style={{ cursor: 'grabbing' }} className='shadow-xl rounded-xl'>
            <ServerItem
              server={activeServer}
              to={getServerTo(activeServer)}
              showContextMenu
              showForeignServerBadge
              onGroupRemove={() => null}
            />
          </div>
        ) : null
      }
    >
      <DndSortableList id={SERVER_GROUPS_CONTAINER_ID} items={serverGroupUuids}>
        <div className='flex flex-col gap-3'>
          {sortedServerGroups.map((serverGroup) => (
            <SortableItem
              key={serverGroup.uuid}
              id={serverGroup.uuid}
              renderItem={() => (
                <ServerGroupItem
                  serverGroup={serverGroup}
                  sKeyPressedRef={DUMMY_S_KEY_REF}
                  getServerTo={getServerTo}
                  isDropTarget={
                    blockedTarget?.groupUuid === serverGroup.uuid || placement?.groupUuid === serverGroup.uuid
                  }
                  dropBlockedReason={blockedTarget?.groupUuid === serverGroup.uuid ? blockedTarget.reason : null}
                  adoptedServer={placement?.groupUuid === serverGroup.uuid ? activeServer : null}
                  adoptedDndId={placement?.groupUuid === serverGroup.uuid ? activeServerDndId : null}
                  adoptedIndex={placement?.groupUuid === serverGroup.uuid ? placement.index : null}
                  hiddenDndId={placement && activeServerSourceUuid === serverGroup.uuid ? activeServerDndId : null}
                  pendingServer={pendingMove?.groupUuid === serverGroup.uuid ? pendingMove.server : null}
                />
              )}
            />
          ))}
        </div>
      </DndSortableList>
    </DndBoard>
  );
}

export default function ServerSelectorModal() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const location = useLocation();

  const [startOnGroupedServers] = useStartOnGroupedServers();

  const [activeTab, setActiveTab] = useState<'all' | 'grouped'>(startOnGroupedServers ? 'grouped' : 'all');

  const subPath = location.pathname.replace(/^\/server\/[^/]+/, '');

  const pageName = useMemo(() => {
    const matched = serverRoutes
      .filter((r) => !!r.name)
      .find((r) => subPath === r.path || (r.path !== '/' && subPath.startsWith(r.path + '/')));
    if (!matched?.name) return null;
    return resolveString(matched.name);
  }, [subPath]);

  const getServerTo = useCallback(
    (server: z.infer<typeof serverSchema>) => `/server/${server.uuidShort}${subPath}`,
    [subPath],
  );

  return (
    <Modal opened onClose={() => navigate('/')} title={t('pages.server.selector.title', {})} size='90%'>
      <Text c='dimmed' size='sm' mb='md'>
        {pageName
          ? t('pages.server.selector.descriptionWithPage', { page: pageName }).md()
          : t('pages.server.selector.description', {})}
      </Text>

      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as 'all' | 'grouped')}>
        <Tabs.List mb='md'>
          <Tabs.Tab value='all' leftSection={<FontAwesomeIcon icon={faServer} />}>
            {t('pages.account.home.tabs.allServers.title', {})}
          </Tabs.Tab>
          <Tabs.Tab value='grouped' leftSection={<FontAwesomeIcon icon={faServer} />}>
            {t('pages.account.home.tabs.groupedServers.title', {})}
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <ScrollArea h={500} type='auto'>
        {activeTab === 'all' ? (
          <AllServersView getServerTo={getServerTo} />
        ) : (
          <GroupedServersView getServerTo={getServerTo} />
        )}
      </ScrollArea>
    </Modal>
  );
}
