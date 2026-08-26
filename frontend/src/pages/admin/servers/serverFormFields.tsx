import { UseFormReturnType } from '@mantine/form';
import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type TFunc = ReturnType<typeof useTranslations>['t'];

export function buildBasicInfoFields<T extends Record<string, unknown>>(t: TFunc): FieldDef<T>[] {
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

export function buildFeatureLimitsFields<T extends Record<string, unknown>>(t: TFunc): FieldDef<T>[] {
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

export function buildResourceLimitsFields<T extends Record<string, unknown>>(
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

interface ServerEggAssignmentFormValues extends Record<string, unknown> {
  eggUuid: string;
  startup: string;
}

export function buildNestSelectField<T extends ServerEggAssignmentFormValues>(
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
    nests: ReturnType<typeof useSearchableResource<z.infer<typeof adminNestSchema>>>;
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

export function buildStartupField<T extends ServerEggAssignmentFormValues>(
  t: TFunc,
  {
    form,
    eggs,
  }: {
    form: UseFormReturnType<T>;
    eggs: ReturnType<typeof useSearchableResource<z.infer<typeof adminEggSchema>>>;
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
