import {
  faAddressCard,
  faIcons,
  faInfoCircle,
  faNetworkWired,
  faPlay,
  faReply,
  faStopwatch,
  faWrench,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { zones } from 'tzdata';
import { z } from 'zod';
import getBackupConfigurations from '@/api/admin/backup-configurations/getBackupConfigurations.ts';
import getEggs from '@/api/admin/nests/eggs/getEggs.ts';
import getEggVariables from '@/api/admin/nests/eggs/variables/getEggVariables.ts';
import getNests from '@/api/admin/nests/getNests.ts';
import getAvailableNodeAllocations from '@/api/admin/nodes/allocations/getAvailableNodeAllocations.ts';
import getNodes from '@/api/admin/nodes/getNodes.ts';
import createServer from '@/api/admin/servers/createServer.ts';
import getUsers from '@/api/admin/users/getUsers.ts';
import { getEmptyPaginationSet, httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import VariableContainer from '@/elements/VariableContainer.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminEggSchema, adminEggVariableSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { adminNodeAllocationSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminServerCreateSchema, adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { formatAllocation } from '@/lib/server.ts';
import { useExtendibleForm } from '@/plugins/useExtendibleForm.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const timezones = Object.keys(zones)
  .sort()
  .map((zone) => ({
    value: zone,
    label: zone,
  }));

export default function ServerCreate() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const canReadNodes = useAdminCan('nodes.read');
  const canReadUsers = useAdminCan('users.read');
  const canReadNests = useAdminCan('nests.read');
  const canReadEggs = useAdminCan('eggs.read');
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [isValid, setIsValid] = useState(false);
  const [openModal, setOpenModal] = useState<'confirm-no-allocation' | null>(null);

  const { formSchema, formInitialValues } = useExtendibleForm({
    baseSchema: adminServerCreateSchema,
    defaultValues: {
      externalId: null,
      name: '',
      description: null,
      startOnCompletion: true,
      skipInstaller: false,
      limits: {
        cpu: 100,
        memory: 1024,
        memoryOverhead: 0,
        swap: 0,
        disk: 10240,
        ioWeight: null,
      },
      pinnedCpus: [],
      startup: '',
      image: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hugepagesPassthroughEnabled: false,
      kvmPassthroughEnabled: false,
      featureLimits: {
        allocations: 5,
        databases: 5,
        backups: 5,
        schedules: 5,
      },
      nodeUuid: '',
      ownerUuid: '',
      eggUuid: '',
      backupConfigurationUuid: null,
      allocationUuid: null,
      allocationUuids: [],
      variables: [],
    },
    registry: [
      window.extensionContext.extensionRegistry.pages.admin.servers.create.basicInformationFormContainer,
      window.extensionContext.extensionRegistry.pages.admin.servers.create.serverAssignmentFormContainer,
      window.extensionContext.extensionRegistry.pages.admin.servers.create.resourceLimitsFormContainer,
      window.extensionContext.extensionRegistry.pages.admin.servers.create.serverConfigurationFormContainer,
      window.extensionContext.extensionRegistry.pages.admin.servers.create.featureLimitsFormContainer,
      window.extensionContext.extensionRegistry.pages.admin.servers.create.allocationsFormContainer,
    ],
  });

  const form = useForm<z.infer<typeof adminServerCreateSchema>>({
    mode: 'uncontrolled',
    initialValues: formInitialValues,
    onValuesChange: () => setIsValid(form.isValid()),
    validateInputOnBlur: true,
    validate: zod4Resolver(formSchema),
  });

  const { loading, doCreateOrUpdate } = useResourceForm<
    z.infer<typeof adminServerCreateSchema>,
    z.infer<typeof adminServerSchema>
  >({
    form,
    createFn: () => createServer(formSchema.parse(form.getValues())),
    doUpdate: false,
    basePath: '/admin/servers',
    resourceName: 'Server',
    toResetOnStay: ['allocationUuid', 'allocationUuids'],
  });

  const [eggVariablesLoading, setEggVariablesLoading] = useState(false);
  const [selectedNestUuid, setSelectedNestUuid] = useState<string | null>('');
  const [eggVariables, setEggVariables] = useState<z.infer<typeof adminEggVariableSchema>[]>([]);

  const nodes = useSearchableResource<z.infer<typeof adminNodeSchema>>({
    queryKey: queryKeys.admin.nodes.all(),
    fetcher: (search) => getNodes(1, search),
    canRequest: canReadNodes,
  });
  const users = useSearchableResource<z.infer<typeof fullUserSchema>>({
    queryKey: queryKeys.admin.users.all(),
    fetcher: (search) => getUsers(1, search),
    canRequest: canReadUsers,
  });
  const nests = useSearchableResource<z.infer<typeof adminNestSchema>>({
    queryKey: queryKeys.admin.nests.all(),
    fetcher: (search) => getNests(1, search),
    canRequest: canReadNests,
  });
  const eggs = useSearchableResource<z.infer<typeof adminEggSchema>>({
    queryKey: selectedNestUuid ? queryKeys.admin.nests.eggs(selectedNestUuid) : ['admin', 'nests', 'eggs'],
    fetcher: (search) =>
      selectedNestUuid ? getEggs(selectedNestUuid, 1, search) : Promise.resolve(getEmptyPaginationSet()),
    deps: [selectedNestUuid],
    canRequest: canReadEggs,
  });
  const availablePrimaryAllocations = useSearchableResource<z.infer<typeof adminNodeAllocationSchema>>({
    queryKey: form.getValues().nodeUuid
      ? queryKeys.admin.nodes.allocations(form.getValues().nodeUuid)
      : ['admin', 'nodes', 'primary-allocations'],
    fetcher: (search) =>
      form.getValues().nodeUuid
        ? getAvailableNodeAllocations(form.getValues().nodeUuid, 1, search)
        : Promise.resolve(getEmptyPaginationSet()),
    deps: [form.getValues().nodeUuid],
  });
  const availableAllocations = useSearchableResource<z.infer<typeof adminNodeAllocationSchema>>({
    queryKey: form.getValues().nodeUuid
      ? queryKeys.admin.nodes.allocations(form.getValues().nodeUuid)
      : ['admin', 'nodes', 'allocations'],
    fetcher: (search) =>
      form.getValues().nodeUuid
        ? getAvailableNodeAllocations(form.getValues().nodeUuid, 1, search)
        : Promise.resolve(getEmptyPaginationSet()),
    deps: [form.getValues().nodeUuid],
  });
  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    canRequest: canReadBackupConfigurations,
  });

  useEffect(() => {
    const egg = eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid);
    if (!egg) {
      return;
    }

    form.setFieldValue('image', Object.values(egg.dockerImages)[0] ?? '');
    form.setFieldValue('startup', egg.startup);
  }, [form.getValues().eggUuid, eggs.items]);

  useEffect(() => {
    if (!selectedNestUuid || !form.getValues().eggUuid) {
      return;
    }

    setEggVariablesLoading(true);
    getEggVariables(selectedNestUuid, form.getValues().eggUuid)
      .then((variables) => {
        setEggVariables(variables);
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setEggVariablesLoading(false));
  }, [selectedNestUuid, form.getValues().eggUuid]);

  return (
    <AdminContentContainer
      title='Create Server'
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.create.container}
    >
      <ConfirmationModal
        opened={openModal === 'confirm-no-allocation'}
        onClose={() => setOpenModal(null)}
        title='No Primary Allocation Assigned'
        confirm='Create Anyway'
        onConfirmed={() => doCreateOrUpdate(false)}
      >
        You are creating a server without assigning any primary allocation. Are you sure you want to continue?
      </ConfirmationModal>

      <form
        onSubmit={form.onSubmit((values) =>
          !values.allocationUuid ? setOpenModal('confirm-no-allocation') : doCreateOrUpdate(false),
        )}
      >
        <Stack mt='16'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {window.extensionContext.extensionRegistry.pages.admin.servers.create.formContainers.prependedComponents.map(
              (Component, i) => (
                <Component key={`form-container-prepended-${i}`} form={form as never} />
              ),
            )}

            <TitleCard title='Basic Information' icon={<FontAwesomeIcon icon={faInfoCircle} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.create.basicInformationFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component key={`basic-information-form-container-prepended-${i}`} form={form as never} />
                  ),
                )}

                <TextInput
                  withAsterisk
                  label='Server Name'
                  placeholder='My Game Server'
                  key={form.key('name')}
                  {...form.getInputProps('name')}
                />
                <TextInput
                  label='External ID'
                  placeholder='Optional external identifier'
                  key={form.key('externalId')}
                  {...form.getInputProps('externalId')}
                />

                <TextArea
                  label='Description'
                  placeholder='Server description'
                  className='col-span-full'
                  rows={3}
                  key={form.key('description')}
                  {...form.getInputProps('description')}
                />

                {window.extensionContext.extensionRegistry.pages.admin.servers.create.basicInformationFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component key={`basic-information-form-container-appended-${i}`} form={form as never} />
                  ),
                )}
              </div>
            </TitleCard>

            <TitleCard title='Server Assignment' icon={<FontAwesomeIcon icon={faAddressCard} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.create.serverAssignmentFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component key={`server-assignment-form-container-prepended-${i}`} form={form as never} />
                  ),
                )}

                <Select
                  withAsterisk
                  label='Node'
                  placeholder='Node'
                  data={nodes.items.map((node) => ({
                    label: node.name,
                    value: node.uuid,
                  }))}
                  searchable
                  searchValue={nodes.search}
                  onSearchChange={nodes.setSearch}
                  disabled={!canReadNodes}
                  loading={nodes.loading}
                  key={form.key('nodeUuid')}
                  {...form.getInputProps('nodeUuid')}
                />
                <Select
                  withAsterisk
                  label='Owner'
                  placeholder='Owner'
                  data={users.items.map((user) => ({
                    label: user.username,
                    value: user.uuid,
                  }))}
                  searchable
                  searchValue={users.search}
                  onSearchChange={users.setSearch}
                  loading={users.loading}
                  disabled={!canReadUsers}
                  key={form.key('ownerUuid')}
                  {...form.getInputProps('ownerUuid')}
                />

                <Select
                  withAsterisk
                  label='Nest'
                  placeholder='Nest'
                  value={selectedNestUuid}
                  onChange={(value) => setSelectedNestUuid(value)}
                  data={nests.items.map((nest) => ({
                    label: nest.name,
                    value: nest.uuid,
                  }))}
                  searchable
                  searchValue={nests.search}
                  onSearchChange={nests.setSearch}
                  disabled={!canReadNests}
                  loading={nests.loading}
                />
                <Select
                  withAsterisk
                  label='Egg'
                  placeholder='Egg'
                  disabled={!canReadEggs || !selectedNestUuid}
                  data={eggs.items.map((egg) => ({
                    label: egg.name,
                    value: egg.uuid,
                  }))}
                  searchable
                  searchValue={eggs.search}
                  onSearchChange={eggs.setSearch}
                  loading={eggs.loading}
                  key={form.key('eggUuid')}
                  {...form.getInputProps('eggUuid')}
                />

                <Select
                  label='Backup Configuration'
                  placeholder='Inherit from Node/Location'
                  data={backupConfigurations.items.map((backupConfiguration) => ({
                    label: backupConfiguration.name,
                    value: backupConfiguration.uuid,
                  }))}
                  searchable
                  searchValue={backupConfigurations.search}
                  onSearchChange={backupConfigurations.setSearch}
                  allowDeselect
                  clearable
                  disabled={!canReadBackupConfigurations}
                  loading={backupConfigurations.loading}
                  key={form.key('backupConfigurationUuid')}
                  {...form.getInputProps('backupConfigurationUuid')}
                />

                {window.extensionContext.extensionRegistry.pages.admin.servers.create.resourceLimitsFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component key={`resource-limits-form-container-prepended-${i}`} form={form as never} />
                  ),
                )}
              </div>
            </TitleCard>

            <TitleCard title='Resource Limits' icon={<FontAwesomeIcon icon={faStopwatch} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.create.resourceLimitsFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component key={`resource-limits-form-container-prepended-${i}`} form={form as never} />
                  ),
                )}

                <NumberInput
                  withAsterisk
                  label='CPU Limit (%)'
                  description='The CPU Limit in % that the server can use, 1 thread = 100%'
                  placeholder='100'
                  min={0}
                  key={form.key('limits.cpu')}
                  {...form.getInputProps('limits.cpu')}
                />
                <SizeInput
                  withAsterisk
                  label='Swap'
                  description='The amount of swap to give this server, -1 will not set a limit'
                  mode='mb'
                  min={-1}
                  value={form.getValues().limits.swap}
                  onChange={(value) => form.setFieldValue('limits.swap', value)}
                />

                <SizeInput
                  withAsterisk
                  label='Memory'
                  description='The Memory limit of the server container, 0 will not set a limit'
                  mode='mb'
                  min={0}
                  value={form.getValues().limits.memory}
                  onChange={(value) => form.setFieldValue('limits.memory', value)}
                />
                <SizeInput
                  withAsterisk
                  label='Memory Overhead'
                  description='Hidden Memory that will be added to the container'
                  mode='mb'
                  min={0}
                  value={form.getValues().limits.memoryOverhead}
                  onChange={(value) => form.setFieldValue('limits.memoryOverhead', value)}
                />

                <SizeInput
                  withAsterisk
                  label='Disk Space'
                  description='The disk limit of the server, this is a soft-limit unless disk limiter configured on wings'
                  mode='mb'
                  min={0}
                  value={form.getValues().limits.disk}
                  onChange={(value) => form.setFieldValue('limits.disk', value)}
                />
                <NumberInput
                  label='IO Weight'
                  description='The relative IO Weight of the server container compared to other containers, 0-1000, may not work on all systems'
                  key={form.key('limits.ioWeight')}
                  {...form.getInputProps('limits.ioWeight')}
                />

                {window.extensionContext.extensionRegistry.pages.admin.servers.create.resourceLimitsFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component key={`resource-limits-form-container-appended-${i}`} form={form as never} />
                  ),
                )}
              </div>
            </TitleCard>

            <TitleCard title='Server Configuration' icon={<FontAwesomeIcon icon={faWrench} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.create.serverConfigurationFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component key={`server-configuration-form-container-prepended-${i}`} form={form as never} />
                  ),
                )}

                <Select
                  withAsterisk
                  label='Docker Image'
                  placeholder='ghcr.io/...'
                  data={Object.entries(
                    eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid)?.dockerImages || {},
                  ).map(([label, value]) => ({
                    label,
                    value,
                  }))}
                  searchable
                  key={form.key('image')}
                  {...form.getInputProps('image')}
                />
                <Select
                  label='Timezone'
                  placeholder='Europe/Amsterdam'
                  data={[
                    {
                      label: 'System',
                      value: '',
                    },
                    ...timezones,
                  ]}
                  searchable
                  key={form.key('timezone')}
                  {...form.getInputProps('timezone')}
                />

                <TextArea
                  label='Startup Command'
                  placeholder='npm start'
                  className='col-span-full'
                  required
                  rows={2}
                  rightSection={
                    <Tooltip label={t('common.tooltip.resetToDefault', {})}>
                      <ActionIcon
                        variant='subtle'
                        disabled={
                          form.getValues().startup ===
                          eggs.items.find((e) => e.uuid === form.getValues().eggUuid)?.startup
                        }
                        onClick={() =>
                          form.setFieldValue(
                            'startup',
                            eggs.items.find((e) => e.uuid === form.getValues().eggUuid)?.startup || '',
                          )
                        }
                      >
                        <FontAwesomeIcon icon={faReply} />
                      </ActionIcon>
                    </Tooltip>
                  }
                  key={form.key('startup')}
                  {...form.getInputProps('startup')}
                />

                <Switch
                  label='Start on Completion'
                  description='Start server after installation completes'
                  key={form.key('startOnCompletion')}
                  {...form.getInputProps('startOnCompletion', {
                    type: 'checkbox',
                  })}
                />
                <Switch
                  label='Skip Installer'
                  description='Skip running the install script'
                  key={form.key('skipInstaller')}
                  {...form.getInputProps('skipInstaller', {
                    type: 'checkbox',
                  })}
                />

                <Switch
                  label='Enable Hugepages Passthrough'
                  description='Enable hugepages passthrough for the server (mounts /dev/hugepages into the container)'
                  key={form.key('hugepagesPassthroughEnabled')}
                  {...form.getInputProps('hugepagesPassthroughEnabled', {
                    type: 'checkbox',
                  })}
                />

                <Switch
                  label='Enable KVM Passthrough'
                  description='Enable KVM passthrough for the server (allows access to /dev/kvm inside the container)'
                  key={form.key('kvmPassthroughEnabled')}
                  {...form.getInputProps('kvmPassthroughEnabled', {
                    type: 'checkbox',
                  })}
                />

                {window.extensionContext.extensionRegistry.pages.admin.servers.create.serverConfigurationFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component key={`server-configuration-form-container-appended-${i}`} form={form as never} />
                  ),
                )}
              </div>
            </TitleCard>

            <TitleCard title='Feature Limits' icon={<FontAwesomeIcon icon={faIcons} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.create.featureLimitsFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component key={`feature-limits-form-container-prepended-${i}`} form={form as never} />
                  ),
                )}

                <NumberInput
                  withAsterisk
                  label='Allocations'
                  placeholder='0'
                  min={0}
                  key={form.key('featureLimits.allocations')}
                  {...form.getInputProps('featureLimits.allocations')}
                />
                <NumberInput
                  withAsterisk
                  label='Databases'
                  placeholder='0'
                  min={0}
                  key={form.key('featureLimits.databases')}
                  {...form.getInputProps('featureLimits.databases')}
                />
                <NumberInput
                  withAsterisk
                  label='Backups'
                  placeholder='0'
                  min={0}
                  key={form.key('featureLimits.backups')}
                  {...form.getInputProps('featureLimits.backups')}
                />
                <NumberInput
                  withAsterisk
                  label='Schedules'
                  placeholder='0'
                  min={0}
                  key={form.key('featureLimits.schedules')}
                  {...form.getInputProps('featureLimits.schedules')}
                />

                {window.extensionContext.extensionRegistry.pages.admin.servers.create.featureLimitsFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component key={`feature-limits-form-container-appended-${i}`} form={form as never} />
                  ),
                )}
              </div>
            </TitleCard>

            <TitleCard title='Allocations' icon={<FontAwesomeIcon icon={faNetworkWired} />}>
              <Stack>
                {window.extensionContext.extensionRegistry.pages.admin.servers.create.allocationsFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component key={`allocations-form-container-prepended-${i}`} form={form as never} />
                  ),
                )}

                <Group grow>
                  <Select
                    label='Primary Allocation'
                    placeholder='Primary Allocation'
                    disabled={!form.getValues().nodeUuid}
                    data={availablePrimaryAllocations.items
                      .filter((alloc) => !form.getValues().allocationUuids.includes(alloc.uuid))
                      .map((alloc) => ({
                        label: formatAllocation(alloc),
                        value: alloc.uuid,
                      }))}
                    searchable
                    searchValue={availablePrimaryAllocations.search}
                    onSearchChange={availablePrimaryAllocations.setSearch}
                    allowDeselect
                    key={form.key('allocationUuid')}
                    {...form.getInputProps('allocationUuid')}
                  />
                  <MultiSelect
                    label='Additional Allocations'
                    placeholder='Additional Allocations'
                    disabled={!form.getValues().nodeUuid}
                    data={availableAllocations.items
                      .filter((alloc) => alloc.uuid !== form.getValues().allocationUuid)
                      .map((alloc) => ({
                        label: formatAllocation(alloc),
                        value: alloc.uuid,
                      }))}
                    searchable
                    searchValue={availableAllocations.search}
                    onSearchChange={availableAllocations.setSearch}
                    key={form.key('allocationUuids')}
                    {...form.getInputProps('allocationUuids')}
                  />
                </Group>

                {window.extensionContext.extensionRegistry.pages.admin.servers.create.allocationsFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component key={`allocations-form-container-appended-${i}`} form={form as never} />
                  ),
                )}
              </Stack>
            </TitleCard>

            <TitleCard title='Variables' icon={<FontAwesomeIcon icon={faPlay} />} className='col-span-full'>
              <Stack>
                {!selectedNestUuid || !form.getValues().eggUuid ? (
                  <Alert>Please select an egg before you can configure variables.</Alert>
                ) : eggVariablesLoading ? (
                  <Spinner.Centered />
                ) : (
                  <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
                    {eggVariables.map((variable) => (
                      <VariableContainer
                        key={variable.envVariable}
                        variable={{
                          ...variable,
                          value: '',
                          isEditable: variable.userEditable,
                        }}
                        loading={loading}
                        overrideReadonly
                        value={
                          form.getValues().variables.find((v) => v.envVariable === variable.envVariable)?.value ??
                          variable.defaultValue ??
                          ''
                        }
                        setValue={(value) =>
                          form.setFieldValue('variables', (prev) => [
                            ...prev.filter((v) => v.envVariable !== variable.envVariable),
                            { envVariable: variable.envVariable, value },
                          ])
                        }
                      />
                    ))}
                  </div>
                )}
              </Stack>
            </TitleCard>

            {window.extensionContext.extensionRegistry.pages.admin.servers.create.formContainers.appendedComponents.map(
              (Component, i) => (
                <Component key={`form-container-appended-${i}`} form={form as never} />
              ),
            )}
          </div>

          <Group>
            <AdminCan action='servers.create' cantSave>
              <Button type='submit' disabled={!isValid} loading={loading}>
                Save
              </Button>
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!isValid} loading={loading}>
                Save & Stay
              </Button>
            </AdminCan>
          </Group>
        </Stack>
      </form>
    </AdminContentContainer>
  );
}
