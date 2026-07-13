import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getLocationDatabaseAgentHosts from '@/api/admin/locations/database-agent-hosts/getLocationDatabaseAgentHosts.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { locationDatabaseAgentHostTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import LocationDatabaseAgentHostRow from './LocationDatabaseAgentHostRow.tsx';
import LocationDatabaseAgentHostCreateModal from './modals/LocationDatabaseAgentHostCreateModal.tsx';

export default function AdminLocationDatabaseAgentHosts({
  location,
}: {
  location: z.infer<typeof adminLocationSchema>;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'create' | null>(null);

  const {
    data: locationDatabaseAgentHosts,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.locations.databaseAgentHosts(location.uuid),
    fetcher: (page, search) => getLocationDatabaseAgentHosts(location.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.locations.tabs.databaseAgentHosts.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='database-agent-hosts.read'>
          <Button onClick={() => setOpenModal('create')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='database-agent-hosts.read'>
        <LocationDatabaseAgentHostCreateModal
          location={location}
          opened={openModal === 'create'}
          onClose={() => setOpenModal(null)}
        />
      </AdminCan>

      <Table
        columns={locationDatabaseAgentHostTableColumns()}
        loading={loading}
        error={error}
        pagination={locationDatabaseAgentHosts}
        onPageSelect={setPage}
      >
        {locationDatabaseAgentHosts?.data.map((host) => (
          <LocationDatabaseAgentHostRow
            key={host.databaseAgentHost.uuid}
            location={location}
            databaseAgentHost={host}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
