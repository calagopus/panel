import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createDatabaseAgentHost from '@/api/admin/database-agent-hosts/createDatabaseAgentHost.ts';
import deleteDatabaseAgentHost from '@/api/admin/database-agent-hosts/deleteDatabaseAgentHost.ts';
import resetDatabaseAgentHostToken from '@/api/admin/database-agent-hosts/resetDatabaseAgentHostToken.ts';
import testDatabaseAgentHost from '@/api/admin/database-agent-hosts/testDatabaseAgentHost.ts';
import updateDatabaseAgentHost from '@/api/admin/database-agent-hosts/updateDatabaseAgentHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Group from '@/elements/Group.tsx';
import Switch from '@/elements/input/Switch.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { databaseAgentTypeDefaultPortMapping, databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminDatabaseAgentHostCreateSchema,
  adminDatabaseAgentHostSchema,
  adminDatabaseAgentHostUpdateSchema,
} from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type DatabaseAgentHostFormValues = z.infer<typeof adminDatabaseAgentHostUpdateSchema>;

export default function DatabaseAgentHostCreateOrUpdate({
  contextDatabaseAgentHost,
}: {
  contextDatabaseAgentHost?: z.infer<typeof adminDatabaseAgentHostSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [deleteDoForce, setDeleteDoForce] = useState(false);

  const {
    formExtension,
    zodShape,
    initialValues: extInitialValues,
  } = useFormExtensions<DatabaseAgentHostFormValues>('admin.databaseAgentHosts.createOrUpdate');
  const mergedSchema = (
    contextDatabaseAgentHost ? adminDatabaseAgentHostUpdateSchema : adminDatabaseAgentHostCreateSchema
  )
    .unwrap()
    .extend(zodShape);

  const form = useForm<DatabaseAgentHostFormValues>({
    initialValues: {
      name: '',
      description: null,
      deploymentEnabled: true,
      maintenanceEnabled: false,
      url: '',
      memory: 0,
      disk: 0,
      types: {
        postgres: { enabled: true, publicHost: null, publicPort: databaseAgentTypeDefaultPortMapping.postgres },
        mariadb: { enabled: true, publicHost: null, publicPort: databaseAgentTypeDefaultPortMapping.mariadb },
        mongodb: { enabled: true, publicHost: null, publicPort: databaseAgentTypeDefaultPortMapping.mongodb },
        redis: { enabled: true, publicHost: null, publicPort: databaseAgentTypeDefaultPortMapping.redis },
      },
      ...(extInitialValues as Partial<DatabaseAgentHostFormValues>),
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(mergedSchema),
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

  useEffect(() => {
    if (contextDatabaseAgentHost) {
      form.setValues({
        name: contextDatabaseAgentHost.name,
        description: contextDatabaseAgentHost.description,
        deploymentEnabled: contextDatabaseAgentHost.deploymentEnabled,
        maintenanceEnabled: contextDatabaseAgentHost.maintenanceEnabled,
        url: contextDatabaseAgentHost.url,
        memory: contextDatabaseAgentHost.memory,
        disk: contextDatabaseAgentHost.disk,
        types: contextDatabaseAgentHost.types,
      });
    }
  }, [contextDatabaseAgentHost]);

  const doResetToken = () => {
    if (!contextDatabaseAgentHost) {
      return;
    }

    setLoading(true);

    resetDatabaseAgentHostToken(contextDatabaseAgentHost.uuid)
      .then(() => {
        addToast(t('pages.admin.databaseAgentHosts.tabs.general.page.toast.tokenReset', {}), 'success');
        queryClient.invalidateQueries({
          queryKey: queryKeys.admin.databaseAgentHosts.token(contextDatabaseAgentHost.uuid),
        });
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  const doTest = () => {
    if (!contextDatabaseAgentHost) {
      return;
    }

    setLoading(true);

    testDatabaseAgentHost(contextDatabaseAgentHost.uuid)
      .then(() => addToast(t('pages.admin.databaseAgentHosts.tabs.general.page.toast.tested', {}), 'success'))
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  const fields: FieldDef<DatabaseAgentHostFormValues>[] = [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    { type: 'text', name: 'url', label: t('common.form.url', {}), required: true },
    { type: 'textarea', name: 'description', label: t('common.form.description', {}), colSpan: 'full' },
    { type: 'size', name: 'memory', label: t('common.form.memory', {}), required: true, mode: 'mb', min: 1 },
    { type: 'size', name: 'disk', label: t('common.form.disk', {}), required: true, mode: 'mb', min: 1 },
    { type: 'switch', name: 'deploymentEnabled', label: t('common.form.deploymentEnabled', {}) },
    { type: 'switch', name: 'maintenanceEnabled', label: t('common.form.maintenanceEnabled', {}) },
    ...Object.entries(databaseAgentTypeLabelMapping).flatMap(
      ([type, label]): FieldDef<DatabaseAgentHostFormValues>[] => [
        {
          type: 'divider',
          name: `types.${type}.divider`,
          label,
          switchName: `types.${type}.enabled`,
          switchLabel: t('pages.admin.databaseAgentHosts.tabs.general.page.form.typeEnabled', {}),
        },
        {
          type: 'text',
          name: `types.${type}.publicHost`,
          label: t('pages.admin.databaseAgentHosts.tabs.general.page.form.typePublicHost', {}),
          when: (values) => values.types?.[type as keyof typeof values.types]?.enabled !== false,
        },
        {
          type: 'number',
          name: `types.${type}.publicPort`,
          label: t('pages.admin.databaseAgentHosts.tabs.general.page.form.typePublicPort', {}),
          props: {
            min: 1,
            max: 65535,
            placeholder: String(
              databaseAgentTypeDefaultPortMapping[type as keyof typeof databaseAgentTypeDefaultPortMapping],
            ),
          },
          when: (values) => values.types?.[type as keyof typeof values.types]?.enabled !== false,
        },
      ],
    ),
  ];

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
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => {
          setOpenModal(null);
          setDeleteDoForce(false);
        }}
        title={t('pages.admin.databaseAgentHosts.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          <Text size='sm'>
            {t('pages.admin.databaseAgentHosts.tabs.general.page.modal.delete.content', {
              name: form.getValues().name ?? '',
            }).md()}
          </Text>

          <Switch
            label={t('pages.admin.databaseAgentHosts.tabs.general.page.modal.delete.form.force', {})}
            name='force'
            color='red'
            checked={deleteDoForce}
            onChange={(e) => setDeleteDoForce(e.target.checked)}
          />

          {deleteDoForce && (
            <Alert color='red' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
              {t('pages.admin.databaseAgentHosts.tabs.general.page.modal.delete.form.forceWarning', {})}
            </Alert>
          )}
        </Stack>
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.databaseAgentHosts.all()))}>
        <FormEngine form={form} fields={fields} extensions={[formExtension]} />

        <Group mt='md'>
          <AdminCan
            action={contextDatabaseAgentHost ? 'database-agent-hosts.update' : 'database-agent-hosts.create'}
            cantSave
          >
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextDatabaseAgentHost && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
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
