import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getAvailableNodeAllocations from '@/api/admin/nodes/allocations/getAvailableNodeAllocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import getServerBackups from '@/api/admin/servers/backups/getServerBackups.ts';
import postTransfer from '@/api/admin/servers/postTransfer.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { compressionLevelLabelMapping, transferArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { NODE_AIO_UUID } from '@/lib/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeAllocationSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerBackupSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { transferArchiveFormat } from '@/lib/schemas/generic.ts';
import { compressionLevel as compressionLevelEnum } from '@/lib/schemas/server/files.ts';
import { formatAllocation } from '@/lib/server.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerTransferModal({
  server,
  ...props
}: ModalProps & { server: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [openModal, setOpenModal] = useState<'confirm' | null>(null);
  const [selectedNodeUuid, setSelectedNodeUuid] = useState<string | null>(null);
  const [selectedPrimaryAllocationUuid, setSelectedPrimaryAllocationUuid] = useState<string | null>(null);
  const [selectedAllocationUuids, setSelectedAllocationUuids] = useState<string[]>([]);
  const [selectedBackupUuids, setSelectedBackupsUuids] = useState<string[]>([]);
  const [deleteSourceBackups, setDeleteSourceBackups] = useState(false);
  const [archiveFormat, setArchiveFormat] = useState<z.infer<typeof transferArchiveFormat>>('tar_zstd');
  const [compressionLevel, setCompressionLevel] = useState<z.infer<typeof compressionLevelEnum>>('good_speed');
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
  const backups = useSearchableResource<z.infer<typeof adminServerBackupSchema>>({
    queryKey: queryKeys.admin.servers.backups(server.uuid),
    fetcher: (search) => getServerBackups(server.uuid, 1, search),
    canRequest: props.opened,
  });

  const closeAll = () => {
    props.onClose();
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
        addToast(t('pages.admin.servers.tabs.management.page.transfer.toast.started', {}), 'success');
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
        title={t('pages.admin.servers.tabs.management.page.transfer.modal.confirm.title', {})}
        confirm={t('common.button.transfer', {})}
        onConfirmed={doTransfer}
      >
        {selectedBackupUuids.length < backups.items.length && (
          <Alert color='yellow' mb='md'>
            {t('pages.admin.servers.tabs.management.page.transfer.modal.confirm.alert.notAllBackupsSelected', {})}
          </Alert>
        )}
        {t('pages.admin.servers.tabs.management.page.transfer.modal.confirm.content', {
          name: server.name,
          from: server.node.name,
          to: nodes.items.find((node) => node.uuid === selectedNodeUuid)?.name ?? '',
        }).md()}
      </ConfirmationModal>

      <Modal
        title={t('pages.admin.servers.tabs.management.page.transfer.modal.title', {})}
        {...props}
        opened={props.opened && !openModal}
      >
        <Stack>
          <Select
            withAsterisk
            label={t('common.table.columns.node', {})}
            placeholder={t('common.table.columns.node', {})}
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
            label={t('common.form.primaryAllocation', {})}
            placeholder={t('common.form.primaryAllocation', {})}
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
            label={t('common.form.additionalAllocations', {})}
            placeholder={t('common.form.additionalAllocations', {})}
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
            label={t('pages.admin.servers.tabs.management.page.transfer.modal.form.backupsToTransfer', {})}
            placeholder={t('pages.admin.servers.tabs.management.page.transfer.modal.form.backupsToTransfer', {})}
            value={selectedBackupUuids}
            onChange={(value) => setSelectedBackupsUuids(value)}
            data={backups.items
              .filter((backup) => !backup.isShared)
              .map((backup) => ({
                label: backup.name,
                value: backup.uuid,
              }))}
            searchable
            searchValue={backups.search}
            onSearchChange={backups.setSearch}
            loading={backups.loading}
          />

          <Switch
            label={t('common.form.deleteSourceBackups', {})}
            description={t('common.form.deleteSourceBackupsDescription', {})}
            checked={deleteSourceBackups}
            onChange={(e) => setDeleteSourceBackups(e.target.checked)}
          />

          <Select
            withAsterisk
            label={t('common.form.archiveFormat', {})}
            value={archiveFormat}
            onChange={(value) => setArchiveFormat(value as z.infer<typeof transferArchiveFormat>)}
            data={Object.entries(transferArchiveFormatLabelMapping).map(([value, label]) => ({
              value,
              label,
            }))}
          />

          <Select
            withAsterisk
            label={t('common.form.compressionLevel', {})}
            value={compressionLevel}
            onChange={(value) => setCompressionLevel(value as z.infer<typeof compressionLevelEnum>)}
            disabled={archiveFormat === 'tar' || archiveFormat === 'itaf'}
            data={Object.entries(compressionLevelLabelMapping).map(([value, label]) => ({
              value,
              label: label(),
            }))}
          />

          <NumberInput
            withAsterisk
            label={t('common.form.multiplexChannels', {})}
            placeholder={t('common.form.multiplexChannels', {})}
            description={t('common.form.multiplexChannelsDescription', {})}
            min={0}
            value={multiplexChannels}
            onChange={(value) => setMultiplexChannels(Number(value) || 0)}
          />
        </Stack>

        <ModalFooter>
          <ConditionalTooltip
            enabled={selectedNodeUuid === NODE_AIO_UUID}
            label={t('pages.admin.servers.tabs.management.page.transfer.modal.tooltip.aioNotSupported', {})}
          >
            <Button
              color='blue'
              onClick={() => setOpenModal('confirm')}
              disabled={!selectedNodeUuid || selectedNodeUuid === NODE_AIO_UUID}
            >
              {t('common.button.transfer', {})}
            </Button>
          </ConditionalTooltip>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
