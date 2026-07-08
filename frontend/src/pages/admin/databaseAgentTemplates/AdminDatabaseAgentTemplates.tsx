import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getDatabaseAgentTemplates from '@/api/admin/database-agent-templates/getDatabaseAgentTemplates.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { databaseAgentTemplateTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import DatabaseAgentTemplateCreateOrUpdate from './DatabaseAgentTemplateCreateOrUpdate.tsx';
import DatabaseAgentTemplateRow from './DatabaseAgentTemplateRow.tsx';
import DatabaseAgentTemplateView from './DatabaseAgentTemplateView.tsx';

function DatabaseAgentTemplatesContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const {
    data: databaseAgentTemplates,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseAgentTemplates.all(),
    fetcher: getDatabaseAgentTemplates,
  });

  return (
    <AdminContentContainer
      title={t('pages.admin.databaseAgentTemplates.title', {})}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='database-agent-templates.create'>
          <Button
            onClick={() => navigate('/admin/database-agent-templates/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>
        </AdminCan>
      }
    >
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
