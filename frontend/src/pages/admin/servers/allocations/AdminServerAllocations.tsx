import { faArrowsRotate, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import getServerAllocations from '@/api/admin/servers/allocations/getServerAllocations.ts';
import reassignServerAllocations from '@/api/admin/servers/allocations/reassignServerAllocations.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { serverAllocationTableColumns } from '@/lib/tableColumns.ts';
import ServerAllocationAddModal from '@/pages/admin/servers/allocations/modals/ServerAllocationAddModal.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import ServerAllocationRow from './ServerAllocationRow.tsx';

export default function AdminServerAllocations({ server }: { server: AdminServer }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [openModal, setOpenModal] = useState<'add' | 'reassign' | null>(null);

  const {
    data: serverAllocations,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.servers.allocations(server.uuid),
    fetcher: (page, search, perPage) => getServerAllocations(server.uuid, page, search, perPage),
    backgroundRefetch: true,
  });

  const doReassign = () =>
    reassignServerAllocations(server.uuid).then(() => {
      setOpenModal(null);
      addToast(t('pages.admin.servers.tabs.allocations.page.toast.reassigned', {}), 'success');
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.allocations(server.uuid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.variables(server.uuid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.detail(server.uuid) });
    });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.allocations.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Group>
          <AdminCan action='servers.allocations'>
            <Button onClick={() => setOpenModal('reassign')} leftSection={<FontAwesomeIcon icon={faArrowsRotate} />}>
              {t('pages.admin.servers.tabs.allocations.page.button.reassign', {})}
            </Button>
          </AdminCan>
          <AdminCan action={['nodes.read', 'nodes.allocations']}>
            <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
              {t('common.button.add', {})}
            </Button>
          </AdminCan>
        </Group>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.allocations.subContainer}
      registryProps={{ server }}
    >
      <ConfirmationModal
        opened={openModal === 'reassign'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.servers.tabs.allocations.page.modal.reassign.title', {})}
        confirm={t('pages.admin.servers.tabs.allocations.page.button.reassign', {})}
        onConfirmed={doReassign}
      >
        {t('pages.admin.servers.tabs.allocations.page.modal.reassign.content', { server: server.name }).md()}
      </ConfirmationModal>

      <AdminCan action={['nodes.read', 'nodes.allocations']}>
        <ServerAllocationAddModal server={server} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <Table
        columns={serverAllocationTableColumns()}
        loading={loading}
        pagination={serverAllocations}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {serverAllocations?.data.map((allocation) => (
          <ServerAllocationRow key={allocation.uuid} server={server} allocation={allocation} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
