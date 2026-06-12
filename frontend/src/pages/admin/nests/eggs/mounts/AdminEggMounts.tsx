import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getEggMounts from '@/api/admin/nests/eggs/mounts/getEggMounts.ts';
import Button from '@/elements/Button.tsx';

import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { eggMountTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggMountRow from './EggMountRow.tsx';
import EggMountAddModal from './modals/EggMountAddModal.tsx';

export default function AdminEggMounts({
  contextNest,
  contextEgg,
}: {
  contextNest: z.infer<typeof adminNestSchema>;
  contextEgg: z.infer<typeof adminEggSchema>;
}) {
  const [openModal, setOpenModal] = useState<'add' | null>(null);
  const { t } = useTranslations();

  const {
    data: eggMounts,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.eggs.mounts(contextEgg.uuid),
    fetcher: (page, search) => getEggMounts(contextNest.uuid, contextEgg.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nests.tabs.eggs.page.tabs.mounts.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('common.button.add', {})}
        </Button>
      }
    >
      <EggMountAddModal
        nest={contextNest}
        egg={contextEgg}
        opened={openModal === 'add'}
        onClose={() => setOpenModal(null)}
      />

      <Table columns={eggMountTableColumns()} loading={loading} pagination={eggMounts} onPageSelect={setPage}>
        {eggMounts?.data.map((mount) => (
          <EggMountRow key={mount.mount.uuid} nest={contextNest} egg={contextEgg} mount={mount} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
