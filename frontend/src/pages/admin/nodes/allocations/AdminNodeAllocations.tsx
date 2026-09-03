import { faCheckDouble, faPlus, faX } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import getNodeAllocationIps from '@/api/admin/nodes/allocations/getNodeAllocationIps.ts';
import getNodeAllocations from '@/api/admin/nodes/allocations/getNodeAllocations.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Group from '@/elements/layout/Group.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminNodeAllocationFilterSchema,
  adminNodeAllocationSchema,
  adminNodeSchema,
} from '@/lib/schemas/admin/nodes.ts';
import { nodeAllocationTableColumns } from '@/lib/tableColumns.ts';
import { useKeyboardShortcuts } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useSelectionArea } from '@/plugins/selection/useSelectionArea.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AllocationActionBar from './AllocationActionBar.tsx';
import NodeAllocationsCreateModal from './modals/NodeAllocationsCreateModal.tsx';
import NodeAllocationRow from './NodeAllocationRow.tsx';

export default function AdminNodeAllocations({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();

  const [selectedNodeAllocations, setSelectedNodeAllocationsState] = useState(
    () => new ObjectSet<z.infer<typeof adminNodeAllocationSchema>, 'uuid'>('uuid'),
  );

  const setSelectedNodeAllocations = useCallback((allocations: z.infer<typeof adminNodeAllocationSchema>[]) => {
    setSelectedNodeAllocationsState(new ObjectSet('uuid', allocations));
  }, []);

  const addSelectedNodeAllocation = useCallback((allocation: z.infer<typeof adminNodeAllocationSchema>) => {
    setSelectedNodeAllocationsState((prev) => {
      const next = new ObjectSet('uuid', prev.values());
      next.add(allocation);
      return next;
    });
  }, []);

  const removeSelectedNodeAllocation = useCallback((allocation: z.infer<typeof adminNodeAllocationSchema>) => {
    setSelectedNodeAllocationsState((prev) => {
      const next = new ObjectSet('uuid', prev.values());
      next.delete(allocation);
      return next;
    });
  }, []);

  const [openModal, setOpenModal] = useState<'create' | null>(null);
  const [ipFilter, setIpFilter] = useState<string | null>(null);
  const [portFrom, setPortFrom] = useState<string | number>('');
  const [portTo, setPortTo] = useState<string | number>('');
  const [assignedFilter, setAssignedFilter] = useState<string | null>(null);
  const [selectedAllMatching, setSelectedAllMatching] = useState(false);

  const buildFilter = useCallback(
    (search: string): z.infer<typeof adminNodeAllocationFilterSchema> => ({
      search: search || null,
      ip: ipFilter,
      portFrom: portFrom === '' ? null : Number(portFrom),
      portTo: portTo === '' ? null : Number(portTo),
      assigned: assignedFilter === null ? null : assignedFilter === 'assigned',
    }),
    [ipFilter, portFrom, portTo, assignedFilter],
  );

  const {
    data: nodeAllocations,
    loading,
    error,
    search,
    debouncedSearch,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.allocations(node.uuid),
    fetcher: (page, search) => getNodeAllocations(node.uuid, page, buildFilter(search)),
    deps: [node.uuid, ipFilter, portFrom, portTo, assignedFilter],
  });

  const filter = useMemo(() => buildFilter(debouncedSearch), [buildFilter, debouncedSearch]);

  const filterIsEmpty = useMemo(() => Object.values(filter).every((value) => value === null), [filter]);

  const { data: nodeAllocationIps } = useResource({
    queryKey: queryKeys.admin.nodes.allocationIps(node.uuid),
    queryFn: () => getNodeAllocationIps(node.uuid),
  });

  const ipOptions = useMemo(
    () => (nodeAllocationIps ?? []).map((ip) => ({ label: ip, value: ip })),
    [nodeAllocationIps],
  );

  const { onSelectedStart, onSelected } = useSelectionArea({
    identify: (allocation) => allocation.uuid,
    getSelected: () => selectedNodeAllocations.values(),
    setSelected: setSelectedNodeAllocations,
  });

  const handleClearSelection = useCallback(() => {
    setSelectedNodeAllocations([]);
    setSelectedAllMatching(false);
  }, []);

  useEffect(() => {
    setSelectedAllMatching(false);
  }, [filter]);

  const handleSelectAll = useCallback(() => {
    setSelectedNodeAllocations([]);
    setSelectedAllMatching(true);
  }, []);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: handleSelectAll,
      },
      {
        key: 'Escape',
        callback: handleClearSelection,
      },
    ],
    deps: [nodeAllocations?.data],
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.allocations.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.allocations.subContainer}
      registryProps={{ node }}
      contentRight={
        <Group gap='xs'>
          <Select
            placeholder={t('common.table.columns.ip', {})}
            value={ipFilter}
            onChange={setIpFilter}
            data={ipOptions}
            searchable
            clearable
            allowDeselect
            w={140}
          />
          <NumberInput
            placeholder={t('pages.admin.nodes.tabs.allocations.page.form.portFrom', {})}
            value={portFrom}
            onChange={setPortFrom}
            min={1}
            max={65535}
            w={100}
          />
          <NumberInput
            placeholder={t('pages.admin.nodes.tabs.allocations.page.form.portTo', {})}
            value={portTo}
            onChange={setPortTo}
            min={1}
            max={65535}
            w={100}
          />
          <Select
            placeholder={t('pages.admin.nodes.tabs.allocations.page.form.assigned', {})}
            value={assignedFilter}
            onChange={setAssignedFilter}
            data={[
              { label: t('pages.admin.nodes.tabs.allocations.page.form.assignedOnly', {}), value: 'assigned' },
              { label: t('pages.admin.nodes.tabs.allocations.page.form.unassignedOnly', {}), value: 'unassigned' },
            ]}
            clearable
            allowDeselect
            w={140}
          />
          <Tooltip
            label={t('pages.admin.nodes.tabs.allocations.page.tooltip.selectAllMatching', {
              count: nodeAllocations?.total ?? 0,
            })}
          >
            <ActionIcon
              variant='subtle'
              onClick={handleSelectAll}
              disabled={selectedAllMatching || !nodeAllocations?.total}
              color='gray'
            >
              <FontAwesomeIcon icon={faCheckDouble} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('pages.admin.nodes.tabs.allocations.page.tooltip.clearSelection', {})}>
            <ActionIcon
              variant='subtle'
              onClick={handleClearSelection}
              disabled={selectedNodeAllocations.size === 0 && !selectedAllMatching}
              color='gray'
            >
              <FontAwesomeIcon icon={faX} />
            </ActionIcon>
          </Tooltip>
          <Button
            onClick={() => setOpenModal('create')}
            color='blue'
            size='sm'
            leftSection={<FontAwesomeIcon icon={faPlus} />}
          >
            {t('common.button.create', {})}
          </Button>
        </Group>
      }
    >
      <NodeAllocationsCreateModal
        node={node}
        loadAllocations={refetch}
        opened={openModal === 'create'}
        onClose={() => setOpenModal(null)}
      />

      <AllocationActionBar
        node={node}
        loadAllocations={refetch}
        selectedNodeAllocations={selectedNodeAllocations}
        clearSelection={handleClearSelection}
        filter={filter}
        filterIsEmpty={filterIsEmpty}
        matchingTotal={nodeAllocations?.total ?? 0}
        selectedAllMatching={selectedAllMatching}
      />

      <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected} disabled={!!openModal}>
        <Table
          columns={nodeAllocationTableColumns()}
          loading={loading}
          error={error}
          pagination={nodeAllocations}
          onPageSelect={setPage}
          allowSelect={false}
        >
          {nodeAllocations?.data.map((allocation) => (
            <SelectionArea.Selectable key={allocation.uuid} item={allocation}>
              {(innerRef: Ref<HTMLElement>) => (
                <NodeAllocationRow
                  key={allocation.uuid}
                  allocation={allocation}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                  selectedNodeAllocations={selectedNodeAllocations}
                  selectedAllMatching={selectedAllMatching}
                  addSelectedNodeAllocation={addSelectedNodeAllocation}
                  removeSelectedNodeAllocation={removeSelectedNodeAllocation}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AdminSubContentContainer>
  );
}
