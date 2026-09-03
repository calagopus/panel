import { faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import createDatabaseAgentTemplate from '@/api/admin/database-agent-templates/createDatabaseAgentTemplate.ts';
import deleteDatabaseAgentTemplate from '@/api/admin/database-agent-templates/deleteDatabaseAgentTemplate.ts';
import duplicateDatabaseAgentTemplate from '@/api/admin/database-agent-templates/duplicateDatabaseAgentTemplate.ts';
import updateDatabaseAgentTemplate from '@/api/admin/database-agent-templates/updateDatabaseAgentTemplate.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import { AdvancedModeToggle, FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ResourceDuplicateModal from '@/elements/modals/ResourceDuplicateModal.tsx';
import ResourceExportMenu from '@/elements/ResourceExportMenu.tsx';
import Anchor from '@/elements/typography/Anchor.tsx';
import { downloadResourceFile, type ResourceExportFormat } from '@/lib/download/export.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminDatabaseAgentTemplateCreateSchema,
  adminDatabaseAgentTemplateSchema,
  adminDatabaseAgentTemplateUpdateSchema,
} from '@/lib/schemas/admin/databaseAgentTemplates.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  type DatabaseAgentTemplateFormValues,
  databaseAgentTemplateEmptyFormValues,
  databaseAgentTemplateToFormValues,
  useDatabaseAgentTemplateFormFields,
} from './databaseAgentTemplateFormValues.tsx';

export default function DatabaseAgentTemplateCreateOrUpdate({
  contextDatabaseAgentTemplate,
}: {
  contextDatabaseAgentTemplate?: z.infer<typeof adminDatabaseAgentTemplateSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const form = useFormEngine<DatabaseAgentTemplateFormValues>('admin.databaseAgentTemplates.createOrUpdate', {
    schema: (contextDatabaseAgentTemplate
      ? adminDatabaseAgentTemplateUpdateSchema
      : adminDatabaseAgentTemplateCreateSchema
    ).unwrap(),
    initialValues: databaseAgentTemplateEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    DatabaseAgentTemplateFormValues,
    z.infer<typeof adminDatabaseAgentTemplateSchema>
  >({
    form,
    createFn: () =>
      adminDatabaseAgentTemplateCreateSchema.parseAsync(form.getValues()).then(createDatabaseAgentTemplate),
    updateFn: contextDatabaseAgentTemplate
      ? () =>
          adminDatabaseAgentTemplateUpdateSchema
            .parseAsync(form.getValues())
            .then((values) => updateDatabaseAgentTemplate(contextDatabaseAgentTemplate.uuid, values))
      : undefined,
    deleteFn: contextDatabaseAgentTemplate
      ? () => deleteDatabaseAgentTemplate(contextDatabaseAgentTemplate.uuid)
      : undefined,
    doUpdate: !!contextDatabaseAgentTemplate,
    basePath: '/admin/database-agent-templates',
    resourceName: t('pages.admin.databaseAgentTemplates.resourceName', {}),
  });

  useHydrateForm(form, contextDatabaseAgentTemplate, databaseAgentTemplateToFormValues, {
    key: (template) => template.uuid,
  });

  const doExport = (format: ResourceExportFormat) => {
    if (!contextDatabaseAgentTemplate) return;

    downloadResourceFile(
      adminDatabaseAgentTemplateCreateSchema,
      contextDatabaseAgentTemplate,
      `database-agent-template-${contextDatabaseAgentTemplate.uuid}`,
      format,
    );

    addToast(t('pages.admin.databaseAgentTemplates.tabs.general.page.toast.exported', {}), 'success');
  };

  const fields = useDatabaseAgentTemplateFormFields(!!contextDatabaseAgentTemplate);

  return (
    <AdminContentContainer
      title={
        contextDatabaseAgentTemplate
          ? t('pages.admin.databaseAgentTemplates.tabs.general.page.titleUpdate', {})
          : t('pages.admin.databaseAgentTemplates.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextDatabaseAgentTemplate}
      titleOrder={2}
      contentRight={
        <Group gap='sm'>
          {contextDatabaseAgentTemplate && (
            <Badge variant='light' size='lg'>
              {t('pages.admin.databaseAgentTemplates.tabs.general.page.version', {
                version: contextDatabaseAgentTemplate.version.toString(),
              })}
            </Badge>
          )}
          <AdvancedModeToggle />
        </Group>
      }
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.databaseAgentTemplates.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('common.modal.delete.content', {
          name: form.getValues().name ?? '',
        }).md()}
      </ConfirmationModal>

      {contextDatabaseAgentTemplate && (
        <ResourceDuplicateModal
          resourceName={t('pages.admin.databaseAgentTemplates.resourceName', {})}
          sourceName={contextDatabaseAgentTemplate.name}
          duplicate={(name) => duplicateDatabaseAgentTemplate(contextDatabaseAgentTemplate.uuid, name)}
          redirectTo={(duplicated) => `/admin/database-agent-templates/${duplicated.uuid}`}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.databaseAgentTemplates.all()))}>
        <FormEngine form={form} fields={fields} />

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
            {contextDatabaseAgentTemplate && <ResourceExportMenu loading={loading} onExport={doExport} />}
          </AdminCan>
          {contextDatabaseAgentTemplate && (
            <AdminCan action='database-agent-templates.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextDatabaseAgentTemplate && (
            <AdminCan action='database-agent-templates.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
          <Anchor href='https://calagopus.com/docs/db-agent/templates' target='_blank' rel='noopener noreferrer'>
            <Button variant='subtle' leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
              {t('common.button.viewDocumentation', {})}
            </Button>
          </Anchor>
        </Group>
      </form>
    </AdminContentContainer>
  );
}
