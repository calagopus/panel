import { faGlobe } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
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
import Code from '@/elements/Code.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { isNodeAIO } from '@/lib/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminNodeSchema, adminNodeUpdateSchema } from '@/lib/schemas/admin/nodes.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function NodeCreateOrUpdate({ contextNode }: { contextNode?: z.infer<typeof adminNodeSchema> }) {
  const { addToast } = useToast();

  const [isValid, setIsValid] = useState(false);
  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminNodeUpdateSchema>>({
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
    validate: zod4Resolver(adminNodeUpdateSchema),
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminNodeUpdateSchema>,
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
    resourceName: 'Node',
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
      .then(({ tokenId, token }) => {
        addToast('Node token reset.', 'success');
        contextNode.tokenId = tokenId;
        contextNode.token = token;
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminContentContainer
      title={`${contextNode ? 'Update' : 'Create'} Node`}
      fullscreen={!!contextNode}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Node Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'nodes']))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label='Name'
            placeholder='Name'
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Select
            withAsterisk
            label='Location'
            placeholder='Location'
            data={locations.items.map((location) => ({
              label: location.name,
              value: location.uuid,
            }))}
            searchable
            searchValue={locations.search}
            onSearchChange={locations.setSearch}
            loading={locations.loading}
            key={form.key('locationUuid')}
            {...form.getInputProps('locationUuid')}
          />

          <TextInput
            withAsterisk
            label='URL'
            description='used for internal communication with the node'
            placeholder='URL'
            key={form.key('url')}
            {...form.getInputProps('url')}
            disabled={contextNode ? isNodeAIO(contextNode) : false}
          />
          <TextInput
            label='Public URL'
            description='used for websocket/downloads'
            placeholder='URL'
            key={form.key('publicUrl')}
            rightSection={
              <Tooltip label='Use Wings Proxy URL'>
                <ActionIcon
                  variant='subtle'
                  onClick={() =>
                    form.setFieldValue('publicUrl', `${window.location.origin}/wings-proxy/${contextNode?.uuid}`)
                  }
                  disabled={!contextNode}
                  size='lg'
                >
                  <FontAwesomeIcon icon={faGlobe} />
                </ActionIcon>
              </Tooltip>
            }
            {...form.getInputProps('publicUrl')}
            disabled={contextNode ? isNodeAIO(contextNode) : false}
          />

          <TextInput
            label='SFTP Host'
            placeholder='SFTP Host'
            key={form.key('sftpHost')}
            {...form.getInputProps('sftpHost')}
          />
          <NumberInput
            withAsterisk
            label='SFTP Port'
            placeholder='SFTP Port'
            min={1}
            max={65535}
            key={form.key('sftpPort')}
            {...form.getInputProps('sftpPort')}
          />

          <SizeInput
            withAsterisk
            label='Memory'
            mode='mb'
            min={0}
            value={form.getValues().memory}
            onChange={(value) => form.setFieldValue('memory', value)}
          />
          <SizeInput
            withAsterisk
            label='Disk'
            mode='mb'
            min={0}
            value={form.getValues().disk}
            onChange={(value) => form.setFieldValue('disk', value)}
          />

          <Select
            label='Backup Configuration'
            placeholder='Inherit from Location'
            data={backupConfigurations.items.map((backupConfiguration) => ({
              label: backupConfiguration.name,
              value: backupConfiguration.uuid,
            }))}
            searchable
            searchValue={backupConfigurations.search}
            onSearchChange={backupConfigurations.setSearch}
            allowDeselect
            clearable
            loading={backupConfigurations.loading}
            key={form.key('backupConfigurationUuid')}
            {...form.getInputProps('backupConfigurationUuid')}
          />
          <TextArea
            label='Description'
            placeholder='Description'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />

          <Switch
            label='Deployment Enabled'
            key={form.key('deploymentEnabled')}
            {...form.getInputProps('deploymentEnabled', { type: 'checkbox' })}
          />
          <Switch
            label='Maintenance Enabled'
            key={form.key('maintenanceEnabled')}
            {...form.getInputProps('maintenanceEnabled', { type: 'checkbox' })}
          />
        </div>

        <Group mt='md'>
          <AdminCan action={contextNode ? 'nodes.update' : 'nodes.create'} cantSave>
            <Button type='submit' disabled={!isValid} loading={loading}>
              Save
            </Button>
            {!contextNode && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!isValid} loading={loading}>
                Save & Stay
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
                  Reset Token
                </Button>
              </AdminCan>
              <AdminCan action='nodes.delete' cantDelete>
                <Button
                  color='red'
                  onClick={() => setOpenModal('delete')}
                  loading={loading}
                  disabled={isNodeAIO(contextNode)}
                >
                  Delete
                </Button>
              </AdminCan>
            </>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
