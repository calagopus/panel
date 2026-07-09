import { faExternalLink, faTriangleExclamation, faUnlockKeyhole } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UseFormReturnType, useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createDatabaseHost from '@/api/admin/database-hosts/createDatabaseHost.ts';
import deleteDatabaseHost from '@/api/admin/database-hosts/deleteDatabaseHost.ts';
import testDatabaseHost from '@/api/admin/database-hosts/testDatabaseHost.ts';
import updateDatabaseHost from '@/api/admin/database-hosts/updateDatabaseHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { databaseCredentialTypeLabelMapping, databaseTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminDatabaseCredentialsConnectionStringSchema,
  adminDatabaseCredentialsDetailsSchema,
  adminDatabaseHostCreateSchema,
  adminDatabaseHostSchema,
  adminDatabaseHostUpdateSchema,
} from '@/lib/schemas/admin/databaseHosts.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import CredentialConnectionString from './forms/CredentialConnectionString.tsx';
import CredentialDetails from './forms/CredentialDetails.tsx';

type DatabaseHostFormValues = z.infer<typeof adminDatabaseHostUpdateSchema>;

export default function DatabaseHostCreateOrUpdate({
  contextDatabaseHost,
}: {
  contextDatabaseHost?: z.infer<typeof adminDatabaseHostSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [deleteDoForce, setDeleteDoForce] = useState(false);

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<DatabaseHostFormValues>('admin.databaseHosts.createOrUpdate');
  const mergedSchema = (contextDatabaseHost ? adminDatabaseHostUpdateSchema : adminDatabaseHostCreateSchema)
    .unwrap()
    .extend(zodShape);

  const form = useForm<DatabaseHostFormValues>({
    initialValues: {
      name: '',
      type: 'mysql',
      deploymentEnabled: true,
      maintenanceEnabled: false,
      publicHost: null,
      publicPort: null,
      credentials: undefined,
      ...(extInitialValues as Partial<DatabaseHostFormValues>),
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
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

  useEffect(() => {
    if (contextDatabaseHost) {
      form.setValues({
        name: contextDatabaseHost.name,
        type: contextDatabaseHost.type,
        deploymentEnabled: contextDatabaseHost.deploymentEnabled,
        maintenanceEnabled: contextDatabaseHost.maintenanceEnabled,
        publicHost: contextDatabaseHost.publicHost,
        publicPort: contextDatabaseHost.publicPort,
        credentials: undefined,
      });
    } else {
      form.setValues({
        credentials: {
          type: 'connection_string',
          connectionString: '',
        },
      });
    }
  }, [contextDatabaseHost]);

  const doTest = () => {
    if (!contextDatabaseHost) {
      return;
    }

    setLoading(true);

    testDatabaseHost(contextDatabaseHost.uuid)
      .then(() => {
        addToast(t('pages.admin.databaseHosts.tabs.general.page.toast.tested', {}), 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const fields: FieldDef<DatabaseHostFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'type',
      label: t('common.form.type', {}),
      required: true,
      options: Object.entries(databaseTypeLabelMapping).map(([value, label]) => ({ value, label })),
      props: { disabled: !!contextDatabaseHost },
    },
    { type: 'text', name: 'publicHost', label: t('pages.admin.databaseHosts.tabs.general.page.form.publicHost', {}) },
    {
      type: 'number',
      name: 'publicPort',
      label: t('pages.admin.databaseHosts.tabs.general.page.form.publicPort', {}),
    },
    {
      type: 'custom',
      name: 'credentials',
      colSpan: 'full',
      render: (f) => (
        <CollapsibleSection
          icon={<FontAwesomeIcon icon={faUnlockKeyhole} />}
          enabled={!!f.values.credentials}
          onToggle={(enabled) =>
            enabled
              ? f.setValues({
                  credentials: contextDatabaseHost
                    ? contextDatabaseHost.credentials
                    : { type: 'connection_string', connectionString: '' },
                })
              : f.setValues({ credentials: undefined })
          }
          title={t('pages.admin.databaseHosts.tabs.general.page.form.connectionCredentials', {})}
        >
          <Select
            withAsterisk
            label={t('pages.admin.databaseHosts.tabs.general.page.form.credentialType', {})}
            data={Object.entries(databaseCredentialTypeLabelMapping).map(([value, label]) => ({
              value,
              label: label(),
            }))}
            key={f.key('credentials.type')}
            {...f.getInputProps('credentials.type')}
          />

          {f.values.credentials?.type === 'connection_string' ? (
            <CredentialConnectionString
              form={
                f as UseFormReturnType<{
                  credentials: z.infer<typeof adminDatabaseCredentialsConnectionStringSchema>;
                }>
              }
            />
          ) : f.values.credentials?.type === 'details' ? (
            <CredentialDetails
              form={
                f as UseFormReturnType<{
                  credentials: z.infer<typeof adminDatabaseCredentialsDetailsSchema>;
                }>
              }
            />
          ) : null}
        </CollapsibleSection>
      ),
    },
    { type: 'switch', name: 'deploymentEnabled', label: t('common.form.deploymentEnabled', {}) },
    { type: 'switch', name: 'maintenanceEnabled', label: t('common.form.maintenanceEnabled', {}) },
  ];

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
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => {
          setOpenModal(null);
          setDeleteDoForce(false);
        }}
        title={t('pages.admin.databaseHosts.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          <Text size='sm'>
            {t('pages.admin.databaseHosts.tabs.general.page.modal.delete.content', {
              name: form.getValues().name ?? '',
            }).md()}
          </Text>

          <Switch
            label={t('pages.admin.databaseHosts.tabs.general.page.modal.delete.form.force', {})}
            name='force'
            color='red'
            checked={deleteDoForce}
            onChange={(e) => setDeleteDoForce(e.target.checked)}
          />

          {deleteDoForce && (
            <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('pages.admin.databaseHosts.tabs.general.page.modal.delete.form.forceWarning', {})}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.databaseHosts.all()))}>
        <FormEngine form={form} fields={fields} extensions={[formExtension]} />

        <Group mt='md'>
          <AdminCan action={contextDatabaseHost ? 'database-hosts.update' : 'database-hosts.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextDatabaseHost && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextDatabaseHost && (
            <>
              <AdminCan action='database-hosts.read'>
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
