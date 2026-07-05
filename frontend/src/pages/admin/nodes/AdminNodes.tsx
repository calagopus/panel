import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useCallback, useEffect, useState } from 'react';
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
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useSelectionArea } from '@/plugins/useSelectionArea.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import LocationCreateOrUpdateModal from './LocationCreateOrUpdateModal.tsx';
import NodeActionBar from './NodeActionBar.tsx';
import NodeCreateOrUpdate from './NodeCreateOrUpdate.tsx';
import NodeRow from './NodeRow.tsx';
import NodeView from './NodeView.tsx';

function NodesContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [checkingLocations, setCheckingLocations] = useState(true);
  const [selectedNodes, setSelectedNodes] = useState(new ObjectSet<z.infer<typeof adminNodeSchema>, 'uuid'>('uuid'));

  const {
    data: nodes,
    loading,
    error,
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

  const { onSelectedStart, onSelected } = useSelectionArea({
    identify: (node) => node.uuid,
    getSelected: () => selectedNodes.values(),
    setSelected: (nodes) => setSelectedNodes(new ObjectSet('uuid', nodes)),
  });

  const handleNodeSelectionChange = useCallback((node: z.infer<typeof adminNodeSchema>, selected: boolean) => {
    setSelectedNodes((prev) => {
      const next = prev.clone();
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

  const columns = ['', ...nodeTableColumns()];

  return (
    <>
      <AdminContentContainer
        title={t('pages.admin.nodes.title', {})}
        search={search}
        setSearch={setSearch}
        contentRight={
          <AdminCan action='nodes.create'>
            <Button
              onClick={() => navigate('/admin/nodes/new')}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.create', {})}
            </Button>
          </AdminCan>
        }
      >
        <NodeActionBar selectedNodes={selectedNodes} setSelectedNodes={setSelectedNodes} />

        <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected}>
          <Table
            columns={columns}
            loading={loading}
            pagination={nodes}
            onPageSelect={setPage}
            allowSelect={false}
            error={error}
          >
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
