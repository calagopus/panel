import { faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { load } from 'js-yaml';
import { ChangeEvent, useRef } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { z } from 'zod';
import createOAuthProvider from '@/api/admin/oauth-providers/createOAuthProvider.ts';
import getOAuthProviders from '@/api/admin/oauth-providers/getOAuthProviders.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { parseFromApi } from '@/lib/api-transform.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderUpdateSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { oauthProviderTableColumns } from '@/lib/tableColumns.ts';
import { useImportDragAndDrop } from '@/plugins/useImportDragAndDrop.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import OAuthProviderCreateOrUpdate from './OAuthProviderCreateOrUpdate.tsx';
import OAuthProviderImportOverlay from './OAuthProviderImportOverlay.tsx';
import OAuthProviderRow from './OAuthProviderRow.tsx';
import OAuthProviderView from './OAuthProviderView.tsx';

function OAuthProvidersContainer() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { t } = useTranslations();
  const canCreate = useAdminCan('oauth-providers.create');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleImport = async (file: File) => {
    const text = await file.text().then((t) => t.trim());
    let data: z.infer<typeof adminOAuthProviderUpdateSchema>;
    try {
      const raw = (text.startsWith('{') ? JSON.parse(text) : load(text)) as Record<string, unknown>;
      // Exports and presets from before the login_bypass_two_factor rename only carry the old key.
      raw.login_bypass_two_factor ??= raw.login_bypass_2fa;
      data = parseFromApi(adminOAuthProviderUpdateSchema, {
        ...raw,
        client_id: 'example',
        client_secret: 'example',
      });
    } catch (err) {
      addToast(t('pages.admin.oAuthProviders.toast.parseFailed', { error: String(err) }), 'error');
      return;
    }

    createOAuthProvider(data)
      .then(() => {
        refetch();
        addToast(t('pages.admin.oAuthProviders.toast.imported', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const { isDragging } = useImportDragAndDrop({
    onDrop: (files) => Promise.all(files.map(handleImport)),
    enabled: canCreate,
  });

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    handleImport(file);
  };

  return (
    <AdminContentContainer
      title={t('pages.admin.oAuthProviders.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.admin.oauthProviders.container}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='oauth-providers.create'>
          <Button onClick={() => fileInputRef.current?.click()} color='blue'>
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

          <input
            type='file'
            accept='.json,.yml,.yaml'
            ref={fileInputRef}
            className='hidden'
            onChange={handleFileUpload}
          />
        </AdminCan>
      }
    >
      <OAuthProviderImportOverlay visible={isDragging && canCreate} />

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
