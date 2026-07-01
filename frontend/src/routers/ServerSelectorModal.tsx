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
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal } from '@/elements/modals/Modal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { Pagination } from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userServerGroupSchema } from '@/lib/schemas/user.ts';
import ServerGroupItem from '@/pages/dashboard/home/ServerGroupItem.tsx';
import ServerItem from '@/pages/dashboard/home/ServerItem.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import serverRoutes from '@/routers/routes/serverRoutes.ts';

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
  const [serverGroups, setServerGroups] = useState<z.infer<typeof userServerGroupSchema>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServerGroups()
      .then(setServerGroups)
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  }, []);

  const sortedServerGroups = useMemo(() => [...serverGroups].sort((a, b) => a.order - b.order), [serverGroups]);

  if (loading) return <Spinner.Centered />;

  if (serverGroups.length === 0) {
    return (
      <p className='text-gray-400 light:text-gray-600!'>
        {t('pages.account.home.tabs.groupedServers.page.noGroups', {})}
      </p>
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      {sortedServerGroups.map((serverGroup) => (
        <ServerGroupItem
          key={serverGroup.uuid}
          serverGroup={serverGroup}
          sKeyPressedRef={DUMMY_S_KEY_REF}
          getServerTo={getServerTo}
        />
      ))}
    </div>
  );
}

export default function ServerSelectorModal() {
  const { t } = useTranslations();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'all' | 'grouped'>(user?.startOnGroupedServers ? 'grouped' : 'all');

  const subPath = location.pathname.replace(/^\/server\/[^/]+/, '');

  const pageName = useMemo(() => {
    const matched = serverRoutes
      .filter((r) => !!r.name)
      .find((r) => subPath === r.path || (r.path !== '/' && subPath.startsWith(r.path + '/')));
    if (!matched?.name) return null;
    return typeof matched.name === 'function' ? matched.name() : matched.name;
  }, [subPath]);

  const getServerTo = useCallback(
    (server: z.infer<typeof serverSchema>) => `/server/${server.uuidShort}${subPath}`,
    [subPath],
  );

  return (
    <Modal opened onClose={() => navigate('/')} title={t('pages.server.selector.title', {})} size='xl'>
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
