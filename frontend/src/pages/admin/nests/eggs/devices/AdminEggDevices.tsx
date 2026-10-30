import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getEggDevices from '@/api/admin/nests/eggs/devices/getEggDevices.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { eggDeviceTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggDeviceRow from './EggDeviceRow.tsx';
import EggDeviceAddModal from './modals/EggDeviceAddModal.tsx';

export default function AdminEggDevices({
  contextNest,
  contextEgg,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
}) {
  const [openModal, setOpenModal] = useState<'add' | null>(null);
  const { t } = useTranslations();

  const {
    data: eggDevices,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.deviceAssignments.devicesByEgg(contextEgg.uuid),
    fetcher: (page, search, perPage) => getEggDevices(contextNest.uuid, contextEgg.uuid, page, search, perPage),
    backgroundRefetch: true,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nests.tabs.eggs.page.tabs.devices.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('common.button.add', {})}
        </Button>
      }
    >
      <EggDeviceAddModal
        nest={contextNest}
        egg={contextEgg}
        opened={openModal === 'add'}
        onClose={() => setOpenModal(null)}
      />

      <Table
        columns={eggDeviceTableColumns()}
        loading={loading}
        error={error}
        pagination={eggDevices}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
      >
        {eggDevices?.data.map((device) => (
          <EggDeviceRow key={device.device.uuid} nest={contextNest} egg={contextEgg} device={device} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
