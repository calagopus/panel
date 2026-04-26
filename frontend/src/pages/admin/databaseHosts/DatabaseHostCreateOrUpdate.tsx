import { faExternalLink, faUnlockKeyhole } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { UseFormReturnType, useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createDatabaseHost from '@/api/admin/database-hosts/createDatabaseHost.ts';
import deleteDatabaseHost from '@/api/admin/database-hosts/deleteDatabaseHost.ts';
import testDatabaseHost from '@/api/admin/database-hosts/testDatabaseHost.ts';
import updateDatabaseHost from '@/api/admin/database-hosts/updateDatabaseHost.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { databaseCredentialTypeLabelMapping, databaseTypeLabelMapping } from '@/lib/enums.ts';
import {
  adminDatabaseCredentialsConnectionStringSchema,
  adminDatabaseCredentialsDetailsSchema,
  adminDatabaseHostCreateSchema,
  adminDatabaseHostSchema,
  adminDatabaseHostUpdateSchema,
} from '@/lib/schemas/admin/databaseHosts.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import CredentialConnectionString from './forms/CredentialConnectionString.tsx';
import CredentialDetails from './forms/CredentialDetails.tsx';

export default function DatabaseHostCreateOrUpdate({
  contextDatabaseHost,
}: {
  contextDatabaseHost?: z.infer<typeof adminDatabaseHostSchema>;
}) {
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminDatabaseHostUpdateSchema>>({
    initialValues: {
      name: '',
      type: 'mysql',
      deploymentEnabled: true,
      maintenanceEnabled: false,
      publicHost: null,
      publicPort: null,
      credentials: undefined,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(contextDatabaseHost ? adminDatabaseHostUpdateSchema : adminDatabaseHostCreateSchema),
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminDatabaseHostUpdateSchema>,
    z.infer<typeof adminDatabaseHostSchema>
  >({
    form,
    createFn: () => createDatabaseHost(adminDatabaseHostCreateSchema.parse(form.getValues())),
    updateFn: contextDatabaseHost
      ? () => updateDatabaseHost(contextDatabaseHost.uuid, adminDatabaseHostUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextDatabaseHost ? () => deleteDatabaseHost(contextDatabaseHost.uuid) : undefined,
    doUpdate: !!contextDatabaseHost,
    basePath: '/admin/database-hosts',
    resourceName: 'Database host',
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
        addToast('Test successfully completed', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminContentContainer
      title={`${contextDatabaseHost ? 'Update' : 'Create'} Database Host`}
      fullscreen={!!contextDatabaseHost}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Database Host Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'databaseHosts']))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label='Name'
            placeholder='Name'
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Select
            withAsterisk
            label='Type'
            data={Object.entries(databaseTypeLabelMapping).map(([value, label]) => ({
              value,
              label,
            }))}
            disabled={!!contextDatabaseHost}
            key={form.key('type')}
            {...form.getInputProps('type')}
          />

          <TextInput
            label='Public Host'
            placeholder='Public Host'
            key={form.key('publicHost')}
            {...form.getInputProps('publicHost')}
          />
          <NumberInput
            label='Public Port'
            placeholder='Public Port'
            key={form.key('publicPort')}
            {...form.getInputProps('publicPort')}
          />

          <CollapsibleSection
            icon={<FontAwesomeIcon icon={faUnlockKeyhole} />}
            enabled={!!form.values.credentials}
            className='col-span-full'
            onToggle={(enabled) =>
              enabled
                ? form.setValues({
                    credentials: contextDatabaseHost
                      ? contextDatabaseHost.credentials
                      : { type: 'connection_string', connectionString: '' },
                  })
                : form.setValues({ credentials: undefined })
            }
            title='Connection Credentials'
          >
            <Select
              withAsterisk
              label='Credential Type'
              data={Object.entries(databaseCredentialTypeLabelMapping).map(([value, label]) => ({
                value,
                label,
              }))}
              key={form.key('credentials.type')}
              {...form.getInputProps('credentials.type')}
            />

            {form.values.credentials?.type === 'connection_string' ? (
              <CredentialConnectionString
                form={
                  form as UseFormReturnType<{
                    credentials: z.infer<typeof adminDatabaseCredentialsConnectionStringSchema>;
                  }>
                }
              />
            ) : form.values.credentials?.type === 'details' ? (
              <CredentialDetails
                form={
                  form as UseFormReturnType<{
                    credentials: z.infer<typeof adminDatabaseCredentialsDetailsSchema>;
                  }>
                }
              />
            ) : null}
          </CollapsibleSection>

          <Switch
            label='Deployment Enabled'
            key={form.key('deploymentEnabled')}
            {...form.getInputProps('deploymentEnabled', { type: 'checkbox' })}
          />
          <Switch
            label='Maintenance Enabled'
            key={form.key('maintenanceEnabled')}
            {...form.getInputProps('maintenanceEnabled', { type: 'checkbox' })}
          />
        </div>

        <Group mt='md'>
          <AdminCan action={contextDatabaseHost ? 'database-hosts.update' : 'database-hosts.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
            {!contextDatabaseHost && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                Save & Stay
              </Button>
            )}
          </AdminCan>
          {contextDatabaseHost && (
            <>
              <AdminCan action='database-hosts.read'>
                <Button variant='outline' onClick={doTest} loading={loading}>
                  Test Connection
                </Button>
              </AdminCan>
              <AdminCan action='database-hosts.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  Delete
                </Button>
              </AdminCan>
            </>
          )}
          <a
            href='https://calagopus.com/docs/advanced/setting-up-database-hosts'
            target='_blank'
            rel='noopener noreferrer'
          >
            <Button variant='subtle' leftSection={<FontAwesomeIcon icon={faExternalLink} />}>
              View Documentation
            </Button>
          </a>
        </Group>
      </form>
    </AdminContentContainer>
  );
}
