import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getEggMounts from '@/api/admin/nests/eggs/mounts/getEggMounts.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
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

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.eggs.mounts(contextEgg.uuid),
    fetcher: (page, search) => getEggMounts(contextNest.uuid, contextEgg.uuid, page, search),
  });

  const eggMounts = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminSubContentContainer
      title='Egg Mounts'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          Add
        </Button>
      }
    >
      <EggMountAddModal
        nest={contextNest}
        egg={contextEgg}
        opened={openModal === 'add'}
        onClose={() => setOpenModal(null)}
      />

      <ContextMenuProvider>
        <Table
          columns={['ID', 'Name', 'Source', 'Target', 'Added', '']}
          loading={loading}
          pagination={eggMounts}
          onPageSelect={setPage}
        >
          {eggMounts.data.map((mount) => (
            <EggMountRow key={mount.mount.uuid} nest={contextNest} egg={contextEgg} mount={mount} />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
