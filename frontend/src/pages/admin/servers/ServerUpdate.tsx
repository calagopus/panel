import {
  faAddressCard,
  faCircleInfo,
  faIcons,
  faInfoCircle,
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
import getNests from '@/api/admin/nests/getNests.ts';
import updateServer from '@/api/admin/servers/updateServer.ts';
import getUsers from '@/api/admin/users/getUsers.ts';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { adminServerSchema, adminServerUpdateSchema } from '@/lib/schemas/admin/servers.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { useExtendibleForm } from '@/plugins/useExtendibleForm.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const timezones = Object.keys(zones)
  .sort()
  .map((zone) => ({
    value: zone,
    label: zone,
  }));

export default function ServerUpdate({ contextServer }: { contextServer: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const canReadUsers = useAdminCan('users.read');
  const canReadNests = useAdminCan('nests.read');
  const canReadEggs = useAdminCan('eggs.read');
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [isValid, setIsValid] = useState(false);
  const [selectedNestUuid, setSelectedNestUuid] = useState<string | null>(contextServer?.nest.uuid ?? '');

  const { formSchema, formInitialValues } = useExtendibleForm({
    baseSchema: adminServerUpdateSchema,
    defaultValues: {
      ownerUuid: '',
      eggUuid: '',
      backupConfigurationUuid: null,
      externalId: null,
      name: '',
      description: null,
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
    },
    registry: [
      window.extensionContext.extensionRegistry.pages.admin.servers.view.update.basicInformationFormContainer,
      window.extensionContext.extensionRegistry.pages.admin.servers.view.update.serverAssignmentFormContainer,
      window.extensionContext.extensionRegistry.pages.admin.servers.view.update.resourceLimitsFormContainer,
      window.extensionContext.extensionRegistry.pages.admin.servers.view.update.serverConfigurationFormContainer,
      window.extensionContext.extensionRegistry.pages.admin.servers.view.update.featureLimitsFormContainer,
    ],
  });

  const form = useForm<z.infer<typeof adminServerUpdateSchema>>({
    mode: 'uncontrolled',
    initialValues: formInitialValues,
    onValuesChange: () => setIsValid(form.isValid()),
    validateInputOnBlur: true,
    validate: zod4Resolver(formSchema),
  });

  const { loading, doCreateOrUpdate } = useResourceForm<
    z.infer<typeof adminServerUpdateSchema>,
    z.infer<typeof adminServerSchema>
  >({
    form,
    updateFn: () => updateServer(contextServer.uuid, formSchema.parse(form.getValues())),
    doUpdate: true,
    basePath: '/admin/servers',
    resourceName: 'Server',
  });

  useEffect(() => {
    if (contextServer) {
      form.setValues({
        ownerUuid: contextServer.owner.uuid,
        eggUuid: contextServer.egg.uuid,
        backupConfigurationUuid: contextServer.backupConfiguration?.uuid ?? null,
        externalId: contextServer.externalId,
        name: contextServer.name,
        description: contextServer.description,
        limits: contextServer.limits,
        pinnedCpus: contextServer.pinnedCpus,
        startup: contextServer.startup,
        image: contextServer.image,
        timezone: contextServer.timezone,
        hugepagesPassthroughEnabled: contextServer.hugepagesPassthroughEnabled,
        kvmPassthroughEnabled: contextServer.kvmPassthroughEnabled,
        featureLimits: contextServer.featureLimits,
      });
    }
  }, [contextServer]);

  const users = useSearchableResource<z.infer<typeof fullUserSchema>>({
    queryKey: queryKeys.admin.users.all(),
    fetcher: (search) => getUsers(1, search),
    defaultSearchValue: contextServer?.owner.username,
    canRequest: canReadUsers,
  });
  const nests = useSearchableResource<z.infer<typeof adminNestSchema>>({
    queryKey: queryKeys.admin.nests.all(),
    fetcher: (search) => getNests(1, search),
    defaultSearchValue: contextServer?.nest.name,
    canRequest: canReadNests,
  });
  const eggs = useSearchableResource<z.infer<typeof adminEggSchema>>({
    queryKey: selectedNestUuid ? queryKeys.admin.nests.eggs(selectedNestUuid) : ['admin', 'nests', 'eggs'],
    fetcher: (search) =>
      selectedNestUuid ? getEggs(selectedNestUuid, 1, search) : Promise.resolve(getEmptyPaginationSet()),
    defaultSearchValue: contextServer?.egg.name,
    deps: [selectedNestUuid],
    canRequest: canReadEggs,
  });
  const backupConfigurations = useSearchableResource<z.infer<typeof adminBackupConfigurationSchema>>({
    queryKey: queryKeys.admin.backupConfigurations.all(),
    fetcher: (search) => getBackupConfigurations(1, search),
    defaultSearchValue: contextServer?.backupConfiguration?.name,
    canRequest: canReadBackupConfigurations,
  });

  const eggImages = eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid)?.dockerImages || {};

  useEffect(() => {
    if (!form.getValues().eggUuid || contextServer) {
      return;
    }

    const egg = eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid);
    if (!egg) {
      return;
    }

    form.setFieldValue('image', Object.values(egg.dockerImages)[0] ?? '');
    form.setFieldValue('startup', egg.startup);
  }, [form.getValues().eggUuid, eggs.items, contextServer]);

  return (
    <AdminSubContentContainer
      title='Update Server'
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.update.subContainer}
      registryProps={{ server: contextServer }}
    >
      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'servers']))}>
        <Stack>
          {contextServer.isSuspended && (
            <Alert title='Server Suspended' color='orange' icon={<FontAwesomeIcon icon={faCircleInfo} />}>
              This server is suspended.
            </Alert>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.formContainers.prependedComponents.map(
              (Component, i) => (
                <Component key={`form-container-prepended-${i}`} form={form as never} server={contextServer} />
              ),
            )}

            <TitleCard title='Basic Information' icon={<FontAwesomeIcon icon={faInfoCircle} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.basicInformationFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`basic-information-form-container-prepended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
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

                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.basicInformationFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`basic-information-form-container-appended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
                  ),
                )}
              </div>
            </TitleCard>

            <TitleCard title='Server Assignment' icon={<FontAwesomeIcon icon={faAddressCard} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.serverAssignmentFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`server-assignment-form-container-prepended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
                  ),
                )}

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
                  disabled={!canReadUsers}
                  loading={users.loading}
                  key={form.key('ownerUuid')}
                  {...form.getInputProps('ownerUuid')}
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

                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.serverAssignmentFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`server-assignment-form-container-appended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
                  ),
                )}
              </div>
            </TitleCard>

            <TitleCard title='Resource Limits' icon={<FontAwesomeIcon icon={faStopwatch} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.resourceLimitsFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`resource-limits-form-container-prepended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
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

                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.resourceLimitsFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`resource-limits-form-container-appended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
                  ),
                )}
              </div>
            </TitleCard>

            <TitleCard title='Server Configuration' icon={<FontAwesomeIcon icon={faWrench} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.serverConfigurationFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`server-configuration-form-container-prepended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
                  ),
                )}

                <Select
                  label='Predefined Docker Images'
                  placeholder='No predefined image selected'
                  data={Object.entries(eggImages).map(([label, value]) => ({
                    label,
                    value,
                  }))}
                  allowDeselect
                  clearable
                  searchable
                  value={
                    Object.entries(eggImages).some(([label, value]) => value === form.getValues().image)
                      ? form.getValues().image
                      : null
                  }
                  onChange={(value) => form.setFieldValue('image', value || '')}
                />
                <TextInput
                  withAsterisk
                  label='Docker Image'
                  placeholder='ghcr.io/...'
                  key={form.key('image')}
                  {...form.getInputProps('image')}
                />

                <Select
                  label='Timezone'
                  placeholder='System'
                  data={timezones}
                  allowDeselect
                  clearable
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

                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.serverConfigurationFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`server-configuration-form-container-appended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
                  ),
                )}
              </div>
            </TitleCard>

            <TitleCard title='Feature Limits' icon={<FontAwesomeIcon icon={faIcons} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.featureLimitsFormContainer.prependedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`feature-limits-form-container-prepended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
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

                {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.featureLimitsFormContainer.appendedComponents.map(
                  (Component, i) => (
                    <Component
                      key={`feature-limits-form-container-appended-${i}`}
                      form={form as never}
                      server={contextServer}
                    />
                  ),
                )}
              </div>
            </TitleCard>

            {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.formContainers.appendedComponents.map(
              (Component, i) => (
                <Component key={`form-container-appended-${i}`} form={form as never} server={contextServer} />
              ),
            )}
          </div>

          <Group>
            <AdminCan action='servers.update' cantSave>
              <Button type='submit' disabled={!isValid} loading={loading}>
                Save
              </Button>
            </AdminCan>
          </Group>
        </Stack>
      </form>
    </AdminSubContentContainer>
  );
}
