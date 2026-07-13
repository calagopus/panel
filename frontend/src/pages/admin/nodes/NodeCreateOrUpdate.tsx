import { faGlobe } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import getLocations from '@/api/admin/locations/getLocations.ts';
import createNode from '@/api/admin/nodes/createNode.ts';
import deleteNode from '@/api/admin/nodes/deleteNode.ts';
import resetNodeToken from '@/api/admin/nodes/resetNodeToken.ts';
import updateNode from '@/api/admin/nodes/updateNode.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { isNodeAIO } from '@/lib/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminNodeSchema, adminNodeUpdateSchema } from '@/lib/schemas/admin/nodes.ts';
import NodeDuplicateModal from '@/pages/admin/nodes/modals/NodeDuplicateModal.tsx';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type NodeFormValues = z.infer<typeof adminNodeUpdateSchema>;

export default function NodeCreateOrUpdate({ contextNode }: { contextNode?: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [isValid, setIsValid] = useState(false);
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const form = useFormEngine<NodeFormValues>('admin.nodes.createOrUpdate', {
    schema: adminNodeUpdateSchema.unwrap(),
    mode: 'uncontrolled',
    initialValues: {
      locationUuid: '',
      backupConfigurationUuid: null,
      name: '',
      deploymentEnabled: true,
      maintenanceEnabled: false,
      description: null,
      publicUrl: null,
      url: '',
      sftpHost: null,
      sftpPort: 2022,
      memory: 8192,
      disk: 10240,
    },
    onValuesChange: () => setIsValid(form.isValid()),
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

  useEffect(() => {
    if (contextNode) {
      form.setValues({
        locationUuid: contextNode.location.uuid,
        backupConfigurationUuid: contextNode.backupConfiguration?.uuid ?? null,
        name: contextNode.name,
        deploymentEnabled: contextNode.deploymentEnabled,
        maintenanceEnabled: contextNode.maintenanceEnabled,
        description: contextNode.description,
        publicUrl: contextNode.publicUrl,
        url: contextNode.url,
        sftpHost: contextNode.sftpHost,
        sftpPort: contextNode.sftpPort,
        memory: contextNode.memory,
        disk: contextNode.disk,
      });
    }
  }, [contextNode]);

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

  const fields: FieldDef<NodeFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'locationUuid',
      label: t('common.table.columns.location', {}),
      required: true,
      options: locations.items.map((l) => ({ label: l.name, value: l.uuid })),
      props: {
        searchable: true,
        searchValue: locations.search,
        onSearchChange: locations.setSearch,
        loading: locations.loading,
      },
    },
    {
      type: 'text',
      name: 'url',
      label: t('common.form.url', {}),
      required: true,
      description: t('pages.admin.nodes.tabs.general.page.form.urlDescription', {}),
      props: { disabled: contextNode ? isNodeAIO(contextNode) : false },
    },
    {
      type: 'custom',
      name: 'publicUrl',
      render: (f) => (
        <TextInput
          label={t('common.form.publicUrl', {})}
          description={t('pages.admin.nodes.tabs.general.page.form.publicUrlDescription', {})}
          key={f.key('publicUrl')}
          rightSection={
            <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.useWingsProxyUrl', {})}>
              <ActionIcon
                variant='subtle'
                onClick={() =>
                  f.setFieldValue('publicUrl', `${window.location.origin}/wings-proxy/${contextNode?.uuid}`)
                }
                disabled={!contextNode}
                size='lg'
              >
                <FontAwesomeIcon icon={faGlobe} />
              </ActionIcon>
            </Tooltip>
          }
          {...f.getInputProps('publicUrl')}
          disabled={contextNode ? isNodeAIO(contextNode) : false}
        />
      ),
    },
    { type: 'text', name: 'sftpHost', label: t('common.form.sftpHost', {}) },
    {
      type: 'number',
      name: 'sftpPort',
      label: t('common.form.sftpPort', {}),
      required: true,
      props: { min: 1, max: 65535 },
    },
    { type: 'size', name: 'memory', label: t('common.form.memory', {}), required: true, mode: 'mb', min: 0 },
    { type: 'size', name: 'disk', label: t('common.form.disk', {}), required: true, mode: 'mb', min: 0 },
    {
      type: 'select',
      name: 'backupConfigurationUuid',
      label: t('common.form.backupConfiguration', {}),
      options: backupConfigurations.items.map((b) => ({ label: b.name, value: b.uuid })),
      props: {
        placeholder: t('pages.admin.nodes.tabs.general.page.form.backupConfigurationPlaceholder', {}),
        searchable: true,
        searchValue: backupConfigurations.search,
        onSearchChange: backupConfigurations.setSearch,
        allowDeselect: true,
        clearable: true,
        loading: backupConfigurations.loading,
      },
    },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), rows: 3 },
    { type: 'switch', name: 'deploymentEnabled', label: t('common.form.deploymentEnabled', {}) },
    { type: 'switch', name: 'maintenanceEnabled', label: t('common.form.maintenanceEnabled', {}) },
  ];

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
        {t('pages.admin.nodes.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      {contextNode && (
        <NodeDuplicateModal node={contextNode} opened={openModal === 'duplicate'} onClose={() => setOpenModal(null)} />
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.nodes.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan action={contextNode ? 'nodes.update' : 'nodes.create'} cantSave>
            <Button type='submit' disabled={!isValid} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextNode && (
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
      </form>
    </AdminContentContainer>
  );
}
