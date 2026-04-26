import { ModalProps, Stack } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getAvailableNodeAllocations from '@/api/admin/nodes/allocations/getAvailableNodeAllocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import postTransfer from '@/api/admin/servers/postTransfer.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import getBackups from '@/api/server/backups/getBackups.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { archiveFormatLabelMapping, compressionLevelLabelMapping } from '@/lib/enums.ts';
import { NODE_AIO_UUID } from '@/lib/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeAllocationSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import {
  archiveFormat as archiveFormatEnum,
  compressionLevel as compressionLevelEnum,
} from '@/lib/schemas/server/files.ts';
import { formatAllocation } from '@/lib/server.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function ServerTransferModal({
  server,
  opened,
  onClose,
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [openModal, setOpenModal] = useState<'confirm' | null>(null);
  const [selectedNodeUuid, setSelectedNodeUuid] = useState<string | null>(null);
  const [selectedPrimaryAllocationUuid, setSelectedPrimaryAllocationUuid] = useState<string | null>(null);
  const [selectedAllocationUuids, setSelectedAllocationUuids] = useState<string[]>([]);
  const [selectedBackupUuids, setSelectedBackupsUuids] = useState<string[]>([]);
  const [deleteSourceBackups, setDeleteSourceBackups] = useState(false);
  const [archiveFormat, setArchiveFormat] = useState<z.infer<typeof archiveFormatEnum>>('tar_lz4');
  const [compressionLevel, setCompressionLevel] = useState<z.infer<typeof compressionLevelEnum>>('good_compression');
  const [multiplexChannels, setMultiplexChannels] = useState(0);

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
  });
  const availablePrimaryAllocations = useSearchableResource<z.infer<typeof adminNodeAllocationSchema>>({
    queryKey: selectedNodeUuid
      ? queryKeys.admin.nodes.allocations(selectedNodeUuid)
      : ['admin', 'nodes', 'primary-allocations'],
    fetcher: (search) =>
      selectedNodeUuid
        ? getAvailableNodeAllocations(selectedNodeUuid, 1, search)
        : Promise.resolve(getEmptyPaginationSet()),
    deps: [selectedNodeUuid],
  });
  const availableAllocations = useSearchableResource<z.infer<typeof adminNodeAllocationSchema>>({
    queryKey: selectedNodeUuid
      ? queryKeys.admin.nodes.allocations(selectedNodeUuid)
      : ['admin', 'nodes', 'allocations'],
    fetcher: (search) =>
      selectedNodeUuid
        ? getAvailableNodeAllocations(selectedNodeUuid, 1, search)
        : Promise.resolve(getEmptyPaginationSet()),
    deps: [selectedNodeUuid],
  });
  const backups = useSearchableResource<z.infer<typeof serverBackupSchema>>({
    queryKey: queryKeys.admin.servers.backups(server.uuid),
    fetcher: (search) => getBackups(server.uuid, 1, search),
    canRequest: opened,
  });

  const closeAll = () => {
    onClose();
    setOpenModal(null);
  };

  const doTransfer = async () => {
    await postTransfer(server.uuid, {
      nodeUuid: selectedNodeUuid!,
      allocationUuid: selectedPrimaryAllocationUuid,
      allocationUuids: selectedAllocationUuids,
      backups: selectedBackupUuids,
      deleteSourceBackups,
      archiveFormat,
      compressionLevel,
      multiplexChannels,
    })
      .then(() => {
        addToast('Server transfer started.', 'success');
        closeAll();
        navigate(`/server/${server.uuidShort}`);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'confirm'}
        onClose={closeAll}
        title='Confirm Server Transfer'
        confirm='Transfer'
        onConfirmed={doTransfer}
      >
        {selectedBackupUuids.length < backups.items.length && (
          <Alert color='yellow' mb='md'>
            You have not selected all backups to transfer, the remaining backups will become partially detached if the
            transfer completes successfully.
          </Alert>
        )}
        Are you sure you want to transfer <Code>{server.name}</Code> from <Code>{server.node.name}</Code> to{' '}
        <Code>{nodes.items.find((node) => node.uuid === selectedNodeUuid)?.name}</Code>?
      </ConfirmationModal>

      <Modal title='Server Transfer' onClose={onClose} opened={opened && !openModal}>
        <Stack>
          <Select
            withAsterisk
            label='Node'
            placeholder='Node'
            value={selectedNodeUuid || ''}
            onChange={(value) => setSelectedNodeUuid(value)}
            data={nodes.items
              .filter((node) => node.uuid !== server.node.uuid)
              .map((node) => ({
                label: node.name,
                value: node.uuid,
              }))}
            searchable
            searchValue={nodes.search}
            onSearchChange={nodes.setSearch}
            loading={nodes.loading}
          />

          <Select
            label='Primary Allocation'
            placeholder='Primary Allocation'
            value={selectedPrimaryAllocationUuid}
            disabled={!selectedNodeUuid}
            onChange={(value) => setSelectedPrimaryAllocationUuid(value)}
            data={availableAllocations.items
              .filter((alloc) => !selectedAllocationUuids.includes(alloc.uuid))
              .map((alloc) => ({
                label: formatAllocation(alloc),
                value: alloc.uuid,
              }))}
            searchable
            searchValue={availablePrimaryAllocations.search}
            onSearchChange={availablePrimaryAllocations.setSearch}
            allowDeselect
            loading={availablePrimaryAllocations.loading}
          />

          <MultiSelect
            label='Additional Allocations'
            placeholder='Additional Allocations'
            value={selectedAllocationUuids}
            disabled={!selectedNodeUuid}
            onChange={(value) => setSelectedAllocationUuids(value)}
            data={availableAllocations.items
              .filter((alloc) => alloc.uuid !== selectedPrimaryAllocationUuid)
              .map((alloc) => ({
                label: formatAllocation(alloc),
                value: alloc.uuid,
              }))}
            searchable
            searchValue={availableAllocations.search}
            onSearchChange={availableAllocations.setSearch}
            loading={availableAllocations.loading}
          />

          <MultiSelect
            label='Backups to transfer'
            placeholder='Backups to transfer'
            value={selectedBackupUuids}
            onChange={(value) => setSelectedBackupsUuids(value)}
            data={backups.items.map((backup) => ({
              label: backup.name,
              value: backup.uuid,
            }))}
            searchable
            searchValue={backups.search}
            onSearchChange={backups.setSearch}
            loading={backups.loading}
          />

          <Switch
            label='Delete source backups'
            description='Deletes the transferred backups on the source node once transfer finishes'
            checked={deleteSourceBackups}
            onChange={(e) => setDeleteSourceBackups(e.target.checked)}
          />

          <Select
            withAsterisk
            label='Archive Format'
            value={archiveFormat}
            onChange={(value) => setArchiveFormat(value as z.infer<typeof archiveFormatEnum>)}
            data={Object.entries(archiveFormatLabelMapping)
              .filter(([value]) => !['zip', 'seven_zip'].includes(value))
              .map(([value, label]) => ({
                value,
                label,
              }))}
          />

          <Select
            withAsterisk
            label='Compression Level'
            value={compressionLevel}
            onChange={(value) => setCompressionLevel(value as z.infer<typeof compressionLevelEnum>)}
            disabled={archiveFormat === 'tar'}
            data={Object.entries(compressionLevelLabelMapping).map(([value, label]) => ({
              value,
              label,
            }))}
          />

          <NumberInput
            withAsterisk
            label='Multiplex Channels'
            placeholder='Multiplex Channels'
            description='Add additional HTTP connections (and therefore also threads) for transfering split archives, total streams is 1 + multiplex channels'
            min={0}
            value={multiplexChannels}
            onChange={(value) => setMultiplexChannels(Number(value) || 0)}
          />
        </Stack>

        <ModalFooter>
          <ConditionalTooltip
            enabled={selectedNodeUuid === NODE_AIO_UUID}
            label='Transfers to the All-In-One node are not supported'
          >
            <Button
              color='blue'
              onClick={() => setOpenModal('confirm')}
              disabled={!selectedNodeUuid || selectedNodeUuid === NODE_AIO_UUID}
            >
              Transfer
            </Button>
          </ConditionalTooltip>
        </ModalFooter>
      </Modal>
    </>
  );
}
