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
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import Popover from '@/elements/Popover.tsx';
import Stack from '@/elements/Stack.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { adminServerSchema, adminServerUpdateSchema } from '@/lib/schemas/admin/servers.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
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

type ServerUpdateFormValues = z.infer<typeof adminServerUpdateSchema>;

export default function ServerUpdate({ contextServer }: { contextServer: z.infer<typeof adminServerSchema> }) {
  const { t } = useTranslations();
  const canReadUsers = useAdminCan('users.read');
  const canReadNests = useAdminCan('nests.read');
  const canReadEggs = useAdminCan('eggs.read');
  const canReadBackupConfigurations = useAdminCan('backup-configurations.read');

  const [isValid, setIsValid] = useState(false);
  const [selectedNestUuid, setSelectedNestUuid] = useState<string | null>(contextServer?.nest.uuid ?? '');

  const form = useForm<ServerUpdateFormValues>({
    mode: 'uncontrolled',
    initialValues: {
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
    onValuesChange: () => setIsValid(form.isValid()),
    validateInputOnBlur: true,
    validate: zod4Resolver(adminServerUpdateSchema),
  });

  const { loading, doCreateOrUpdate } = useResourceForm<ServerUpdateFormValues, z.infer<typeof adminServerSchema>>({
    form,
    updateFn: () => updateServer(contextServer.uuid, form.getValues()),
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

  const basicInfoFields: FieldDef<ServerUpdateFormValues>[] = [
    {
      type: 'text',
      name: 'name',
      label: t('common.form.serverName', {}),
      required: true,
      props: { placeholder: t('pages.admin.servers.tabs.general.page.form.serverNamePlaceholder', {}) },
    },
    {
      type: 'text',
      name: 'externalId',
      label: t('common.form.externalId', {}),
      props: { placeholder: t('pages.admin.servers.tabs.general.page.form.externalIdPlaceholder', {}) },
    },
    {
      type: 'textarea',
      name: 'description',
      label: t('common.form.description', {}),
      colSpan: 'full',
      rows: 3,
      props: { placeholder: t('pages.admin.servers.tabs.general.page.form.descriptionPlaceholder', {}) },
    },
  ];

  const serverAssignmentFields: FieldDef<ServerUpdateFormValues>[] = [
    {
      type: 'select',
      name: 'ownerUuid',
      label: t('pages.admin.servers.tabs.general.page.form.owner', {}),
      required: true,
      options: users.items.map((user) => ({ label: user.username, value: user.uuid })),
      props: {
        searchable: true,
        searchValue: users.search,
        onSearchChange: users.setSearch,
        disabled: !canReadUsers,
        loading: users.loading,
      },
    },
    {
      type: 'select',
      name: 'backupConfigurationUuid',
      label: t('common.form.backupConfiguration', {}),
      options: backupConfigurations.items.map((bc) => ({ label: bc.name, value: bc.uuid })),
      props: {
        placeholder: t('pages.admin.servers.tabs.general.page.form.backupConfigurationPlaceholder', {}),
        searchable: true,
        searchValue: backupConfigurations.search,
        onSearchChange: backupConfigurations.setSearch,
        allowDeselect: true,
        clearable: true,
        disabled: !canReadBackupConfigurations,
        loading: backupConfigurations.loading,
      },
    },
    {
      type: 'custom',
      name: '_nestSelect',
      render: () => (
        <Select
          withAsterisk
          label={t('common.form.nest', {})}
          value={selectedNestUuid}
          onChange={(value) => setSelectedNestUuid(value)}
          data={nests.items.map((nest) => ({ label: nest.name, value: nest.uuid }))}
          searchable
          searchValue={nests.search}
          onSearchChange={nests.setSearch}
          disabled={!canReadNests}
          loading={nests.loading}
        />
      ),
    },
    {
      type: 'select',
      name: 'eggUuid',
      label: t('pages.admin.servers.tabs.general.page.form.egg', {}),
      required: true,
      options: eggs.items.map((egg) => ({ label: egg.name, value: egg.uuid })),
      props: {
        searchable: true,
        searchValue: eggs.search,
        onSearchChange: eggs.setSearch,
        loading: eggs.loading,
        disabled: !canReadEggs || !selectedNestUuid,
      },
    },
  ];

  const resourceLimitsFields: FieldDef<ServerUpdateFormValues>[] = [
    {
      type: 'number',
      name: 'limits.cpu',
      label: t('pages.admin.servers.tabs.general.page.form.cpuLimit', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.cpuLimitDescription', {}),
      props: { placeholder: '100', min: 0 },
    },
    {
      type: 'size',
      name: 'limits.swap',
      label: t('pages.admin.servers.tabs.general.page.form.swap', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.swapDescription', {}),
      mode: 'mb',
      min: -1,
    },
    {
      type: 'size',
      name: 'limits.memory',
      label: t('common.form.memory', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.memoryDescription', {}),
      mode: 'mb',
      min: 0,
    },
    {
      type: 'size',
      name: 'limits.memoryOverhead',
      label: t('pages.admin.servers.tabs.general.page.form.memoryOverhead', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.memoryOverheadDescription', {}),
      mode: 'mb',
      min: 0,
    },
    {
      type: 'size',
      name: 'limits.disk',
      label: t('pages.admin.servers.tabs.general.page.form.diskSpace', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.diskSpaceDescription', {}),
      mode: 'mb',
      min: 0,
    },
    {
      type: 'number',
      name: 'limits.ioWeight',
      label: t('pages.admin.servers.tabs.general.page.form.ioWeight', {}),
      description: t('pages.admin.servers.tabs.general.page.form.ioWeightDescription', {}),
    },
    {
      type: 'tags',
      name: 'pinnedCpus',
      label: t('pages.admin.servers.tabs.general.page.form.pinnedCpus', {}),
      description: t('pages.admin.servers.tabs.general.page.form.pinnedCpusDescription', {}),
      placeholder: '0',
      allowReordering: false,
    },
  ];

  const serverConfigFields: FieldDef<ServerUpdateFormValues>[] = [
    {
      type: 'custom',
      name: '_predefinedImage',
      render: (f) => (
        <Select
          label={t('pages.admin.servers.tabs.general.page.form.predefinedDockerImages', {})}
          placeholder={t('pages.admin.servers.tabs.general.page.form.predefinedDockerImagesPlaceholder', {})}
          data={Object.entries(eggImages).map(([label, value]) => ({ label, value }))}
          allowDeselect
          clearable
          searchable
          value={
            Object.entries(eggImages).some(([, value]) => value === form.getValues().image)
              ? form.getValues().image
              : null
          }
          onChange={(value) => f.setFieldValue('image', value || '')}
        />
      ),
    },
    {
      type: 'text',
      name: 'image',
      label: t('common.form.dockerImage', {}),
      required: true,
      props: { placeholder: t('pages.admin.servers.tabs.general.page.form.dockerImagePlaceholder', {}) },
    },
    {
      type: 'select',
      name: 'timezone',
      label: t('common.form.timezone', {}),
      options: timezones,
      props: {
        placeholder: t('common.form.timezoneSystem', {}),
        searchable: true,
        allowDeselect: true,
        clearable: true,
      },
    },
    {
      type: 'custom',
      name: 'startup',
      colSpan: 'full',
      render: (f) => (
        <TextArea
          label={t('common.form.startupCommand', {})}
          placeholder={t('pages.admin.servers.tabs.general.page.form.startupCommandPlaceholder', {})}
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
                    ).map(([key, value]) => ({ value, label: key })),
                  ]}
                  value={
                    Object.values(
                      eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid)?.startupCommands || {},
                    ).find((value) => value === form.getValues().startup) || ''
                  }
                  onChange={(value) => f.setFieldValue('startup', value ?? '')}
                />
              </Popover.Dropdown>
            </Popover>
          }
          key={f.key('startup')}
          {...f.getInputProps('startup')}
        />
      ),
    },
    {
      type: 'switch',
      name: 'hugepagesPassthroughEnabled',
      label: t('pages.admin.servers.tabs.general.page.form.hugepagesPassthroughEnabled', {}),
      description: t('pages.admin.servers.tabs.general.page.form.hugepagesPassthroughEnabledDescription', {}),
    },
    {
      type: 'switch',
      name: 'kvmPassthroughEnabled',
      label: t('pages.admin.servers.tabs.general.page.form.kvmPassthroughEnabled', {}),
      description: t('pages.admin.servers.tabs.general.page.form.kvmPassthroughEnabledDescription', {}),
    },
  ];

  const featureLimitsFields: FieldDef<ServerUpdateFormValues>[] = [
    {
      type: 'number',
      name: 'featureLimits.allocations',
      label: t('pages.admin.servers.tabs.general.page.form.allocationsLimit', {}),
      required: true,
      props: { placeholder: '0', min: 0 },
    },
    {
      type: 'number',
      name: 'featureLimits.databases',
      label: t('pages.admin.servers.tabs.general.page.form.databasesLimit', {}),
      required: true,
      props: { placeholder: '0', min: 0 },
    },
    {
      type: 'number',
      name: 'featureLimits.backups',
      label: t('pages.admin.servers.tabs.general.page.form.backupsLimit', {}),
      required: true,
      props: { placeholder: '0', min: 0 },
    },
    {
      type: 'number',
      name: 'featureLimits.schedules',
      label: t('pages.admin.servers.tabs.general.page.form.schedulesLimit', {}),
      required: true,
      props: { placeholder: '0', min: 0 },
    },
  ];

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
            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.basicInformation', {})}
              icon={<FontAwesomeIcon icon={faInfoCircle} />}
            >
              <FormEngine form={form} fields={basicInfoFields} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.serverAssignment', {})}
              icon={<FontAwesomeIcon icon={faAddressCard} />}
            >
              <FormEngine form={form} fields={serverAssignmentFields} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.resourceLimits', {})}
              icon={<FontAwesomeIcon icon={faStopwatch} />}
            >
              <FormEngine form={form} fields={resourceLimitsFields} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.serverConfiguration', {})}
              icon={<FontAwesomeIcon icon={faWrench} />}
            >
              <FormEngine form={form} fields={serverConfigFields} />
            </TitleCard>

            <TitleCard
              title={t('pages.admin.servers.tabs.general.page.card.featureLimits', {})}
              icon={<FontAwesomeIcon icon={faIcons} />}
            >
              <FormEngine form={form} fields={featureLimitsFields} />
            </TitleCard>
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
