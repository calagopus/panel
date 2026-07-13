import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useCallback, useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { z } from 'zod';
import getDatabaseAgentHosts from '@/api/admin/database-agent-hosts/getDatabaseAgentHosts.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { databaseAgentHostTableColumns } from '@/lib/tableColumns.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useSelectionArea } from '@/plugins/useSelectionArea.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import DatabaseAgentHostActionBar from './DatabaseAgentHostActionBar.tsx';
import DatabaseAgentHostCreateOrUpdate from './DatabaseAgentHostCreateOrUpdate.tsx';
import DatabaseAgentHostRow from './DatabaseAgentHostRow.tsx';
import DatabaseAgentHostView from './DatabaseAgentHostView.tsx';

function DatabaseAgentHostsContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const [selectedHosts, setSelectedHosts] = useState(
    new ObjectSet<z.infer<typeof adminDatabaseAgentHostSchema>, 'uuid'>('uuid'),
  );

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

  useEffect(() => {
    setSelectedHosts(new ObjectSet('uuid'));
  }, []);

  const { onSelectedStart, onSelected } = useSelectionArea({
    identify: (host) => host.uuid,
    getSelected: () => selectedHosts.values(),
    setSelected: (hosts) => setSelectedHosts(new ObjectSet('uuid', hosts)),
  });

  const handleHostSelectionChange = useCallback(
    (host: z.infer<typeof adminDatabaseAgentHostSchema>, selected: boolean) => {
      setSelectedHosts((prev) => {
        const next = prev.clone();
        if (selected) {
          next.add(host);
        } else {
          next.delete(host);
        }
        return next;
      });
    },
    [],
  );

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => setSelectedHosts(new ObjectSet('uuid', databaseAgentHosts?.data)),
      },
      {
        key: 'Escape',
        callback: () => setSelectedHosts(new ObjectSet('uuid')),
      },
    ],
    deps: [databaseAgentHosts?.data],
  });

  const columns = ['', ...databaseAgentHostTableColumns()];

  return (
    <AdminContentContainer
      title={t('pages.admin.databaseAgentHosts.title', {})}
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

      <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected}>
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
                  onSelectionChange={(selected) => handleHostSelectionChange(host, selected)}
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
