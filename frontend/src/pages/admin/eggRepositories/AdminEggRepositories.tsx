import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Route, Routes, useNavigate } from 'react-router';
import getEggRepositories from '@/api/admin/egg-repositories/getEggRepositories.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { eggRepositoryTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import EggRepositoryCreateOrUpdate from './EggRepositoryCreateOrUpdate.tsx';
import EggRepositoryRow from './EggRepositoryRow.tsx';
import EggRepositoryView from './EggRepositoryView.tsx';

function EggRepositoriesContainer() {
  const navigate = useNavigate();

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.eggRepositories.all(),
    fetcher: getEggRepositories,
  });

  const eggRepositories = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  return (
    <AdminContentContainer
      title='Egg Repositories'
      search={search}
      setSearch={setSearch}
      contentRight={
        <AdminCan action='egg-repositories.create'>
          <Button
            onClick={() => navigate('/admin/egg-repositories/new')}
            color='blue'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            Create
          </Button>
        </AdminCan>
      }
    >
      <Table columns={eggRepositoryTableColumns} loading={loading} pagination={eggRepositories} onPageSelect={setPage}>
        {eggRepositories.data.map((eggRepository) => (
          <EggRepositoryRow key={eggRepository.uuid} eggRepository={eggRepository} />
        ))}
      </Table>
    </AdminContentContainer>
  );
}

export default function AdminNests() {
  return (
    <Routes>
      <Route path='/' element={<EggRepositoriesContainer />} />
      <Route path='/:eggRepositoryId/*' element={<EggRepositoryView />} />
      <Route element={<AdminPermissionGuard permission='egg-repositories.create' />}>
        <Route path='/new' element={<EggRepositoryCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
