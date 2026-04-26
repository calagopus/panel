import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getLocationDatabaseHosts from '@/api/admin/locations/database-hosts/getLocationDatabaseHosts.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import { ContextMenuProvider } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationDatabaseHostSchema, adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { locationDatabaseHostTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import LocationDatabaseHostRow from './LocationDatabaseHostRow.tsx';
import LocationDatabaseHostCreateModal from './modals/LocationDatabaseHostCreateModal.tsx';

export default function AdminLocationDatabaseHosts({ location }: { location: z.infer<typeof adminLocationSchema> }) {
  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.locations.databaseHosts(location.uuid),
    fetcher: (page, search) => getLocationDatabaseHosts(location.uuid, page, search),
  });

  const locationDatabaseHosts = data ?? getEmptyPaginationSet<z.infer<typeof adminLocationDatabaseHostSchema>>();

  return (
    <AdminSubContentContainer
      title='Location Database Hosts'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='database-hosts.read'>
          <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            Add
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='database-hosts.read'>
        <LocationDatabaseHostCreateModal
          location={location}
          opened={openModal === 'create'}
          onClose={() => setOpenModal(null)}
        />
      </AdminCan>

      <ContextMenuProvider>
        <Table
          columns={locationDatabaseHostTableColumns}
          loading={loading}
          pagination={locationDatabaseHosts}
          onPageSelect={setPage}
        >
          {locationDatabaseHosts.data.map((databaseHost) => (
            <LocationDatabaseHostRow
              key={databaseHost.databaseHost.uuid}
              location={location}
              databaseHost={databaseHost}
            />
          ))}
        </Table>
      </ContextMenuProvider>
    </AdminSubContentContainer>
  );
}
