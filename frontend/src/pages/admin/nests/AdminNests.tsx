import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getNests from '@/api/admin/nests/getNests.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { nestTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import NestCreateOrUpdate from './NestCreateOrUpdate.tsx';
import NestRow from './NestRow.tsx';
import NestView from './NestView.tsx';

function NestsContainer() {
  const navigate = useNavigate();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nests.all(),
    fetcher: getNests,
  });

  const nests = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminContentContainer
      title='Nests'
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='nests.create'>
          <Button
            onClick={() => navigate('/admin/nests/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            Create
          </Button>
        </AdminCan>
      }
    >
      <Table columns={nestTableColumns} loading={loading} pagination={nests} onPageSelect={setPage}>
        {nests.data.map((nest) => (
          <NestRow key={nest.uuid} nest={nest} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminNests() {
  return (
    <Routes>
      <Route path='/' element={<NestsContainer />} />
      <Route path='/:nestId/*' element={<NestView />} />
      <Route element={<AdminPermissionGuard permission='nests.create' />}>
        <Route path='/new' element={<NestCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
