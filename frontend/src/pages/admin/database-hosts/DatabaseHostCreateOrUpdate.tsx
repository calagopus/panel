import { faExternalLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createDatabaseHost from '@/api/admin/database-hosts/createDatabaseHost.ts';
import deleteDatabaseHost from '@/api/admin/database-hosts/deleteDatabaseHost.ts';
import testDatabaseHost from '@/api/admin/database-hosts/testDatabaseHost.ts';
import updateDatabaseHost from '@/api/admin/database-hosts/updateDatabaseHost.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ForceDeleteModal from '@/elements/modals/ForceDeleteModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminDatabaseHostCreateSchema,
  adminDatabaseHostSchema,
  adminDatabaseHostUpdateSchema,
} from '@/lib/schemas/admin/databaseHosts.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useHostAction } from '@/plugins/useHostAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  adminDatabaseCredentialsDefaults,
  databaseHostEmptyFormValues,
  databaseHostToFormValues,
  useDatabaseHostFormFields,
} from './databaseHostFormValues.tsx';

type DatabaseHostFormValues = z.infer<typeof adminDatabaseHostUpdateSchema>;

export default function DatabaseHostCreateOrUpdate({
  contextDatabaseHost,
}: {
  contextDatabaseHost?: z.infer<typeof adminDatabaseHostSchema>;
}) {
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [deleteDoForce, setDeleteDoForce] = useState(false);

  const form = useFormEngine<DatabaseHostFormValues>('admin.databaseHosts.createOrUpdate', {
    schema: (contextDatabaseHost ? adminDatabaseHostUpdateSchema : adminDatabaseHostCreateSchema).unwrap(),
    initialValues: databaseHostEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    DatabaseHostFormValues,
    z.infer<typeof adminDatabaseHostSchema>
  >({
    form,
    createFn: () => createDatabaseHost(adminDatabaseHostCreateSchema.parse(form.getValues())),
    updateFn: contextDatabaseHost
      ? () => updateDatabaseHost(contextDatabaseHost.uuid, adminDatabaseHostUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextDatabaseHost
      ? () => deleteDatabaseHost(contextDatabaseHost.uuid, { force: deleteDoForce })
      : undefined,
    doUpdate: !!contextDatabaseHost,
    basePath: '/admin/database-hosts',
    resourceName: t('pages.admin.databaseHosts.resourceName', {}),
  });

  const runHostAction = useHostAction(contextDatabaseHost?.uuid, setLoading);

  useEffect(() => {
    form.setValues(
      contextDatabaseHost
        ? databaseHostToFormValues(contextDatabaseHost)
        : { credentials: adminDatabaseCredentialsDefaults.connection_string },
    );
  }, [contextDatabaseHost]);

  const doTest = () =>
    runHostAction(testDatabaseHost, t('pages.admin.databaseHosts.tabs.general.page.toast.tested', {}));

  const fields = useDatabaseHostFormFields(contextDatabaseHost);

  return (
    <AdminContentContainer
      title={
        contextDatabaseHost
          ? t('pages.admin.databaseHosts.tabs.general.page.titleUpdate', {})
          : t('pages.admin.databaseHosts.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextDatabaseHost}
      titleOrder={2}
    >
      <ForceDeleteModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.databaseHosts.tabs.general.page.modal.delete.title', {})}
        name={form.getValues().name ?? ''}
        force={deleteDoForce}
        onForceChange={setDeleteDoForce}
        forceWarning={t('pages.admin.databaseHosts.tabs.general.page.modal.delete.alert.forceWarning', {})}
        onConfirmed={doDelete}
      />

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.databaseHosts.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan action={contextDatabaseHost ? 'database-hosts.update' : 'database-hosts.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextDatabaseHost && (
              <Button
                onClick={() => doCreateOrUpdate(true, queryKeys.admin.databaseHosts.all())}
                disabled={!form.isValid()}
                loading={loading}
              >
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextDatabaseHost && (
            <>
              <AdminCan action='database-hosts.test'>
                <Button variant='outline' onClick={doTest} loading={loading}>
                  {t('pages.admin.databaseHosts.tabs.general.page.button.testConnection', {})}
                </Button>
              </AdminCan>
              <AdminCan action='database-hosts.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  {t('common.button.delete', {})}
                </Button>
              </AdminCan>
            </>
          )}
          <a href='https://calagopus.com/docs/additional/database-hosts/' target='_blank' rel='noopener noreferrer'>
            <Button variant='subtle' leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
              {t('common.button.viewDocumentation', {})}
            </Button>
          </a>
        </Group>
      </form>
    </AdminContentContainer>
  );
}
