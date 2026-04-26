import { Group } from '@mantine/core';
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
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminMountSchema, adminMountUpdateSchema } from '@/lib/schemas/admin/mounts.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';

export default function MountCreateOrUpdate({ contextMount }: { contextMount?: z.infer<typeof adminMountSchema> }) {
  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminMountUpdateSchema>>({
    initialValues: {
      name: '',
      description: null,
      source: '',
      target: '',
      readOnly: false,
      userMountable: false,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminMountUpdateSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminMountUpdateSchema>,
    z.infer<typeof adminMountSchema>
  >({
    form,
    createFn: () => createMount(adminMountUpdateSchema.parse(form.getValues())),
    updateFn: contextMount
      ? () => updateMount(contextMount.uuid, adminMountUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextMount ? () => deleteMount(contextMount.uuid) : undefined,
    doUpdate: !!contextMount,
    basePath: '/admin/mounts',
    resourceName: 'Mount',
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
    <AdminContentContainer
      title={`${contextMount ? 'Update' : 'Create'} Mount`}
      fullscreen={!!contextMount}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Mount Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'mounts']))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label='Name'
            placeholder='Name'
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextArea
            label='Description'
            placeholder='Description'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />

          <TextInput
            withAsterisk
            label='Source'
            placeholder='Source'
            key={form.key('source')}
            {...form.getInputProps('source')}
          />
          <TextInput
            withAsterisk
            label='Target'
            placeholder='Target'
            key={form.key('target')}
            {...form.getInputProps('target')}
          />

          <Switch
            label='Read Only'
            key={form.key('readOnly')}
            {...form.getInputProps('readOnly', { type: 'checkbox' })}
          />
          <Switch
            label='User Mountable'
            key={form.key('userMountable')}
            {...form.getInputProps('userMountable', { type: 'checkbox' })}
          />
        </div>

        <Group mt='md'>
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
      </form>
    </AdminContentContainer>
  );
}
