import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getPermissions from '@/api/getPermissions.ts';
import createSubuser from '@/api/server/subusers/createSubuser.ts';
import getSubusers from '@/api/server/subusers/getSubusers.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import SubuserCreateOrUpdateModal from './modals/SubuserCreateOrUpdateModal.tsx';
import SubuserRow from './SubuserRow.tsx';

export default function ServerSubusers() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { setAvailablePermissions } = useGlobalStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);

  useEffect(() => {
    getPermissions().then((res) => {
      setAvailablePermissions(res);
    });
  }, []);

  const { data, loading, search, setSearch, setPage, refetch } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).subusers.all(),
    fetcher: (page, search) => getSubusers(server.uuid, page, search),
  });

  const subusers = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  const doCreate = (email: string, permissions: string[], ignoredFiles: string[], captcha: string | null) => {
    createSubuser(server.uuid, { email, permissions, ignoredFiles, captcha })
      .then(() => {
        refetch();
        addToast(t('pages.server.subusers.modal.createSubuser.toast.created', {}), 'success');
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <ServerContentContainer
      title={t('pages.server.subusers.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ServerCan action='subusers.create'>
          <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.create', {})}
          </Button>
        </ServerCan>
      }
      registry={window.extensionContext.extensionRegistry.pages.server.subusers.container}
    >
      <SubuserCreateOrUpdateModal
        onCreate={doCreate}
        opened={openModal === 'create'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenuProvider>
        <Table
          columns={[
            '',
            t('common.table.columns.username', {}),
            t('pages.server.subusers.table.columns.twoFactorEnabled', {}),
            t('pages.server.subusers.table.columns.permissions', {}),
            t('pages.server.subusers.table.columns.ignoredFiles', {}),
            '',
          ]}
          loading={loading}
          pagination={subusers}
          onPageSelect={setPage}
        >
          {subusers.data.map((su) => (
            <SubuserRow subuser={su} key={su.user.uuid} />
          ))}
        </Table>
      </ContextMenuProvider>
    </ServerContentContainer>
  );
}
