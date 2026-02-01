import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
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
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { adminDatabaseHostCreateSchema, adminDatabaseHostUpdateSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer';

export default function DatabaseHostCreateOrUpdate({
  contextDatabaseHost,
}: {
  contextDatabaseHost?: AdminDatabaseHost;
}) {
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminDatabaseHostUpdateSchema>>({
    initialValues: {
      name: '',
      username: '',
      password: '',
      host: '',
      port: 3306,
      public: false,
      publicHost: null,
      publicPort: null,
      type: 'mysql',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(contextDatabaseHost ? adminDatabaseHostUpdateSchema : adminDatabaseHostCreateSchema),
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminDatabaseHostUpdateSchema>,
    AdminDatabaseHost
  >({
    form,
    createFn: () => createDatabaseHost(form.values),
    updateFn: () => updateDatabaseHost(contextDatabaseHost!.uuid, form.values),
    deleteFn: () => deleteDatabaseHost(contextDatabaseHost!.uuid),
    doUpdate: !!contextDatabaseHost,
    basePath: '/admin/database-hosts',
    resourceName: 'Database host',
  });

  useEffect(() => {
    if (contextDatabaseHost) {
      form.setValues({
        name: contextDatabaseHost.name,
        username: contextDatabaseHost.username,
        password: null,
        host: contextDatabaseHost.host,
        port: contextDatabaseHost.port,
        public: contextDatabaseHost.public,
        publicHost: contextDatabaseHost.publicHost,
        publicPort: contextDatabaseHost.publicPort,
        type: contextDatabaseHost.type,
      });
    }
  }, [contextDatabaseHost]);

  const doTest = () => {
    setLoading(true);
    testDatabaseHost(contextDatabaseHost!.uuid)
      .then(() => {
        addToast('Test successfully completed', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <AdminContentContainer title={`${contextDatabaseHost ? 'Update' : 'Create'} Database Host`} titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Database Host Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.values.name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false))}>
        <Stack mt='xs'>
          <Group grow>
            <TextInput withAsterisk label='Name' placeholder='Name' {...form.getInputProps('name')} />
            <Select
              withAsterisk
              label='Type'
              data={Object.entries(databaseTypeLabelMapping).map(([value, label]) => ({
                value,
                label,
              }))}
              disabled={!!contextDatabaseHost}
              {...form.getInputProps('type')}
            />
          </Group>

          <Group grow>
            <TextInput withAsterisk label='Username' placeholder='Username' {...form.getInputProps('username')} />
            <TextInput
              withAsterisk={!contextDatabaseHost}
              label='Password'
              placeholder='Password'
              type='password'
              {...form.getInputProps('password')}
              onChange={(e) => form.setFieldValue('password', e.target.value || null)}
            />
          </Group>

          <Group grow>
            <TextInput withAsterisk label='Host' placeholder='Host' {...form.getInputProps('host')} />
            <NumberInput withAsterisk label='Port' placeholder='Port' min={0} {...form.getInputProps('port')} />
          </Group>

          <Group grow>
            <TextInput label='Public Host' placeholder='Public Host' {...form.getInputProps('publicHost')} />
            <NumberInput
              label='Public Port'
              placeholder='Public Port'
              min={0}
              {...form.getInputProps('publicPort')}
              value={form.values.publicPort || ''}
              onChange={(v) => form.setFieldValue('publicPort', Number(v) || 0)}
            />
          </Group>

          <Switch label='Public' {...form.getInputProps('public', { type: 'checkbox' })} />

          <Group>
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
                <AdminCan action='database-hosts.test'>
                  <Button variant='outline' onClick={doTest} loading={loading}>
                    Test
                  </Button>
                </AdminCan>
                <AdminCan action='database-hosts.delete' cantDelete>
                  <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                    Delete
                  </Button>
                </AdminCan>
              </>
            )}
          </Group>
        </Stack>
      </form>
    </AdminContentContainer>
  );
}
