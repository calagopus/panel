import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getMounts from '@/api/admin/mounts/getMounts.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { mountTableColumns } from '@/lib/tableColumns.ts';
import MountView from '@/pages/admin/mounts/MountView.tsx';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import MountCreateOrUpdate from './MountCreateOrUpdate.tsx';
import MountRow from './MountRow.tsx';

function MountsContainer() {
  const navigate = useNavigate();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.mounts.all(),
    fetcher: getMounts,
  });

  const mounts = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminContentContainer
      title='Mounts'
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='mounts.create'>
          <Button
            onClick={() => navigate('/admin/mounts/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            Create
          </Button>
        </AdminCan>
      }
    >
      <Table columns={mountTableColumns} loading={loading} pagination={mounts} onPageSelect={setPage}>
        {mounts.data.map((m) => (
          <MountRow key={m.uuid} mount={m} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminMounts() {
  return (
    <Routes>
      <Route path='/' element={<MountsContainer />} />
      <Route path='/:id/*' element={<MountView />} />
      <Route element={<AdminPermissionGuard permission='mounts.create' />}>
        <Route path='/new' element={<MountCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
