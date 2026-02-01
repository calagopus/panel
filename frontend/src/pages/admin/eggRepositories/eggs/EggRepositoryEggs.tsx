import { useState } from 'react';
import getEggRepositoryEggs from '@/api/admin/egg-repositories/eggs/getEggRepositoryEggs.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { eggRepositoryEggTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import EggRepositoryEggRow from './EggRepositoryEggRow.tsx';

export default function EggRepositoryEggs({ contextEggRepository }: { contextEggRepository: AdminEggRepository }) {
  const [eggRepositoryEggs, setEggRepositoryEggs] = useState(getEmptyPaginationSet<AdminEggRepositoryEgg>());

  const { loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    fetcher: (page, search) => getEggRepositoryEggs(contextEggRepository.uuid, page, search),
    setStoreData: setEggRepositoryEggs,
  });

  return (
    <AdminSubContentContainer title='Egg Repository Eggs' search={search} setSearch={setSearch} titleOrder={2}>
      <Table
        columns={eggRepositoryEggTableColumns}
        loading={loading}
        pagination={eggRepositoryEggs}
        onPageSelect={setPage}
      >
        {eggRepositoryEggs.data.map((eggRepositoryEgg) => (
          <EggRepositoryEggRow
            key={eggRepositoryEgg.uuid}
            eggRepository={contextEggRepository}
            egg={eggRepositoryEgg}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
