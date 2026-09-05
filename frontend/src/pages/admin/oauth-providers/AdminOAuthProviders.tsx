import { faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import createOAuthProvider from '@/api/admin/oauth-providers/createOAuthProvider.ts';
import getOAuthProviders from '@/api/admin/oauth-providers/getOAuthProviders.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ImportOverlay from '@/elements/ImportOverlay.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderUpdateSchema, oauthProviderSecretFields } from '@/lib/schemas/admin/oauthProviders.ts';
import { oauthProviderTableColumns } from '@/lib/tableColumns.ts';
import { useResourceImport } from '@/plugins/import/useResourceImport.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import OAuthProviderCreateOrUpdate from './OAuthProviderCreateOrUpdate.tsx';
import OAuthProviderRow from './OAuthProviderRow.tsx';
import OAuthProviderView from './OAuthProviderView.tsx';

function OAuthProvidersContainer() {
  const navigate = useNavigate();
  const { t } = useTranslations();
  const canCreate = useAdminCan('oauth-providers.create');

  const {
    data: oauthProviders,
    loading,
    error,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.oAuthProviders.all(),
    fetcher: getOAuthProviders,
  });

  const transformRaw = useCallback(
    (raw: Record<string, unknown>) => ({
      ...raw,
      // Exports and presets from before the login_bypass_two_factor rename only carry the old key.
      login_bypass_two_factor: raw.login_bypass_two_factor ?? raw.login_bypass_2fa,
      ...Object.fromEntries(oauthProviderSecretFields.map((field) => [field, 'example'])),
    }),
    [],
  );

  const { isDragging, openFilePicker, fileInput } = useResourceImport({
    schema: adminOAuthProviderUpdateSchema,
    create: createOAuthProvider,
    onImported: refetch,
    formatParseError: (error) => t('pages.admin.oAuthProviders.toast.parseFailed', { error }),
    importedMessage: t('pages.admin.oAuthProviders.toast.imported', {}),
    enabled: canCreate,
    transformRaw,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.oAuthProviders.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.admin.oauthProviders.container}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='oauth-providers.create'>
          <Button onClick={openFilePicker} color='blue'>
            <FontAwesomeIcon icon={faUpload} className='mr-2' />
            {t('common.button.import', {})}
          </Button>
          <Button
            onClick={() => navigate('/admin/oauth-providers/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>

          {fileInput}
        </AdminCan>
      }
    >
      <ImportOverlay
        visible={isDragging}
        title={t('pages.admin.oAuthProviders.dropzone.title', {})}
        subtitle={t('pages.admin.oAuthProviders.dropzone.subtitle', {})}
      />

      <Table
        columns={oauthProviderTableColumns()}
        loading={loading}
        pagination={oauthProviders}
        onPageSelect={setPage}
        error={error}
      >
        {oauthProviders?.data.map((oauthProvider) => (
          <OAuthProviderRow key={oauthProvider.uuid} oauthProvider={oauthProvider} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminOAuthProviders() {
  return (
    <Routes>
      <Route path='/' element={<OAuthProvidersContainer />} />
      <Route path='/:id/*' element={<OAuthProviderView />} />
      <Route element={<AdminPermissionGuard permission='oauth-providers.create' />}>
        <Route path='/new' element={<OAuthProviderCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
