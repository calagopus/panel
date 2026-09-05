import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import createDatabaseAgentHost from '@/api/admin/database-agent-hosts/createDatabaseAgentHost.ts';
import deleteDatabaseAgentHost from '@/api/admin/database-agent-hosts/deleteDatabaseAgentHost.ts';
import resetDatabaseAgentHostToken from '@/api/admin/database-agent-hosts/resetDatabaseAgentHostToken.ts';
import testDatabaseAgentHost from '@/api/admin/database-agent-hosts/testDatabaseAgentHost.ts';
import updateDatabaseAgentHost from '@/api/admin/database-agent-hosts/updateDatabaseAgentHost.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ForceDeleteModal from '@/elements/modals/ForceDeleteModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminDatabaseAgentHostCreateSchema,
  adminDatabaseAgentHostSchema,
  adminDatabaseAgentHostUpdateSchema,
} from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useHostAction } from '@/plugins/useHostAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  databaseAgentHostEmptyFormValues,
  databaseAgentHostToFormValues,
  useDatabaseAgentHostFormFields,
} from './databaseAgentHostFormValues.tsx';

type DatabaseAgentHostFormValues = z.infer<typeof adminDatabaseAgentHostUpdateSchema>;

export default function DatabaseAgentHostCreateOrUpdate({
  contextDatabaseAgentHost,
}: {
  contextDatabaseAgentHost?: z.infer<typeof adminDatabaseAgentHostSchema>;
}) {
  const { t } = useTranslations();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [deleteDoForce, setDeleteDoForce] = useState(false);

  const form = useFormEngine<DatabaseAgentHostFormValues>('admin.databaseAgentHosts.createOrUpdate', {
    schema: (contextDatabaseAgentHost
      ? adminDatabaseAgentHostUpdateSchema
      : adminDatabaseAgentHostCreateSchema
    ).unwrap(),
    initialValues: databaseAgentHostEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    DatabaseAgentHostFormValues,
    z.infer<typeof adminDatabaseAgentHostSchema>
  >({
    form,
    createFn: () => createDatabaseAgentHost(adminDatabaseAgentHostCreateSchema.parse(form.getValues())),
    updateFn: contextDatabaseAgentHost
      ? () =>
          updateDatabaseAgentHost(
            contextDatabaseAgentHost.uuid,
            adminDatabaseAgentHostUpdateSchema.parse(form.getValues()),
          )
      : undefined,
    deleteFn: contextDatabaseAgentHost
      ? () => deleteDatabaseAgentHost(contextDatabaseAgentHost.uuid, { force: deleteDoForce })
      : undefined,
    doUpdate: !!contextDatabaseAgentHost,
    basePath: '/admin/database-agent-hosts',
    resourceName: t('pages.admin.databaseAgentHosts.resourceName', {}),
  });

  useHydrateForm(form, contextDatabaseAgentHost, databaseAgentHostToFormValues);

  const runHostAction = useHostAction(contextDatabaseAgentHost?.uuid, setLoading);

  const doResetToken = () =>
    runHostAction(
      resetDatabaseAgentHostToken,
      t('pages.admin.databaseAgentHosts.tabs.general.page.toast.tokenReset', {}),
      () =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.databaseAgentHosts.token(contextDatabaseAgentHost!.uuid),
        }),
    );

  const doTest = () =>
    runHostAction(testDatabaseAgentHost, t('pages.admin.databaseAgentHosts.tabs.general.page.toast.tested', {}));

  const urlValue = form.getValues().url ?? '';

  const fields = useDatabaseAgentHostFormFields({ urlValue });

  return (
    <AdminContentContainer
      title={
        contextDatabaseAgentHost
          ? t('pages.admin.databaseAgentHosts.tabs.general.page.titleUpdate', {})
          : t('pages.admin.databaseAgentHosts.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextDatabaseAgentHost}
      titleOrder={2}
    >
      <ForceDeleteModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.databaseAgentHosts.tabs.general.page.modal.delete.title', {})}
        name={form.getValues().name ?? ''}
        force={deleteDoForce}
        onForceChange={setDeleteDoForce}
        forceWarning={t('pages.admin.databaseAgentHosts.tabs.general.page.modal.delete.alert.forceWarning', {})}
        onConfirmed={doDelete}
      />

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.databaseAgentHosts.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan
            action={contextDatabaseAgentHost ? 'database-agent-hosts.update' : 'database-agent-hosts.create'}
            cantSave
          >
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextDatabaseAgentHost && (
              <Button
                onClick={() => doCreateOrUpdate(true, queryKeys.admin.databaseAgentHosts.all())}
                disabled={!form.isValid()}
                loading={loading}
              >
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextDatabaseAgentHost && (
            <>
              <AdminCan action='database-agent-hosts.test'>
                <Button variant='outline' onClick={doTest} loading={loading}>
                  {t('pages.admin.databaseAgentHosts.tabs.general.page.button.testConnection', {})}
                </Button>
              </AdminCan>
              <AdminCan action='database-agent-hosts.reset-token'>
                <Button variant='outline' color='red' onClick={doResetToken} loading={loading}>
                  {t('pages.admin.databaseAgentHosts.tabs.general.page.button.resetToken', {})}
                </Button>
              </AdminCan>
              <AdminCan action='database-agent-hosts.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  {t('common.button.delete', {})}
                </Button>
              </AdminCan>
            </>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
