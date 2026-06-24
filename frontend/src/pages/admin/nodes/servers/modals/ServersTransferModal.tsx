import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import postTransfers from '@/api/admin/nodes/servers/postTransfers.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { compressionLevelLabelMapping, transferArchiveFormatLabelMapping } from '@/lib/enums.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { transferArchiveFormat } from '@/lib/schemas/generic.ts';
import { compressionLevel as compressionLevelEnum } from '@/lib/schemas/server/files.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServersTransferModal({
  contextNode,
  servers,
  clearSelected,
  ...props
}: ModalProps & {
  contextNode: z.infer<typeof adminNodeSchema>;
  servers: ObjectSet<z.infer<typeof adminServerSchema>, 'uuid'>;
  clearSelected: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [openModal, setOpenModal] = useState<'confirm' | null>(null);
  const [selectedNodeUuid, setSelectedNodeUuid] = useState<string | null>(null);
  const [allocationMode, setAllocationMode] = useState<
    'none' | 'random_primary' | 'random_all' | 'egg_config_deployment' | 'egg_config_self_assign_range'
  >('random_all');
  const [transferBackups, setTransferBackups] = useState(false);
  const [deleteSourceBackups, setDeleteSourceBackups] = useState(false);
  const [archiveFormat, setArchiveFormat] = useState<z.infer<typeof transferArchiveFormat>>('tar_zstd');
  const [compressionLevel, setCompressionLevel] = useState<z.infer<typeof compressionLevelEnum>>('good_speed');
  const [multiplexChannels, setMultiplexChannels] = useState(0);

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
  });

  const closeAll = () => {
    props.onClose();
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
        addToast(
          t('pages.admin.nodes.tabs.servers.page.modal.transfer.toast.started', {
            servers: tItem('server', affected),
          }),
          'success',
        );
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
        title={t('pages.admin.nodes.tabs.servers.page.modal.transfer.confirm.title', {})}
        confirm={t('common.button.transfer', {})}
        onConfirmed={doTransfer}
      >
        {t('pages.admin.nodes.tabs.servers.page.modal.transfer.confirm.content', {
          count: servers.size,
          from: contextNode.name,
          to: nodes.items.find((n) => n.uuid === selectedNodeUuid)?.name ?? '',
        }).md()}
      </ConfirmationModal>

      <Modal
        title={t('pages.admin.nodes.tabs.servers.page.modal.transfer.title', {})}
        {...props}
        opened={props.opened && !openModal}
      >
        <Stack>
          <Select
            withAsterisk
            label={t('common.form.node', {})}
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
            label={t('pages.admin.nodes.tabs.servers.page.modal.transfer.form.allocationMode', {})}
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
                label: t('pages.admin.nodes.tabs.servers.page.modal.transfer.enum.allocationMode.none', {}),
              },
              {
                value: 'random_primary',
                label: t('pages.admin.nodes.tabs.servers.page.modal.transfer.enum.allocationMode.randomPrimary', {}),
              },
              {
                value: 'random_all',
                label: t('pages.admin.nodes.tabs.servers.page.modal.transfer.enum.allocationMode.randomAll', {}),
              },
              {
                value: 'egg_config_deployment',
                label: t(
                  'pages.admin.nodes.tabs.servers.page.modal.transfer.enum.allocationMode.eggConfigDeployment',
                  {},
                ),
              },
              {
                value: 'egg_config_self_assign_range',
                label: t(
                  'pages.admin.nodes.tabs.servers.page.modal.transfer.enum.allocationMode.eggConfigSelfAssignRange',
                  {},
                ),
              },
            ]}
          />

          <Switch
            label={t('pages.admin.nodes.tabs.servers.page.modal.transfer.form.transferBackups', {})}
            description={t('pages.admin.nodes.tabs.servers.page.modal.transfer.form.transferBackupsDescription', {})}
            checked={transferBackups}
            onChange={(e) => setTransferBackups(e.target.checked)}
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
            description={t('common.form.multiplexChannelsDescription', {})}
            min={0}
            value={multiplexChannels}
            onChange={(value) => setMultiplexChannels(Number(value) || 0)}
          />
        </Stack>

        <ModalFooter>
          <Button color='blue' onClick={() => setOpenModal('confirm')} disabled={!selectedNodeUuid}>
            {t('common.button.transfer', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
