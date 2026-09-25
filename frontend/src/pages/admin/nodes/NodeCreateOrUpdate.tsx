import { faLink, faNetworkWired, faSliders } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import getLocations from '@/api/admin/locations/getLocations.ts';
import createNodeAllocations from '@/api/admin/nodes/allocations/createNodeAllocations.ts';
import createNode from '@/api/admin/nodes/createNode.ts';
import deleteNode from '@/api/admin/nodes/deleteNode.ts';
import pairNode from '@/api/admin/nodes/pairNode.ts';
import resetNodeToken from '@/api/admin/nodes/resetNodeToken.ts';
import updateNode from '@/api/admin/nodes/updateNode.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import NodeAllocationIpInput from '@/elements/input/NodeAllocationIpInput.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { isNodeAIO } from '@/lib/domain/node.ts';
import { resolvePorts } from '@/lib/network/ip.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminNodeSchema, adminNodeUpdateSchema } from '@/lib/schemas/admin/nodes.ts';
import NodePairingStatusAlert from '@/pages/admin/nodes/configuration/NodePairingStatusAlert.tsx';
import NodeDuplicateModal from '@/pages/admin/nodes/modals/NodeDuplicateModal.tsx';
import NodePairingConnect, { NodePairingTarget } from '@/pages/admin/nodes/pairing/NodePairingConnect.tsx';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useNodeOnlineWait } from '@/plugins/nodes/useNodeOnlineWait.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { nodeEmptyFormValues, nodeToFormValues, useNodeFormFields } from './nodeFormValues.tsx';

type NodeFormValues = z.infer<typeof adminNodeUpdateSchema>;

const PAIR_TIMEOUT_MS = 90_000;
const MEMORY_RESERVE_RATIO = 0.9;

const bytesToReservedMib = (bytes: number) => Math.floor((bytes / 1024 / 1024) * MEMORY_RESERVE_RATIO);

export default function NodeCreateOrUpdate({ contextNode }: { contextNode?: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const onlineWait = useNodeOnlineWait();

  const [mode, setMode] = useState<'pair' | 'manual'>('pair');
  const [pairingTarget, setPairingTarget] = useState<NodePairingTarget | null>(null);
  const [allocationIp, setAllocationIp] = useState('');
  const [allocationPorts, setAllocationPorts] = useState<string[]>([]);
  const [remote, setRemote] = useState('');
  const [pairedNodeUuid, setPairedNodeUuid] = useState<string | null>(null);

  const [isValid, setIsValid] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const isAIO = contextNode ? isNodeAIO(contextNode) : false;

  const form = useFormEngine<NodeFormValues>('admin.nodes.createOrUpdate', {
    schema: adminNodeUpdateSchema.unwrap(),
    mode: 'uncontrolled',
    initialValues: nodeEmptyFormValues,
    onValuesChange: (values) => {
      setIsValid(form.isValid());
      setUrlValue(values.url ?? '');
    },
    validateInputOnBlur: true,
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    NodeFormValues,
    z.infer<typeof adminNodeSchema>
  >({
    form,
    createFn: () => createNode(adminNodeUpdateSchema.parse(form.getValues())),
    updateFn: contextNode
      ? () => updateNode(contextNode.uuid, adminNodeUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextNode ? () => deleteNode(contextNode.uuid) : undefined,
    doUpdate: !!contextNode,
    basePath: '/admin/nodes',
    resourceName: t('pages.admin.nodes.resourceName', {}),
  });

  useHydrateForm(form, contextNode, nodeToFormValues, { key: (node) => node.uuid });

  const locations = useSearchableResource<z.infer<typeof adminLocationSchema>>({
    queryKey: queryKeys.admin.locations.all(),
    fetcher: (search) => getLocations(1, search),
    defaultSearchValue: contextNode?.location.name,
  });
  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: contextNode?.backupConfiguration?.name,
  });

  const doResetToken = () => {
    if (!contextNode) return;

    setLoading(true);

    resetNodeToken(contextNode.uuid)
      .then(() => {
        addToast(t('pages.admin.nodes.tabs.general.page.toast.tokenReset', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.token(contextNode.uuid) });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const fields = useNodeFormFields({ locations, backupConfigurations, urlValue, isAIO, contextNode });

  const isPairing = !contextNode && mode === 'pair';

  useEffect(() => {
    if (pairedNodeUuid && onlineWait.status === 'connected') {
      navigate(`/admin/nodes/${pairedNodeUuid}`);
    }
  }, [pairedNodeUuid, onlineWait.status]);

  const onPairingConnected = (target: NodePairingTarget) => {
    setPairingTarget(target);
    form.setValues({
      url: target.url,
      memory: bytesToReservedMib(target.probe.memoryBytes),
      disk: bytesToReservedMib(target.probe.diskBytes),
      ...(target.probe.container ? {} : { sftpPort: target.probe.sftpPort }),
    });
  };

  const doCreateAndPair = async () => {
    if (!pairingTarget) return;

    setLoading(true);

    try {
      const node = await createNode(adminNodeUpdateSchema.parse(form.getValues()));
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.all() });

      const ports = resolvePorts(allocationPorts).resolved;
      if (allocationIp && ports.length > 0) {
        await createNodeAllocations(node.uuid, { ip: allocationIp, ipAlias: null, ports });
      }

      try {
        await pairNode(node.uuid, pairingTarget.pairingCode, remote.trim() || null);
      } catch (err) {
        addToast(t('pages.admin.nodes.pairing.toast.pairFailed', { error: httpErrorToHuman(err) }), 'error');
        navigate(`/admin/nodes/${node.uuid}/configuration`);
        return;
      }

      setPairedNodeUuid(node.uuid);
      onlineWait.start(node.uuid, PAIR_TIMEOUT_MS);
    } catch (err) {
      addToast(httpErrorToHuman(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminContentContainer
      title={
        contextNode
          ? t('pages.admin.nodes.tabs.general.page.titleUpdate', {})
          : t('pages.admin.nodes.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextNode}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.nodes.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('common.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      {contextNode && (
        <NodeDuplicateModal node={contextNode} opened={openModal === 'duplicate'} onClose={() => setOpenModal(null)} />
      )}

      {!contextNode && (
        <SegmentedControl
          mb='md'
          value={mode}
          onChange={(value) => setMode(value as 'pair' | 'manual')}
          data={[
            { label: t('pages.admin.nodes.pairing.mode.pair', {}), value: 'pair' },
            { label: t('pages.admin.nodes.pairing.mode.manual', {}), value: 'manual' },
          ]}
        />
      )}

      {isPairing && (
        <div className='mb-4'>
          <NodePairingConnect
            target={pairingTarget}
            onConnected={onPairingConnected}
            onReset={() => setPairingTarget(null)}
          />
        </div>
      )}

      <form
        hidden={isPairing && !pairingTarget}
        onSubmit={form.onSubmit(() =>
          isPairing ? doCreateAndPair() : doCreateOrUpdate(false, queryKeys.admin.nodes.all()),
        )}
      >
        <FormEngine form={form} fields={fields} />

        {isPairing && pairingTarget && (
          <>
            <TitleCard
              className='mt-4'
              title={t('pages.admin.nodes.pairing.section.allocations', {})}
              icon={<FontAwesomeIcon icon={faNetworkWired} />}
            >
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <NodeAllocationIpInput
                  label={t('common.table.columns.ip', {})}
                  suggestedIps={pairingTarget.probe.ips}
                  value={allocationIp}
                  onChange={setAllocationIp}
                />
                <TagsInput
                  label={t('common.form.portRanges', {})}
                  placeholder={t('common.form.portRangesPlaceholder', {})}
                  value={allocationPorts}
                  onChange={setAllocationPorts}
                />
              </div>
            </TitleCard>

            <TitleCard
              className='mt-4'
              title={t('pages.admin.nodes.pairing.section.advanced', {})}
              icon={<FontAwesomeIcon icon={faSliders} />}
            >
              <TextInput
                label={t('pages.admin.nodes.pairing.form.panelUrl', {})}
                description={t('pages.admin.nodes.pairing.form.panelUrlDescription', {})}
                placeholder={window.location.origin}
                value={remote}
                onChange={(e) => setRemote(e.target.value)}
              />
            </TitleCard>
          </>
        )}

        <Group mt='md'>
          <AdminCan action={contextNode ? 'nodes.update' : 'nodes.create'} cantSave>
            {isPairing ? (
              <Button
                type='submit'
                disabled={!isValid || !!pairedNodeUuid}
                loading={loading}
                leftSection={<FontAwesomeIcon icon={faLink} />}
              >
                {t('pages.admin.nodes.pairing.button.createAndPair', {})}
              </Button>
            ) : (
              <Button type='submit' disabled={!isValid} loading={loading}>
                {t('common.button.save', {})}
              </Button>
            )}
            {!contextNode && !isPairing && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!isValid} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextNode && (
            <>
              <AdminCan action='nodes.reset-token'>
                <Button
                  color='red'
                  variant='outline'
                  onClick={doResetToken}
                  loading={loading}
                  disabled={isNodeAIO(contextNode)}
                >
                  {t('pages.admin.nodes.tabs.general.page.button.resetToken', {})}
                </Button>
              </AdminCan>
              <AdminCan action='nodes.create'>
                <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                  {t('common.button.duplicate', {})}
                </Button>
              </AdminCan>
              <AdminCan action='nodes.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  {t('common.button.delete', {})}
                </Button>
              </AdminCan>
            </>
          )}
        </Group>

        {pairedNodeUuid && (
          <Stack mt='md'>
            <NodePairingStatusAlert status={onlineWait.status} version={onlineWait.version} />
          </Stack>
        )}
      </form>
    </AdminContentContainer>
  );
}
