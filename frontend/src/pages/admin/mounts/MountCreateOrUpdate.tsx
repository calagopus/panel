import { Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createMount from '@/api/admin/mounts/createMount.ts';
import deleteMount from '@/api/admin/mounts/deleteMount.ts';
import updateMount from '@/api/admin/mounts/updateMount.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer';

export default function MountCreateOrUpdate({ contextMount }: { contextMount?: Mount }) {
  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminMountSchema>>({
    initialValues: {
      name: '',
      description: null,
      source: '',
      target: '',
      readOnly: false,
      userMountable: false,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminMountSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<z.infer<typeof adminMountSchema>, Mount>({
    form,
    createFn: () => createMount(form.values),
    updateFn: () => updateMount(contextMount!.uuid, form.values),
    deleteFn: () => deleteMount(contextMount!.uuid),
    doUpdate: !!contextMount,
    basePath: '/admin/locations',
    resourceName: 'Location',
  });

  useEffect(() => {
    if (contextMount) {
      form.setValues({
        name: contextMount.name,
        description: contextMount.description,
        source: contextMount.source,
        target: contextMount.target,
        readOnly: contextMount.readOnly,
        userMountable: contextMount.userMountable,
      });
    }
  }, [contextMount]);

  return (
    <AdminContentContainer title={`${contextMount ? 'Update' : 'Create'} Mount`} titleOrder={2}>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Mount Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.values.name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false))}>
        <Stack mt='xs'>
          <Group grow align='start'>
            <TextInput withAsterisk label='Name' placeholder='Name' {...form.getInputProps('name')} />
            <TextArea label='Description' placeholder='Description' {...form.getInputProps('description')} rows={3} />
          </Group>

          <Group grow>
            <TextInput withAsterisk label='Source' placeholder='Source' {...form.getInputProps('source')} />
            <TextInput withAsterisk label='Target' placeholder='Target' {...form.getInputProps('target')} />
          </Group>

          <Group grow>
            <Switch label='Read Only' {...form.getInputProps('readOnly', { type: 'checkbox' })} />
            <Switch label='User Mountable' {...form.getInputProps('userMountable', { type: 'checkbox' })} />
          </Group>

          <Group>
            <AdminCan action={contextMount ? 'mounts.update' : 'mounts.create'} cantSave>
              <Button type='submit' disabled={!form.isValid()} loading={loading}>
                Save
              </Button>
              {!contextMount && (
                <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                  Save & Stay
                </Button>
              )}
            </AdminCan>
            {contextMount && (
              <AdminCan action='mounts.delete' cantDelete>
                <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                  Delete
                </Button>
              </AdminCan>
            )}
          </Group>
        </Stack>
      </form>
    </AdminContentContainer>
  );
}
