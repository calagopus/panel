import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useCallback, useEffect, useRef, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { z } from 'zod';
import getLocations from '@/api/admin/locations/getLocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import LocationCreateOrUpdateModal from './LocationCreateOrUpdateModal.tsx';
import NodeActionBar from './NodeActionBar.tsx';
import NodeCreateOrUpdate from './NodeCreateOrUpdate.tsx';
import NodeRow from './NodeRow.tsx';
import NodeView from './NodeView.tsx';

function NodesContainer() {
  const navigate = useNavigate();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [checkingLocations, setCheckingLocations] = useState(true);
  const [selectedNodes, setSelectedNodes] = useState(new ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>('uuid'));
  const selectedNodesPreviousRef = useRef<z.infer<typeof adminNodeSchema>[]>([]);

  const {
    data: nodes,
    loading,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: getNodes,
  });

  useEffect(() => {
    setSelectedNodes(new ObjectSet('uuid'));
  }, []);

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

  const onSelectedStart = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      selectedNodesPreviousRef.current = event.shiftKey ? selectedNodes.values() : [];
    },
    [selectedNodes],
  );

  const onSelected = useCallback((selected: z.infer<typeof adminNodeSchema>[]) => {
    setSelectedNodes(new ObjectSet('uuid', [...selectedNodesPreviousRef.current, ...selected]));
  }, []);

  const handleNodeSelectionChange = useCallback((node: z.infer<typeof adminNodeSchema>, selected: boolean) => {
    setSelectedNodes((prev) => {
      const next = new ObjectSet('uuid', prev.values());
      if (selected) {
        next.add(node);
      } else {
        next.delete(node);
      }
      return next;
    });
  }, []);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => setSelectedNodes(new ObjectSet('uuid', nodes?.data)),
      },
      {
        key: 'Escape',
        callback: () => setSelectedNodes(new ObjectSet('uuid')),
      },
    ],
    deps: [nodes?.data],
  });

  const columns = ['', ...nodeTableColumns];

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
        <NodeActionBar selectedNodes={selectedNodes} setSelectedNodes={setSelectedNodes} />

        <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected}>
          <Table columns={columns} loading={loading} pagination={nodes} onPageSelect={setPage} allowSelect={false}>
            {nodes?.data.map((node) => (
              <SelectionArea.Selectable key={node.uuid} item={node}>
                {(innerRef: Ref<HTMLElement>) => (
                  <NodeRow
                    key={node.uuid}
                    node={node}
                    ref={innerRef as Ref<HTMLTableRowElement>}
                    isSelected={selectedNodes.has(node.uuid)}
                    onSelectionChange={(selected) => handleNodeSelectionChange(node, selected)}
                  />
                )}
              </SelectionArea.Selectable>
            ))}
          </Table>
        </SelectionArea>
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
