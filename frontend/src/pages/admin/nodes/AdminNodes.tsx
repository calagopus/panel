import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import getLocations from '@/api/admin/locations/getLocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import LocationCreateOrUpdateModal from './LocationCreateOrUpdateModal.tsx';
import NodeCreateOrUpdate from './NodeCreateOrUpdate.tsx';
import NodeRow from './NodeRow.tsx';
import NodeView from './NodeView.tsx';

function NodesContainer() {
  const navigate = useNavigate();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [checkingLocations, setCheckingLocations] = useState(true);

  const { data, loading, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: getNodes,
  });

  const nodes = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  useEffect(() => {
    getLocations(1)
      .then((response) => {
        if (response.data.length === 0) {
          setShowLocationModal(true);
        }
      })
      .finally(() => {
        setCheckingLocations(false);
      });
  }, []);

  const handleLocationCreated = () => {
    setShowLocationModal(false);
  };

  return (
    <>
      <AdminContentContainer
        title='Nodes'
        search={search}
        setSearch={setSearch}
        contentRight={
          <AdminCan action='nodes.create'>
            <Button
              onClick={() => navigate('/admin/nodes/new')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              Create
            </Button>
          </AdminCan>
        }
      >
        <Table columns={nodeTableColumns} loading={loading} pagination={nodes} onPageSelect={setPage}>
          {nodes.data.map((node) => (
            <NodeRow key={node.uuid} node={node} />
          ))}
        </Table>
      </AdminContentContainer>

      <LocationCreateOrUpdateModal
        opened={showLocationModal && !checkingLocations}
        onClose={() => setShowLocationModal(false)}
        onLocationCreated={handleLocationCreated}
      />
    </>
  );
}

export default function AdminNodes() {
  return (
    <Routes>
      <Route path='/' element={<NodesContainer />} />
      <Route path='/:id/*' element={<NodeView />} />
      <Route element={<AdminPermissionGuard permission='nodes.create' />}>
        <Route path='/new' element={<NodeCreateOrUpdate />} />
      </Route>
    </Routes>
  );
}
