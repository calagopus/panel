import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router';
import { z } from 'zod';
import getLocations from '@/api/admin/locations/getLocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import LocationCreateOrUpdateModal from '@/pages/admin/locations/modals/LocationCreateOrUpdateModal.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminTableSelection } from '@/plugins/selection/useAdminTableSelection.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminPermissionGuard from '@/routers/guards/AdminPermissionGuard.tsx';
import NodeActionBar from './NodeActionBar.tsx';
import NodeCreateOrUpdate from './NodeCreateOrUpdate.tsx';
import NodeRow from './NodeRow.tsx';
import NodeView from './NodeView.tsx';

function NodesContainer() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const [locationModalDismissed, setLocationModalDismissed] = useState(false);

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

  const {
    selected: selectedNodes,
    setSelected: setSelectedNodes,
    toggle: toggleNode,
    selectionAreaProps,
  } = useAdminTableSelection<z.infer<typeof adminNodeSchema>>({ items: nodes?.data });

  const { data: locationsProbe } = useResource({
    queryKey: [...queryKeys.admin.locations.all(), 'probe'],
    queryFn: () => getLocations(1),
    silent: true,
  });
  const showLocationModal = !locationModalDismissed && locationsProbe !== undefined && locationsProbe.data.length === 0;

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
        registry={window.extensionContext.extensionRegistry.pages.admin.nodes.container}
      >
        <NodeActionBar selectedNodes={selectedNodes} setSelectedNodes={setSelectedNodes} />

        <SelectionArea {...selectionAreaProps}>
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
                    onSelectionChange={(selected) => toggleNode(node, selected)}
                  />
                )}
              </SelectionArea.Selectable>
            ))}
          </Table>
        </SelectionArea>
      </AdminContentContainer>

      <LocationCreateOrUpdateModal
        opened={showLocationModal}
        onClose={() => setLocationModalDismissed(true)}
        onLocationCreated={() => setLocationModalDismissed(true)}
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
