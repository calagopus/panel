import { ModalProps, Stack } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import postTransfers from '@/api/admin/nodes/servers/postTransfers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal } from '@/elements/modals/Modal.tsx';
import { archiveFormatLabelMapping, compressionLevelLabelMapping } from '@/lib/enums.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import {
  archiveFormat as archiveFormatEnum,
  compressionLevel as compressionLevelEnum,
} from '@/lib/schemas/server/files.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function ServersTransferModal({
  contextNode,
  servers,
  clearSelected,
  opened,
  onClose,
}: ModalProps & {
  contextNode: z.infer<typeof adminNodeSchema>;
  servers: ObjectSet<z.infer<typeof adminServerSchema>, 'uuid'>;
  clearSelected: () => void;
}) {
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [openModal, setOpenModal] = useState<'confirm' | null>(null);
  const [selectedNodeUuid, setSelectedNodeUuid] = useState<string | null>(null);
  const [allocationMode, setAllocationMode] = useState<
    'none' | 'random_primary' | 'random_all' | 'egg_config_deployment' | 'egg_config_self_assign_range'
  >('random_all');
  const [transferBackups, setTransferBackups] = useState(false);
  const [deleteSourceBackups, setDeleteSourceBackups] = useState(false);
  const [archiveFormat, setArchiveFormat] = useState<z.infer<typeof archiveFormatEnum>>('tar_lz4');
  const [compressionLevel, setCompressionLevel] = useState<z.infer<typeof compressionLevelEnum>>('good_compression');
  const [multiplexChannels, setMultiplexChannels] = useState(0);

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
  });

  const closeAll = () => {
    onClose();
    setOpenModal(null);
  };

  const doTransfer = async () => {
    await postTransfers(contextNode.uuid, {
      servers: servers.keys(),
      nodeUuid: selectedNodeUuid!,
      allocationMode,
      transferBackups,
      deleteSourceBackups,
      archiveFormat,
      compressionLevel,
      multiplexChannels,
    })
      .then(({ affected }) => {
        addToast(`${affected} Server transfer${affected === 1 ? '' : 's'} started.`, 'success');
        clearSelected();
        closeAll();
        navigate(`/admin/nodes/${contextNode.uuid}/transfers`);
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
        title='Confirm Server Transfers'
        confirm='Transfer'
        onConfirmed={doTransfer}
      >
        Are you sure you want to transfer <Code>{servers.size}</Code> servers from <Code>{contextNode.name}</Code> to{' '}
        <Code>{nodes.items.find((n) => n.uuid === selectedNodeUuid)?.name}</Code>? This action cannot be undone.
      </ConfirmationModal>

      <Modal title='Transfer Servers' onClose={onClose} opened={opened && !openModal}>
        <Stack>
          <Select
            withAsterisk
            label='Node'
            placeholder='Node'
            value={selectedNodeUuid || ''}
            onChange={(value) => setSelectedNodeUuid(value)}
            data={nodes.items
              .filter((node) => node.uuid !== contextNode.uuid)
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
            withAsterisk
            label='Allocation Mode'
            value={allocationMode}
            onChange={(value) =>
              setAllocationMode(
                value as
                  | 'none'
                  | 'random_primary'
                  | 'random_all'
                  | 'egg_config_deployment'
                  | 'egg_config_self_assign_range',
              )
            }
            data={[
              {
                value: 'none',
                label:
                  'None (scrap all allocations, server will not be automatically assigned new allocations on the destination node)',
              },
              { value: 'random_primary', label: 'Randomize primary allocation (removes additional allocations)' },
              {
                value: 'random_all',
                label: 'Randomize all allocations (recommended to avoid incompatibility issues with destination node)',
              },
              {
                value: 'egg_config_deployment',
                label:
                  'Assign allocations based on Egg deployment configuration (only works if the Egg has a deployment configuration and the destination node has compatible allocations)',
              },
              {
                value: 'egg_config_self_assign_range',
                label:
                  'Self-assign new allocations based on Egg port range (only works if the Egg has a port range and the destination node has compatible allocations)',
              },
            ]}
          />

          <Switch
            label='Transfer backups'
            description='Whether to transfer backups along with the servers'
            checked={transferBackups}
            onChange={(e) => setTransferBackups(e.target.checked)}
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

          <Button color='blue' onClick={() => setOpenModal('confirm')} disabled={!selectedNodeUuid}>
            Transfer
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
