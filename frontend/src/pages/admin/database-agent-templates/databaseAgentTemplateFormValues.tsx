import { useMemo } from 'react';
import { z } from 'zod';
import { type FieldDef } from '@/elements/form-engine/index.ts';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import {
  adminDatabaseAgentTemplateCreateSchema,
  adminDatabaseAgentTemplateSchema,
  adminDatabaseAgentTemplateUpdateSchema,
} from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export type DatabaseAgentTemplateFormValues = z.infer<typeof adminDatabaseAgentTemplateUpdateSchema> &
  Partial<Pick<z.infer<typeof adminDatabaseAgentTemplateCreateSchema>, 'type'>>;

export const databaseAgentTemplateEmptyFormValues: DatabaseAgentTemplateFormValues = {
  name: '',
  description: null,
  type: 'postgres',
  deploymentEnabled: true,
  dockerImages: {},
  env: {},
  imageUid: 0,
  imageGid: 0,
  cmd: [],
  volumes: {},
  socketPath: '',
  memory: 0,
  swap: 0,
  disk: 0,
  ioWeight: null,
  cpu: 0,
};

export const databaseAgentTemplateToFormValues = (
  template: z.infer<typeof adminDatabaseAgentTemplateSchema>,
): DatabaseAgentTemplateFormValues => ({
  name: template.name,
  description: template.description,
  type: template.type,
  deploymentEnabled: template.deploymentEnabled,
  dockerImages: template.dockerImages,
  env: template.env,
  imageUid: template.imageUid,
  imageGid: template.imageGid,
  cmd: template.cmd ?? [],
  volumes: template.volumes,
  socketPath: template.socketPath,
  memory: template.memory,
  swap: template.swap,
  disk: template.disk,
  ioWeight: template.ioWeight,
  cpu: template.cpu,
});

export function useDatabaseAgentTemplateFormFields(isUpdate: boolean): FieldDef<DatabaseAgentTemplateFormValues>[] {
  const { t } = useTranslations();

  return useMemo(
    () => [
      { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
      {
        type: 'select',
        name: 'type',
        label: t('common.form.type', {}),
        required: true,
        options: Object.entries(databaseAgentTypeLabelMapping).map(([value, label]) => ({ value, label })),
        props: { disabled: isUpdate },
      },
      { type: 'textarea', name: 'description', label: t('common.form.description', {}), colSpan: 'full' },
      {
        type: 'custom',
        name: 'dockerImages',
        colSpan: 'full',
        render: (f) => (
          <MultiKeyValueInput
            label={t('pages.admin.databaseAgentTemplates.tabs.general.page.form.dockerImages', {})}
            withAsterisk
            options={f.getValues().dockerImages ?? {}}
            onChange={(e) => f.setFieldValue('dockerImages', e)}
          />
        ),
      },
      {
        type: 'custom',
        name: 'env',
        colSpan: 'full',
        render: (f) => (
          <MultiKeyValueInput
            label={t('pages.admin.databaseAgentTemplates.tabs.general.page.form.env', {})}
            options={f.getValues().env ?? {}}
            onChange={(e) => f.setFieldValue('env', e)}
          />
        ),
      },
      {
        type: 'custom',
        name: 'volumes',
        colSpan: 'full',
        render: (f) => (
          <MultiKeyValueInput
            label={t('pages.admin.databaseAgentTemplates.tabs.general.page.form.volumes', {})}
            options={f.getValues().volumes ?? {}}
            onChange={(e) => f.setFieldValue('volumes', e)}
          />
        ),
      },
      {
        type: 'text',
        name: 'socketPath',
        label: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.socketPath', {}),
        required: true,
        description: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.socketPathDescription', {}),
        colSpan: 'full',
      },
      {
        type: 'number',
        name: 'imageUid',
        label: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.imageUid', {}),
        required: true,
      },
      {
        type: 'number',
        name: 'imageGid',
        label: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.imageGid', {}),
        required: true,
      },
      {
        type: 'tags',
        name: 'cmd',
        label: t('common.form.command', {}),
        colSpan: 'full',
        advanced: true,
      },
      {
        type: 'size',
        name: 'memory',
        label: t('common.form.memory', {}),
        required: true,
        description: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.memoryDescription', {}),
        tooltip: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.memoryTooltip', {}),
        mode: 'mb',
        min: 0,
      },
      {
        type: 'size',
        name: 'swap',
        label: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.swap', {}),
        required: true,
        description: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.swapDescription', {}),
        tooltip: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.swapTooltip', {}),
        mode: 'mb',
        min: -1,
      },
      {
        type: 'size',
        name: 'disk',
        label: t('common.form.disk', {}),
        required: true,
        description: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.diskDescription', {}),
        tooltip: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.diskTooltip', {}),
        mode: 'mb',
        min: 0,
      },
      {
        type: 'number',
        name: 'cpu',
        label: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.cpu', {}),
        required: true,
        description: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.cpuDescription', {}),
        tooltip: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.cpuTooltip', {}),
      },
      {
        type: 'number',
        name: 'ioWeight',
        label: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.ioWeight', {}),
        description: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.ioWeightDescription', {}),
        tooltip: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.ioWeightTooltip', {}),
        advanced: true,
      },
      { type: 'switch', name: 'deploymentEnabled', label: t('common.form.deploymentEnabled', {}) },
    ],
    [t, isUpdate],
  );
}
