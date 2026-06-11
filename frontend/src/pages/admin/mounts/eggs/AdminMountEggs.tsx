import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getMountNestEggs from '@/api/admin/mounts/nest-eggs/getMountNestEggs.ts';
import deleteEggMount from '@/api/admin/nests/eggs/mounts/deleteEggMount.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import ContextMenu, { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { eggTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRow from '../../nests/eggs/EggRow.tsx';
import MountAddEggModal from './modals/MountAddEggModal.tsx';

function MountEggRow({
  nest,
  egg,
  mount,
  refetch,
}: {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
  mount: z.infer<typeof adminMountSchema>;
  refetch: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteEggMount(nest.uuid, egg.uuid, mount.uuid)
      .then(() => {
        addToast(t('pages.admin.mounts.tabs.eggs.page.toast.removed', {}), 'success');
        refetch();
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
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
          },
        ]}
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
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.mounts.eggs(mount.uuid),
    fetcher: (page, search) => getMountNestEggs(mount.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.mounts.tabs.eggs.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('common.button.add', {})}
        </Button>
      }
    >
      <MountAddEggModal
        mount={mount}
        refetch={refetch}
        opened={openModal === 'add'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenuProvider>
        <Table columns={[...eggTableColumns(), '']} loading={loading} pagination={mountNestEggs} onPageSelect={setPage}>
          {mountNestEggs?.data.map((nestEggMount) => (
            <MountEggRow
              key={nestEggMount.nestEgg.uuid}
              nest={nestEggMount.nest}
              egg={nestEggMount.nestEgg}
              mount={mount}
              refetch={refetch}
            />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
