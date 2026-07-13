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
      const raw: unknown = text.startsWith('{') ? JSON.parse(text) : load(text);
      data = parseFromApi(adminOAuthProviderUpdateSchema, {
        ...(raw as object),
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
      <OAuthProviderImportOverlay visible={isDragging} />

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
