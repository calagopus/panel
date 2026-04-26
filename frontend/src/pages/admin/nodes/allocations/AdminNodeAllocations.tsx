import { faCheckDouble, faPlus, faX } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { MouseEvent as ReactMouseEvent, Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import getNodeAllocations from '@/api/admin/nodes/allocations/getNodeAllocations.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Select from '@/elements/input/Select.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Table from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeAllocationSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeAllocationTableColumns } from '@/lib/tableColumns.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useAdminStore } from '@/stores/admin.tsx';
import AllocationActionBar from './AllocationActionBar.tsx';
import NodeAllocationsCreateModal from './modals/NodeAllocationsCreateModal.tsx';
import NodeAllocationRow from './NodeAllocationRow.tsx';

export default function AdminNodeAllocations({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { selectedNodeAllocations, setSelectedNodeAllocations } = useAdminStore();

  const [openModal, setOpenModal] = useState<'create' | null>(null);
  const [ipFilter, setIpFilter] = useState('');
  const [portFilter, setPortFilter] = useState('');
  const selectedNodeAllocationsPreviousRef = useRef(selectedNodeAllocations.values());

  const { data, loading, search, setSearch, setPage, refetch } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.nodes.allocations(node.uuid),
    fetcher: (page, generalSearch) => {
      const finalSearch = buildSearch(generalSearch || '', ipFilter, portFilter);
      return getNodeAllocations(node.uuid, page, finalSearch);
    },
    deps: [ipFilter, portFilter, node.uuid],
  });

  const nodeAllocations = (data ?? getEmptyPaginationSet()) as NonNullable<typeof data>;

  const uniqueIps = useMemo(() => {
    const ips = new Set<string>();
    nodeAllocations.data.forEach((alloc) => ips.add(alloc.ip));
    return Array.from(ips)
      .sort()
      .map((ip) => ({ label: ip, value: ip }));
  }, [nodeAllocations.data]);

  const uniquePorts = useMemo(() => {
    const ports = new Set<string>();
    nodeAllocations.data.forEach((alloc) => ports.add(alloc.port.toString()));
    return Array.from(ports)
      .sort((a, b) => Number(a) - Number(b))
      .map((port) => ({ label: port, value: port }));
  }, [nodeAllocations.data]);

  const buildSearch = useCallback((generalSearch: string, ip: string, port: string) => {
    const parts: string[] = [];
    if (generalSearch) parts.push(generalSearch);
    if (ip) parts.push(ip);
    if (port) parts.push(port);
    return parts.length > 0 ? parts.join(':') : undefined;
  }, []);

  useEffect(() => {
    refetch();
  }, [ipFilter, portFilter]);

  const onSelectedStart = useCallback(
    (event: ReactMouseEvent | MouseEvent) => {
      selectedNodeAllocationsPreviousRef.current = event.shiftKey ? selectedNodeAllocations.values() : [];
    },
    [selectedNodeAllocations],
  );

  const onSelected = useCallback((selected: z.infer<typeof adminNodeAllocationSchema>[]) => {
    setSelectedNodeAllocations([...selectedNodeAllocationsPreviousRef.current, ...selected]);
  }, []);

  useEffect(() => {
    setSelectedNodeAllocations([]);
  }, []);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'a',
        modifiers: ['ctrlOrMeta'],
        callback: () => setSelectedNodeAllocations(nodeAllocations.data),
      },
      {
        key: 'Escape',
        callback: () => setSelectedNodeAllocations([]),
      },
    ],
    deps: [nodeAllocations.data],
  });

  const handleSelectAll = useCallback(() => {
    setSelectedNodeAllocations(nodeAllocations.data);
  }, [nodeAllocations.data]);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeAllocations([]);
  }, []);

  return (
    <AdminSubContentContainer
      title='Node Allocations'
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      contentRight={
        <Group gap='xs'>
          <Select
            placeholder='IP'
            value={ipFilter || null}
            onChange={(value) => setIpFilter(value || '')}
            data={uniqueIps}
            searchable
            clearable
            allowDeselect
            w={120}
          />
          <Select
            placeholder='Port'
            value={portFilter || null}
            onChange={(value) => setPortFilter(value || '')}
            data={uniquePorts}
            searchable
            clearable
            allowDeselect
            w={100}
          />
          <Tooltip label='Select All'>
            <ActionIcon variant='subtle' onClick={handleSelectAll} color='gray'>
              <FontAwesomeIcon icon={faCheckDouble} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label='Clear Selection'>
            <ActionIcon
              variant='subtle'
              onClick={handleClearSelection}
              disabled={selectedNodeAllocations.size === 0}
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
            Create
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

      <AllocationActionBar node={node} loadAllocations={refetch} />

      <SelectionArea onSelectedStart={onSelectedStart} onSelected={onSelected} disabled={!!openModal}>
        <Table
          columns={nodeAllocationTableColumns}
          loading={loading}
          pagination={nodeAllocations}
          onPageSelect={setPage}
          allowSelect={false}
        >
          {nodeAllocations.data.map((allocation) => (
            <SelectionArea.Selectable key={allocation.uuid} item={allocation}>
              {(innerRef: Ref<HTMLElement>) => (
                <NodeAllocationRow
                  key={allocation.uuid}
                  allocation={allocation}
                  ref={innerRef as Ref<HTMLTableRowElement>}
                />
              )}
            </SelectionArea.Selectable>
          ))}
        </Table>
      </SelectionArea>
    </AdminSubContentContainer>
  );
}
