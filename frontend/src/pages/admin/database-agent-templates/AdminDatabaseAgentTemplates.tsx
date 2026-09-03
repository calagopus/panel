import { faPlus, faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import createDatabaseAgentTemplate from '@/api/admin/database-agent-templates/createDatabaseAgentTemplate.ts';
import getDatabaseAgentTemplates from '@/api/admin/database-agent-templates/getDatabaseAgentTemplates.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ImportOverlay from '@/elements/ImportOverlay.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentTemplateCreateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { databaseAgentTemplateTableColumns } from '@/lib/tableColumns.ts';
import { useResourceImport } from '@/plugins/import/useResourceImport.tsx';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import DatabaseAgentTemplateCreateOrUpdate from './DatabaseAgentTemplateCreateOrUpdate.tsx';
import DatabaseAgentTemplateRow from './DatabaseAgentTemplateRow.tsx';
import DatabaseAgentTemplateView from './DatabaseAgentTemplateView.tsx';

function DatabaseAgentTemplatesContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const canCreate = useAdminCan('database-agent-templates.create');

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

  const { isDragging, openFilePicker, fileInput } = useResourceImport({
    schema: adminDatabaseAgentTemplateCreateSchema,
    create: createDatabaseAgentTemplate,
    onImported: refetch,
    formatParseError: (error) => t('pages.admin.databaseAgentTemplates.toast.parseFailed', { error }),
    importedMessage: t('pages.admin.databaseAgentTemplates.toast.imported', {}),
    enabled: canCreate,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.databaseAgentTemplates.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentTemplates.container}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='database-agent-templates.create'>
          <Button onClick={openFilePicker} color='blue'>
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

          {fileInput}
        </AdminCan>
      }
    >
      <ImportOverlay
        visible={isDragging}
        title={t('pages.admin.databaseAgentTemplates.dropzone.title', {})}
        subtitle={t('pages.admin.databaseAgentTemplates.dropzone.subtitle', {})}
      />

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
