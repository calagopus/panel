import {
  faAddressCard,
  faCircleInfo,
  faCog,
  faIcons,
  faInfoCircle,
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
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Popover from '@/elements/Popover.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
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
    resourceName: t('pages.admin.servers.resourceName', {}),
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
    form.setFieldValue('startup', egg.startupCommands['Default'] || Object.values(egg.startupCommands)[0] || '');
  }, [form.getValues().eggUuid, eggs.items, contextServer]);

  return (
    <AdminSubContentContainer
      title={t('pages.admin.servers.tabs.general.page.titleUpdate', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.update.subContainer}
      registryProps={{ server: contextServer }}
    >
      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.servers.all()))}>
        <Stack>
          {contextServer.isSuspended && (
            <Alert
              title={t('pages.admin.servers.tabs.general.page.badge.serverSuspended', {})}
              color='orange'
              icon={<FontAwesomeIcon icon={faCircleInfo} />}
            >
              {t('pages.admin.servers.tabs.general.page.alert.suspended', {})}
            </Alert>
          )}

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {window.extensionContext.extensionRegistry.pages.admin.servers.view.update.formContainers.prependedComponents.map(
              (Component, i) => (
                <Component key={`form-container-prepended-${i}`} form={form as never} server={contextServer} />
              ),
            )}

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.basicInformation', {})}
              icon={<FontAwesomeIcon icon={faInfoCircle} />}
            >
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
                  label={t('common.form.serverName', {})}
                  placeholder={t('pages.admin.servers.tabs.general.page.form.serverNamePlaceholder', {})}
                  key={form.key('name')}
                  {...form.getInputProps('name')}
                />
                <TextInput
                  label={t('common.form.externalId', {})}
                  placeholder={t('pages.admin.servers.tabs.general.page.form.externalIdPlaceholder', {})}
                  key={form.key('externalId')}
                  {...form.getInputProps('externalId')}
                />

                <TextArea
                  label={t('common.form.description', {})}
                  placeholder={t('pages.admin.servers.tabs.general.page.form.descriptionPlaceholder', {})}
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

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.serverAssignment', {})}
              icon={<FontAwesomeIcon icon={faAddressCard} />}
            >
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
                  label={t('pages.admin.servers.tabs.general.page.form.owner', {})}
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
                  label={t('common.form.backupConfiguration', {})}
                  placeholder={t('pages.admin.servers.tabs.general.page.form.backupConfigurationPlaceholder', {})}
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
                  label={t('common.form.nest', {})}
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
                  label={t('pages.admin.servers.tabs.general.page.form.egg', {})}
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

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.resourceLimits', {})}
              icon={<FontAwesomeIcon icon={faStopwatch} />}
            >
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
                  label={t('pages.admin.servers.tabs.general.page.form.cpuLimit', {})}
                  description={t('pages.admin.servers.tabs.general.page.form.cpuLimitDescription', {})}
                  placeholder='100'
                  min={0}
                  key={form.key('limits.cpu')}
                  {...form.getInputProps('limits.cpu')}
                />
                <SizeInput
                  withAsterisk
                  label={t('pages.admin.servers.tabs.general.page.form.swap', {})}
                  description={t('pages.admin.servers.tabs.general.page.form.swapDescription', {})}
                  mode='mb'
                  min={-1}
                  value={form.getValues().limits.swap}
                  onChange={(value) => form.setFieldValue('limits.swap', value)}
                />

                <SizeInput
                  withAsterisk
                  label={t('common.form.memory', {})}
                  description={t('pages.admin.servers.tabs.general.page.form.memoryDescription', {})}
                  mode='mb'
                  min={0}
                  value={form.getValues().limits.memory}
                  onChange={(value) => form.setFieldValue('limits.memory', value)}
                />
                <SizeInput
                  withAsterisk
                  label={t('pages.admin.servers.tabs.general.page.form.memoryOverhead', {})}
                  description={t('pages.admin.servers.tabs.general.page.form.memoryOverheadDescription', {})}
                  mode='mb'
                  min={0}
                  value={form.getValues().limits.memoryOverhead}
                  onChange={(value) => form.setFieldValue('limits.memoryOverhead', value)}
                />

                <SizeInput
                  withAsterisk
                  label={t('pages.admin.servers.tabs.general.page.form.diskSpace', {})}
                  description={t('pages.admin.servers.tabs.general.page.form.diskSpaceDescription', {})}
                  mode='mb'
                  min={0}
                  value={form.getValues().limits.disk}
                  onChange={(value) => form.setFieldValue('limits.disk', value)}
                />
                <NumberInput
                  label={t('pages.admin.servers.tabs.general.page.form.ioWeight', {})}
                  description={t('pages.admin.servers.tabs.general.page.form.ioWeightDescription', {})}
                  key={form.key('limits.ioWeight')}
                  {...form.getInputProps('limits.ioWeight')}
                />
                <TagsInput
                  label={t('pages.admin.servers.tabs.general.page.form.pinnedCpus', {})}
                  description={t('pages.admin.servers.tabs.general.page.form.pinnedCpusDescription', {})}
                  placeholder='0'
                  allowReordering={false}
                  value={form.getValues().pinnedCpus.map(String)}
                  onChange={(tags) =>
                    form.setFieldValue(
                      'pinnedCpus',
                      tags.map((tag) => Number.parseInt(tag, 10)).filter((n) => Number.isInteger(n) && n >= 0),
                    )
                  }
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

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.serverConfiguration', {})}
              icon={<FontAwesomeIcon icon={faWrench} />}
            >
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
                  label={t('pages.admin.servers.tabs.general.page.form.predefinedDockerImages', {})}
                  placeholder={t('pages.admin.servers.tabs.general.page.form.predefinedDockerImagesPlaceholder', {})}
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
                  label={t('common.form.dockerImage', {})}
                  placeholder={t('pages.admin.servers.tabs.general.page.form.dockerImagePlaceholder', {})}
                  key={form.key('image')}
                  {...form.getInputProps('image')}
                />

                <Select
                  label={t('common.form.timezone', {})}
                  placeholder={t('common.form.timezoneSystem', {})}
                  data={timezones}
                  allowDeselect
                  clearable
                  searchable
                  key={form.key('timezone')}
                  {...form.getInputProps('timezone')}
                />

                <TextArea
                  label={t('common.form.startupCommand', {})}
                  placeholder={t('pages.admin.servers.tabs.general.page.form.startupCommandPlaceholder', {})}
                  className='col-span-full'
                  required
                  rows={2}
                  rightSection={
                    <Popover>
                      <Popover.Target>
                        <ActionIcon variant='subtle'>
                          <FontAwesomeIcon icon={faCog} />
                        </ActionIcon>
                      </Popover.Target>
                      <Popover.Dropdown>
                        <Select
                          data={[
                            {
                              label: t('pages.admin.servers.tabs.general.page.form.startupCommandCustom', {}),
                              value: '',
                            },
                            ...Object.entries(
                              eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid)?.startupCommands || {},
                            ).map(([key, value]) => ({
                              value,
                              label: key,
                            })),
                          ]}
                          value={
                            Object.values(
                              eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid)?.startupCommands || {},
                            ).find((value) => value === form.getValues().startup) || ''
                          }
                          onChange={(value) => form.setFieldValue('startup', value ?? '')}
                        />
                      </Popover.Dropdown>
                    </Popover>
                  }
                  key={form.key('startup')}
                  {...form.getInputProps('startup')}
                />

                <Switch
                  label={t('pages.admin.servers.tabs.general.page.form.hugepagesPassthroughEnabled', {})}
                  description={t(
                    'pages.admin.servers.tabs.general.page.form.hugepagesPassthroughEnabledDescription',
                    {},
                  )}
                  key={form.key('hugepagesPassthroughEnabled')}
                  {...form.getInputProps('hugepagesPassthroughEnabled', {
                    type: 'checkbox',
                  })}
                />

                <Switch
                  label={t('pages.admin.servers.tabs.general.page.form.kvmPassthroughEnabled', {})}
                  description={t('pages.admin.servers.tabs.general.page.form.kvmPassthroughEnabledDescription', {})}
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

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.featureLimits', {})}
              icon={<FontAwesomeIcon icon={faIcons} />}
            >
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
                  label={t('pages.admin.servers.tabs.general.page.form.allocationsLimit', {})}
                  placeholder='0'
                  min={0}
                  key={form.key('featureLimits.allocations')}
                  {...form.getInputProps('featureLimits.allocations')}
                />
                <NumberInput
                  withAsterisk
                  label={t('pages.admin.servers.tabs.general.page.form.databasesLimit', {})}
                  placeholder='0'
                  min={0}
                  key={form.key('featureLimits.databases')}
                  {...form.getInputProps('featureLimits.databases')}
                />
                <NumberInput
                  withAsterisk
                  label={t('pages.admin.servers.tabs.general.page.form.backupsLimit', {})}
                  placeholder='0'
                  min={0}
                  key={form.key('featureLimits.backups')}
                  {...form.getInputProps('featureLimits.backups')}
                />
                <NumberInput
                  withAsterisk
                  label={t('pages.admin.servers.tabs.general.page.form.schedulesLimit', {})}
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
                {t('common.button.save', {})}
              </Button>
            </AdminCan>
          </Group>
        </Stack>
      </form>
    </AdminSubContentContainer>
  );
}
