import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createDatabaseAgentTemplate from '@/api/admin/database-agent-templates/createDatabaseAgentTemplate.ts';
import deleteDatabaseAgentTemplate from '@/api/admin/database-agent-templates/deleteDatabaseAgentTemplate.ts';
import updateDatabaseAgentTemplate from '@/api/admin/database-agent-templates/updateDatabaseAgentTemplate.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import MultiKeyValueInput from '@/elements/input/MultiKeyValueInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminDatabaseAgentTemplateCreateSchema,
  adminDatabaseAgentTemplateSchema,
  adminDatabaseAgentTemplateUpdateSchema,
} from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type DatabaseAgentTemplateFormValues = z.infer<typeof adminDatabaseAgentTemplateUpdateSchema>;

export default function DatabaseAgentTemplateCreateOrUpdate({
  contextDatabaseAgentTemplate,
}: {
  contextDatabaseAgentTemplate?: z.infer<typeof adminDatabaseAgentTemplateSchema>;
}) {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<DatabaseAgentTemplateFormValues>('admin.databaseAgentTemplates.createOrUpdate');
  const mergedSchema = (
    contextDatabaseAgentTemplate ? adminDatabaseAgentTemplateUpdateSchema : adminDatabaseAgentTemplateCreateSchema
  )
    .unwrap()
    .extend(zodShape);

  const form = useForm<DatabaseAgentTemplateFormValues>({
    initialValues: {
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
      memory: 0,
      swap: 0,
      disk: 0,
      ioWeight: null,
      cpu: 0,
      ...(extInitialValues as Partial<DatabaseAgentTemplateFormValues>),
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    DatabaseAgentTemplateFormValues,
    z.infer<typeof adminDatabaseAgentTemplateSchema>
  >({
    form,
    createFn: () => createDatabaseAgentTemplate(adminDatabaseAgentTemplateCreateSchema.parse(form.getValues())),
    updateFn: contextDatabaseAgentTemplate
      ? () =>
          updateDatabaseAgentTemplate(
            contextDatabaseAgentTemplate.uuid,
            adminDatabaseAgentTemplateUpdateSchema.parse(form.getValues()),
          )
      : undefined,
    deleteFn: contextDatabaseAgentTemplate
      ? () => deleteDatabaseAgentTemplate(contextDatabaseAgentTemplate.uuid)
      : undefined,
    doUpdate: !!contextDatabaseAgentTemplate,
    basePath: '/admin/database-agent-templates',
    resourceName: t('pages.admin.databaseAgentTemplates.resourceName', {}),
  });

  useEffect(() => {
    if (contextDatabaseAgentTemplate) {
      form.setValues({
        name: contextDatabaseAgentTemplate.name,
        description: contextDatabaseAgentTemplate.description,
        type: contextDatabaseAgentTemplate.type,
        deploymentEnabled: contextDatabaseAgentTemplate.deploymentEnabled,
        dockerImages: contextDatabaseAgentTemplate.dockerImages,
        env: contextDatabaseAgentTemplate.env,
        imageUid: contextDatabaseAgentTemplate.imageUid,
        imageGid: contextDatabaseAgentTemplate.imageGid,
        cmd: contextDatabaseAgentTemplate.cmd ?? [],
        volumes: contextDatabaseAgentTemplate.volumes,
        memory: contextDatabaseAgentTemplate.memory,
        swap: contextDatabaseAgentTemplate.swap,
        disk: contextDatabaseAgentTemplate.disk,
        ioWeight: contextDatabaseAgentTemplate.ioWeight,
        cpu: contextDatabaseAgentTemplate.cpu,
      });
    }
  }, [contextDatabaseAgentTemplate]);

  const fields: FieldDef<DatabaseAgentTemplateFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'type',
      label: t('common.form.type', {}),
      required: true,
      options: Object.entries(databaseAgentTypeLabelMapping).map(([value, label]) => ({ value, label })),
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
      label: t('pages.admin.databaseAgentTemplates.tabs.general.page.form.cmd', {}),
      colSpan: 'full',
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
    },
    { type: 'switch', name: 'deploymentEnabled', label: t('common.form.deploymentEnabled', {}) },
  ];

  return (
    <AdminContentContainer
      title={
        contextDatabaseAgentTemplate
          ? t('pages.admin.databaseAgentTemplates.tabs.general.page.titleUpdate', {})
          : t('pages.admin.databaseAgentTemplates.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextDatabaseAgentTemplate}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.databaseAgentTemplates.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.databaseAgentTemplates.tabs.general.page.modal.delete.content', {
          name: form.getValues().name ?? '',
        }).md()}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.databaseAgentTemplates.all()))}>
        <FormEngine form={form} fields={fields} extensions={[formExtension]} />

        <Group mt='md'>
          <AdminCan
            action={
              contextDatabaseAgentTemplate ? 'database-agent-templates.update' : 'database-agent-templates.create'
            }
            cantSave
          >
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextDatabaseAgentTemplate && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextDatabaseAgentTemplate && (
            <AdminCan action='database-agent-templates.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
