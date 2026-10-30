import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import getDeviceNestEggs from '@/api/admin/devices/nest-eggs/getDeviceNestEggs.ts';
import deleteEggDevice from '@/api/admin/nests/eggs/devices/deleteEggDevice.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import { removePaginatedItems } from '@/lib/queryCache.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { eggTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRow from '../../nests/eggs/EggRow.tsx';
import DeviceAddEggModal from './modals/DeviceAddEggModal.tsx';

function DeviceEggRow({
  nest,
  egg,
  device,
}: {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
  device: z.infer<typeof adminDeviceSchema>;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteEggDevice(nest.uuid, egg.uuid, device.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.admin.devices.tabs.eggs.page.toast.removed', {}), 'success');
        removePaginatedItems(
          queryClient,
          queryKeys.admin.deviceAssignments.eggsByDevice(device.uuid),
          (item: { nestEgg: { uuid: string } }) => item.nestEgg.uuid === egg.uuid,
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.deviceAssignments.all() });
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
        title={t('pages.admin.devices.tabs.eggs.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.devices.tabs.eggs.page.modal.remove.content', { device: device.name, name: egg.name }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useAdminCan('eggs.devices'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.devices.view.eggs.contextMenu}
        registryProps={{ device, egg }}
      >
        {(props) => <EggRow nest={nest} egg={egg} contextMenuProps={props} />}
      </ContextMenu>
    </>
  );
}

export default function AdminDeviceNestEggs({ device }: { device: z.infer<typeof adminDeviceSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: deviceNestEggs,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.deviceAssignments.eggsByDevice(device.uuid),
    fetcher: (page, search, perPage) => getDeviceNestEggs(device.uuid, page, search, perPage),
    backgroundRefetch: true,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.devices.tabs.eggs.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.devices.view.eggs.subContainer}
      registryProps={{ device }}
      contentRight={
        <AdminCan action='eggs.devices'>
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='eggs.devices'>
        <DeviceAddEggModal device={device} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />
      </AdminCan>

      <Table
        columns={[...eggTableColumns(), '']}
        loading={loading}
        pagination={deviceNestEggs}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
        error={error}
      >
        {deviceNestEggs?.data.map((nestEggDevice) => (
          <DeviceEggRow
            key={nestEggDevice.nestEgg.uuid}
            nest={nestEggDevice.nest}
            egg={nestEggDevice.nestEgg}
            device={device}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
