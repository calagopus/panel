import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getLocationDatabaseHosts from '@/api/admin/locations/database-hosts/getLocationDatabaseHosts.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { locationDatabaseHostTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import LocationDatabaseHostRow from './LocationDatabaseHostRow.tsx';
import LocationDatabaseHostCreateModal from './modals/LocationDatabaseHostCreateModal.tsx';

export default function AdminLocationDatabaseHosts({ location }: { location: z.infer<typeof adminLocationSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: locationDatabaseHosts,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.locations.databaseHosts(location.uuid),
    fetcher: (page, search) => getLocationDatabaseHosts(location.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.locations.tabs.databaseHosts.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='database-hosts.read'>
          <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
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

      <Table
        columns={locationDatabaseHostTableColumns()}
        loading={loading}
        error={error}
        pagination={locationDatabaseHosts}
        onPageSelect={setPage}
      >
        {locationDatabaseHosts?.data.map((databaseHost) => (
          <LocationDatabaseHostRow
            key={databaseHost.databaseHost.uuid}
            location={location}
            databaseHost={databaseHost}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
