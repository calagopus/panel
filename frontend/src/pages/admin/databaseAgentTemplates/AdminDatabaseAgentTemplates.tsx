import { faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { load } from 'js-yaml';
import { ChangeEvent, useRef } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { z } from 'zod';
import createDatabaseAgentTemplate from '@/api/admin/database-agent-templates/createDatabaseAgentTemplate.ts';
import getDatabaseAgentTemplates from '@/api/admin/database-agent-templates/getDatabaseAgentTemplates.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { parseFromApi } from '@/lib/api-transform.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentTemplateCreateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { databaseAgentTemplateTableColumns } from '@/lib/tableColumns.ts';
import { useImportDragAndDrop } from '@/plugins/useImportDragAndDrop.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import DatabaseAgentTemplateCreateOrUpdate from './DatabaseAgentTemplateCreateOrUpdate.tsx';
import DatabaseAgentTemplateImportOverlay from './DatabaseAgentTemplateImportOverlay.tsx';
import DatabaseAgentTemplateRow from './DatabaseAgentTemplateRow.tsx';
import DatabaseAgentTemplateView from './DatabaseAgentTemplateView.tsx';

function DatabaseAgentTemplatesContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: databaseAgentTemplates,
    loading,
    error,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseAgentTemplates.all(),
    fetcher: getDatabaseAgentTemplates,
  });

  const handleImport = async (file: File) => {
    const text = await file.text().then((t) => t.trim());
    let data: z.infer<typeof adminDatabaseAgentTemplateCreateSchema>;
    try {
      const raw: unknown = text.startsWith('{') ? JSON.parse(text) : load(text);
      data = parseFromApi(adminDatabaseAgentTemplateCreateSchema, raw);
    } catch (err) {
      addToast(t('pages.admin.databaseAgentTemplates.toast.parseFailed', { error: String(err) }), 'error');
      return;
    }

    createDatabaseAgentTemplate(data)
      .then(() => {
        refetch();
        addToast(t('pages.admin.databaseAgentTemplates.toast.imported', {}), 'success');
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
      title={t('pages.admin.databaseAgentTemplates.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentTemplates.container}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='database-agent-templates.create'>
          <Button onClick={() => fileInputRef.current?.click()} color='blue'>
            <FontAwesomeIcon icon={faUpload} className='mr-2' />
            {t('common.button.import', {})}
          </Button>
          <Button
            onClick={() => navigate('/admin/database-agent-templates/new')}
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
      <DatabaseAgentTemplateImportOverlay visible={isDragging} />

      <Table
        columns={databaseAgentTemplateTableColumns()}
        loading={loading}
        pagination={databaseAgentTemplates}
        onPageSelect={setPage}
        error={error}
      >
        {databaseAgentTemplates?.data.map((template) => (
          <DatabaseAgentTemplateRow key={template.uuid} databaseAgentTemplate={template} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminDatabaseAgentTemplates() {
  return (
    <Routes>
      <Route path='/' element={<DatabaseAgentTemplatesContainer />} />
      <Route path='/:id/*' element={<DatabaseAgentTemplateView />} />
      <Route element={<AdminPermissionGuard permission='database-agent-templates.create' />}>
        <Route path='/new' element={<DatabaseAgentTemplateCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
