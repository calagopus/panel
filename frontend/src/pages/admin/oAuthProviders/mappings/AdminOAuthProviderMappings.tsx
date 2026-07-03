import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getOAuthProviderMappings from '@/api/admin/oauth-providers/mappings/getOAuthProviderMappings.ts';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { adminOAuthProviderMappingsTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import OAuthProviderMappingModal from './modals/OAuthProviderMappingModal.tsx';
import OAuthProviderMappingRow from './OAuthProviderMappingRow.tsx';

export default function AdminOAuthProviderMappings({
  oauthProvider,
}: {
  oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
}) {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: mappings,
    loading,
    error,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.oAuthProviders.mappings(oauthProvider.uuid),
    fetcher: (page) => getOAuthProviderMappings(oauthProvider.uuid, page),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.oAuthProviders.tabs.mappings.page.title', {})}
      titleOrder={2}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('common.button.add', {})}
        </Button>
      }
    >
      <OAuthProviderMappingModal
        oauthProvider={oauthProvider}
        opened={openModal === 'add'}
        onClose={() => setOpenModal(null)}
        onSaved={() => refetch()}
      />

      <Table
        columns={adminOAuthProviderMappingsTableColumns()}
        loading={loading}
        error={error}
        pagination={mappings}
        onPageSelect={setPage}
      >
        {mappings?.data.map((mapping) => (
          <OAuthProviderMappingRow
            key={mapping.uuid}
            oauthProvider={oauthProvider}
            mapping={mapping}
            onChanged={() => refetch()}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
