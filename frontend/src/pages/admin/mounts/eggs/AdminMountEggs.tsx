import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import getMountNestEggs from '@/api/admin/mounts/nest-eggs/getMountNestEggs.ts';
import deleteEggMount from '@/api/admin/nests/eggs/mounts/deleteEggMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import ContextMenu from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { eggTableColumns } from '@/lib/tableColumns.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRow from '../../nests/eggs/EggRow.tsx';
import MountAddEggModal from './modals/MountAddEggModal.tsx';

function MountEggRow({
  nest,
  egg,
  mount,
}: {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
  mount: z.infer<typeof adminMountSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteEggMount(nest.uuid, egg.uuid, mount.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.admin.mounts.tabs.eggs.page.toast.removed', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.mountAssignments.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'remove'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.mounts.tabs.eggs.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.mounts.tabs.eggs.page.modal.remove.content', { mount: mount.name, name: egg.name }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useAdminCan('eggs.mounts'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.mounts.view.eggs.contextMenu}
        registryProps={{ mount, egg }}
      >
        {(props) => <EggRow nest={nest} egg={egg} contextMenuProps={props} />}
      </ContextMenu>
    </>
  );
}

export default function AdminMountNestEggs({ mount }: { mount: z.infer<typeof adminMountSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: mountNestEggs,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.mountAssignments.eggsByMount(mount.uuid),
    fetcher: (page, search) => getMountNestEggs(mount.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.mounts.tabs.eggs.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.mounts.view.eggs.subContainer}
      registryProps={{ mount }}
      contentRight={
        <AdminCan action='eggs.mounts'>
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='eggs.mounts'>
        <MountAddEggModal mount={mount} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <Table
        columns={[...eggTableColumns(), '']}
        loading={loading}
        pagination={mountNestEggs}
        onPageSelect={setPage}
        error={error}
      >
        {mountNestEggs?.data.map((nestEggMount) => (
          <MountEggRow
            key={nestEggMount.nestEgg.uuid}
            nest={nestEggMount.nest}
            egg={nestEggMount.nestEgg}
            mount={mount}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
