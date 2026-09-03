import { UseFormReturnType } from '@mantine/form';
import { useEffect, useMemo } from 'react';
import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import { getTimezoneOptions } from '@/lib/format/timezones.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { AdminServer, AdminServerCreate, AdminServerUpdate } from '@/lib/schemas/admin/servers.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type TFunc = ReturnType<typeof useTranslations>['t'];
type ServerCreateFormValues = AdminServerCreate;
type ServerUpdateFormValues = AdminServerUpdate;
type SearchableResource<T> = ReturnType<typeof useSearchableResource<T>>;

export type ServerFormMode = 'create' | 'update';

const timezones = getTimezoneOptions();

const baseServerFormValues = {
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
} satisfies Partial<ServerCreateFormValues> & Partial<ServerUpdateFormValues>;

export const serverCreateEmptyFormValues: ServerCreateFormValues = {
  ...baseServerFormValues,
  startOnCompletion: true,
  skipInstaller: false,
  nodeUuid: '',
  allocationUuid: null,
  allocationUuids: [],
  variables: [],
};

export const serverUpdateEmptyFormValues: ServerUpdateFormValues = {
  ...baseServerFormValues,
};

export const serverToFormValues = (server: AdminServer): Partial<ServerUpdateFormValues> => ({
  ownerUuid: server.owner.uuid,
  eggUuid: server.egg.uuid,
  backupConfigurationUuid: server.backupConfiguration?.uuid ?? null,
  externalId: server.externalId,
  name: server.name,
  description: server.description,
  limits: server.limits,
  pinnedCpus: server.pinnedCpus,
  startup: server.startup,
  image: server.image,
  timezone: server.timezone,
  hugepagesPassthroughEnabled: server.hugepagesPassthroughEnabled,
  kvmPassthroughEnabled: server.kvmPassthroughEnabled,
  featureLimits: server.featureLimits,
});

interface ServerEggAssignmentFormValues extends Record<string, unknown> {
  eggUuid: string;
  startup: string;
}

export function useEggDefaults<T extends ServerEggAssignmentFormValues>(
  form: UseFormReturnType<T>,
  eggs: SearchableResource<z.infer<typeof adminEggSchema>>,
  selectedEggUuid: string,
  { skip = false }: { skip?: boolean } = {},
) {
  useEffect(() => {
    if (!selectedEggUuid || skip) {
      return;
    }

    const egg = eggs.items.find((e) => e.uuid === selectedEggUuid);
    if (!egg) {
      return;
    }

    form.setFieldValue('image', (Object.values(egg.dockerImages)[0] ?? '') as never);
    form.setFieldValue(
      'startup',
      (egg.startupCommands['Default'] || Object.values(egg.startupCommands)[0] || '') as never,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEggUuid, skip]);
}

function buildBasicInfoFields<T extends Record<string, unknown>>(t: TFunc): FieldDef<T>[] {
  return [
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
}

function buildFeatureLimitsFields<T extends Record<string, unknown>>(t: TFunc): FieldDef<T>[] {
  return [
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
}

function buildResourceLimitsFields<T extends Record<string, unknown>>(
  t: TFunc,
  { swapAdvanced }: { swapAdvanced?: boolean } = {},
): FieldDef<T>[] {
  return [
    {
      type: 'number',
      name: 'limits.cpu',
      label: t('pages.admin.servers.tabs.general.page.form.cpuLimit', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.cpuLimitDescription', {}),
      tooltip: t('pages.admin.servers.tabs.general.page.form.cpuLimitTooltip', {}),
      props: { placeholder: '100', min: 0 },
    },
    {
      type: 'size',
      name: 'limits.swap',
      label: t('pages.admin.servers.tabs.general.page.form.swap', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.swapDescription', {}),
      tooltip: t('pages.admin.servers.tabs.general.page.form.swapTooltip', {}),
      mode: 'mb',
      min: -1,
      advanced: swapAdvanced,
    },
    {
      type: 'size',
      name: 'limits.memory',
      label: t('common.form.memory', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.memoryDescription', {}),
      tooltip: t('pages.admin.servers.tabs.general.page.form.memoryTooltip', {}),
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
      advanced: true,
    },
    {
      type: 'size',
      name: 'limits.disk',
      label: t('pages.admin.servers.tabs.general.page.form.diskSpace', {}),
      required: true,
      description: t('pages.admin.servers.tabs.general.page.form.diskSpaceDescription', {}),
      tooltip: t('pages.admin.servers.tabs.general.page.form.diskSpaceTooltip', {}),
      mode: 'mb',
      min: 0,
    },
    {
      type: 'number',
      name: 'limits.ioWeight',
      label: t('pages.admin.servers.tabs.general.page.form.ioWeight', {}),
      description: t('pages.admin.servers.tabs.general.page.form.ioWeightDescription', {}),
      tooltip: t('pages.admin.servers.tabs.general.page.form.ioWeightTooltip', {}),
      advanced: true,
    },
    {
      type: 'numberTags',
      name: 'pinnedCpus',
      label: t('pages.admin.servers.tabs.general.page.form.pinnedCpus', {}),
      description: t('pages.admin.servers.tabs.general.page.form.pinnedCpusDescription', {}),
      tooltip: t('pages.admin.servers.tabs.general.page.form.pinnedCpusTooltip', {}),
      placeholder: '0',
      allowReordering: false,
      advanced: true,
    },
  ];
}

function buildNestSelectField<T extends ServerEggAssignmentFormValues>(
  t: TFunc,
  {
    form,
    selectedNestUuid,
    setSelectedNestUuid,
    nests,
    canReadNests,
  }: {
    form: UseFormReturnType<T>;
    selectedNestUuid: string | null;
    setSelectedNestUuid: (uuid: string | null) => void;
    nests: SearchableResource<z.infer<typeof adminNestSchema>>;
    canReadNests: boolean;
  },
): FieldDef<T> {
  return {
    type: 'custom',
    name: '_nestSelect',
    render: () => (
      <Select
        withAsterisk
        label={t('common.form.nest', {})}
        value={selectedNestUuid}
        onChange={(value) => {
          setSelectedNestUuid(value);
          form.setFieldValue('eggUuid', '' as never);
        }}
        data={nests.items.map((nest) => ({ label: nest.name, value: nest.uuid }))}
        searchable
        searchValue={nests.search}
        onSearchChange={nests.setSearch}
        disabled={!canReadNests}
        loading={nests.loading}
      />
    ),
  };
}

function buildStartupField<T extends ServerEggAssignmentFormValues>(
  t: TFunc,
  {
    form,
    eggs,
  }: {
    form: UseFormReturnType<T>;
    eggs: SearchableResource<z.infer<typeof adminEggSchema>>;
  },
): FieldDef<T> {
  return {
    type: 'custom',
    name: 'startup',
    colSpan: 'full',
    render: () => {
      const startupCommands = eggs.items.find((egg) => egg.uuid === form.getValues().eggUuid)?.startupCommands || {};

      return (
        <>
          {Object.keys(startupCommands).length > 0 && (
            <Select
              label={t('pages.admin.servers.tabs.general.page.form.predefinedStartupCommands', {})}
              className='col-span-full'
              data={[
                {
                  label: t('pages.admin.servers.tabs.general.page.form.startupCommandCustom', {}),
                  value: '',
                },
                ...Object.entries(startupCommands).map(([key, value]) => ({
                  value,
                  label: key,
                })),
              ]}
              value={Object.values(startupCommands).find((value) => value === form.getValues().startup) || ''}
              onChange={(value) => form.setFieldValue('startup', (value ?? '') as never)}
            />
          )}
          <TextArea
            label={t('common.form.startupCommand', {})}
            placeholder='npm start'
            className='col-span-full'
            required
            rows={2}
            key={form.key('startup')}
            {...form.getInputProps('startup')}
          />
        </>
      );
    },
  };
}

function buildPredefinedImageField<T extends Record<string, unknown>>(
  t: TFunc,
  { form, eggImages }: { form: UseFormReturnType<T>; eggImages: Record<string, string> },
): FieldDef<T> {
  return {
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
            ? (form.getValues().image as string)
            : null
        }
        onChange={(value) => f.setFieldValue('image', (value || '') as never)}
      />
    ),
  };
}

interface ServerAssignmentOptions<T extends ServerEggAssignmentFormValues> {
  mode: ServerFormMode;
  form: UseFormReturnType<T>;
  nodes?: SearchableResource<z.infer<typeof adminNodeSchema>>;
  users: SearchableResource<z.infer<typeof fullUserSchema>>;
  nests: SearchableResource<z.infer<typeof adminNestSchema>>;
  eggs: SearchableResource<z.infer<typeof adminEggSchema>>;
  backupConfigurations: SearchableResource<z.infer<typeof adminBackupConfigurationSchema>>;
  canReadNodes?: boolean;
  canReadUsers: boolean;
  canReadNests: boolean;
  canReadEggs: boolean;
  canReadBackupConfigurations: boolean;
  selectedNestUuid: string | null;
  setSelectedNestUuid: (uuid: string | null) => void;
}

function buildServerAssignmentFields<T extends ServerEggAssignmentFormValues>(
  t: TFunc,
  opts: ServerAssignmentOptions<T>,
): FieldDef<T>[] {
  const {
    mode,
    form,
    nodes,
    users,
    nests,
    eggs,
    backupConfigurations,
    canReadNodes,
    canReadUsers,
    canReadNests,
    canReadEggs,
    canReadBackupConfigurations,
    selectedNestUuid,
    setSelectedNestUuid,
  } = opts;

  const nodeField: FieldDef<T> = {
    type: 'select',
    name: 'nodeUuid',
    label: t('common.form.node', {}),
    required: true,
    options: (nodes?.items ?? []).map((node) => ({ label: node.name, value: node.uuid })),
    props: {
      searchable: true,
      searchValue: nodes?.search,
      onSearchChange: nodes?.setSearch,
      disabled: !canReadNodes,
      loading: nodes?.loading,
    },
  };

  const ownerField: FieldDef<T> = {
    type: 'select',
    name: 'ownerUuid',
    label: t('pages.admin.servers.tabs.general.page.form.owner', {}),
    required: true,
    options: users.items.map((user) => ({ label: user.username, value: user.uuid })),
    props: {
      searchable: true,
      searchValue: users.search,
      onSearchChange: users.setSearch,
      loading: users.loading,
      disabled: !canReadUsers,
    },
  };

  const nestField = buildNestSelectField<T>(t, { form, selectedNestUuid, setSelectedNestUuid, nests, canReadNests });

  const eggField: FieldDef<T> = {
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
  };

  const backupConfigField: FieldDef<T> = {
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
  };

  return mode === 'create'
    ? [nodeField, ownerField, nestField, eggField, backupConfigField]
    : [ownerField, backupConfigField, nestField, eggField];
}

function buildServerConfigFields<T extends ServerEggAssignmentFormValues>(
  t: TFunc,
  {
    mode,
    form,
    eggs,
    eggImages,
  }: {
    mode: ServerFormMode;
    form: UseFormReturnType<T>;
    eggs: SearchableResource<z.infer<typeof adminEggSchema>>;
    eggImages: Record<string, string>;
  },
): FieldDef<T>[] {
  const timezoneField: FieldDef<T> =
    mode === 'create'
      ? {
          type: 'select',
          name: 'timezone',
          label: t('common.form.timezone', {}),
          options: [{ label: t('common.form.timezoneSystem', {}), value: '' }, ...timezones],
          props: {
            placeholder: 'Europe/Amsterdam',
            searchable: true,
          },
        }
      : {
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
        };

  const createOnlyFields: FieldDef<T>[] =
    mode === 'create'
      ? [
          {
            type: 'switch',
            name: 'startOnCompletion',
            label: t('pages.admin.servers.tabs.general.page.form.startOnCompletion', {}),
            description: t('pages.admin.servers.tabs.general.page.form.startOnCompletionDescription', {}),
          },
          {
            type: 'switch',
            name: 'skipInstaller',
            label: t('pages.admin.servers.tabs.general.page.form.skipInstaller', {}),
            description: t('pages.admin.servers.tabs.general.page.form.skipInstallerDescription', {}),
          },
        ]
      : [];

  return [
    buildPredefinedImageField<T>(t, { form, eggImages }),
    {
      type: 'text',
      name: 'image',
      label: t('common.form.dockerImage', {}),
      required: true,
      props: { placeholder: 'ghcr.io/...' },
    },
    timezoneField,
    buildStartupField<T>(t, { form, eggs }),
    ...createOnlyFields,
    {
      type: 'switch',
      name: 'hugepagesPassthroughEnabled',
      label: t('pages.admin.servers.tabs.general.page.form.hugepagesPassthroughEnabled', {}),
      description: t('pages.admin.servers.tabs.general.page.form.hugepagesPassthroughEnabledDescription', {}),
      advanced: true,
    },
    {
      type: 'switch',
      name: 'kvmPassthroughEnabled',
      label: t('pages.admin.servers.tabs.general.page.form.kvmPassthroughEnabled', {}),
      description: t('pages.admin.servers.tabs.general.page.form.kvmPassthroughEnabledDescription', {}),
      advanced: true,
    },
  ];
}

export interface ServerFormFieldsOptions<T extends ServerEggAssignmentFormValues> {
  mode: ServerFormMode;
  form: UseFormReturnType<T>;
  nodes?: SearchableResource<z.infer<typeof adminNodeSchema>>;
  users: SearchableResource<z.infer<typeof fullUserSchema>>;
  nests: SearchableResource<z.infer<typeof adminNestSchema>>;
  eggs: SearchableResource<z.infer<typeof adminEggSchema>>;
  backupConfigurations: SearchableResource<z.infer<typeof adminBackupConfigurationSchema>>;
  canReadNodes?: boolean;
  canReadUsers: boolean;
  canReadNests: boolean;
  canReadEggs: boolean;
  canReadBackupConfigurations: boolean;
  selectedNestUuid: string | null;
  setSelectedNestUuid: (uuid: string | null) => void;
  eggImages: Record<string, string>;
}

export function useServerFormFields<T extends ServerEggAssignmentFormValues>(opts: ServerFormFieldsOptions<T>) {
  const { t } = useTranslations();
  const {
    mode,
    form,
    nodes,
    users,
    nests,
    eggs,
    backupConfigurations,
    canReadNodes,
    canReadUsers,
    canReadNests,
    canReadEggs,
    canReadBackupConfigurations,
    selectedNestUuid,
    setSelectedNestUuid,
    eggImages,
  } = opts;

  const basicInfoFields = useMemo(() => buildBasicInfoFields<T>(t), [t]);
  const featureLimitsFields = useMemo(() => buildFeatureLimitsFields<T>(t), [t]);
  const resourceLimitsFields = useMemo(
    () => buildResourceLimitsFields<T>(t, { swapAdvanced: mode === 'create' }),
    [t, mode],
  );

  const serverAssignmentFields = useMemo(
    () =>
      buildServerAssignmentFields<T>(t, {
        mode,
        form,
        nodes,
        users,
        nests,
        eggs,
        backupConfigurations,
        canReadNodes,
        canReadUsers,
        canReadNests,
        canReadEggs,
        canReadBackupConfigurations,
        selectedNestUuid,
        setSelectedNestUuid,
      }),
    [
      t,
      mode,
      form,
      nodes,
      users,
      nests,
      eggs,
      backupConfigurations,
      canReadNodes,
      canReadUsers,
      canReadNests,
      canReadEggs,
      canReadBackupConfigurations,
      selectedNestUuid,
      setSelectedNestUuid,
    ],
  );

  const serverConfigFields = useMemo(
    () => buildServerConfigFields<T>(t, { mode, form, eggs, eggImages }),
    [t, mode, form, eggs, eggImages],
  );

  return { basicInfoFields, serverAssignmentFields, resourceLimitsFields, serverConfigFields, featureLimitsFields };
}
