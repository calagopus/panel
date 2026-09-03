import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { z } from 'zod';
import getDatabaseAgentHosts from '@/api/admin/database-agent-hosts/getDatabaseAgentHosts.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { databaseAgentHostTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminTableSelection } from '@/plugins/selection/useAdminTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import DatabaseAgentHostActionBar from './DatabaseAgentHostActionBar.tsx';
import DatabaseAgentHostCreateOrUpdate from './DatabaseAgentHostCreateOrUpdate.tsx';
import DatabaseAgentHostRow from './DatabaseAgentHostRow.tsx';
import DatabaseAgentHostView from './DatabaseAgentHostView.tsx';

function DatabaseAgentHostsContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();

  const {
    data: databaseAgentHosts,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.databaseAgentHosts.all(),
    fetcher: getDatabaseAgentHosts,
  });

  const {
    selected: selectedHosts,
    setSelected: setSelectedHosts,
    toggle: toggleHost,
    selectionAreaProps,
  } = useAdminTableSelection<z.infer<typeof adminDatabaseAgentHostSchema>>({ items: databaseAgentHosts?.data });

  const columns = ['', ...databaseAgentHostTableColumns()];

  return (
    <AdminContentContainer
      title={t('pages.admin.databaseAgentHosts.title', {})}
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentHosts.container}
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='database-agent-hosts.create'>
          <Button
            onClick={() => navigate('/admin/database-agent-hosts/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>
        </AdminCan>
      }
    >
      <DatabaseAgentHostActionBar selectedHosts={selectedHosts} setSelectedHosts={setSelectedHosts} />

      <SelectionArea {...selectionAreaProps}>
        <Table
          columns={columns}
          loading={loading}
          pagination={databaseAgentHosts}
          onPageSelect={setPage}
          allowSelect={false}
          error={error}
        >
          {databaseAgentHosts?.data.map((host) => (
            <SelectionArea.Selectable key={host.uuid} item={host}>
              {(innerRef: Ref<HTMLElement>) => (
                <DatabaseAgentHostRow
                  key={host.uuid}
                  databaseAgentHost={host}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  isSelected={selectedHosts.has(host.uuid)}
                  onSelectionChange={(selected) => toggleHost(host, selected)}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AdminContentContainer>
  );
}

export default function AdminDatabaseAgentHosts() {
  return (
    <Routes>
      <Route path='/' element={<DatabaseAgentHostsContainer />} />
      <Route path='/:id/*' element={<DatabaseAgentHostView />} />
      <Route element={<AdminPermissionGuard permission='database-agent-hosts.create' />}>
        <Route path='/new' element={<DatabaseAgentHostCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
