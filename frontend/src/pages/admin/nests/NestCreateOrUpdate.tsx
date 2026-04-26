import { Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createNest from '@/api/admin/nests/createNest.ts';
import deleteNest from '@/api/admin/nests/deleteNest.ts';
import updateNest from '@/api/admin/nests/updateNest.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { adminNestSchema, adminNestUpdateSchema } from '@/lib/schemas/admin/nests.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';

export default function NestCreateOrUpdate({ contextNest }: { contextNest?: z.infer<typeof adminNestSchema> }) {
  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminNestUpdateSchema>>({
    initialValues: {
      author: '',
      name: '',
      description: null,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminNestUpdateSchema),
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminNestUpdateSchema>,
    z.infer<typeof adminNestSchema>
  >({
    form,
    createFn: () => createNest(adminNestUpdateSchema.parse(form.getValues())),
    updateFn: contextNest
      ? () => updateNest(contextNest.uuid, adminNestUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextNest ? () => deleteNest(contextNest.uuid) : undefined,
    doUpdate: !!contextNest,
    basePath: '/admin/nests',
    resourceName: 'Nest',
  });

  useEffect(() => {
    if (contextNest) {
      form.setValues({
        author: contextNest.author,
        name: contextNest.name,
        description: contextNest.description,
      });
    }
  }, [contextNest]);

  return (
    <AdminContentContainer
      title={`${contextNest ? 'Update' : 'Create'} Nest`}
      fullscreen={!!contextNest}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm Nest Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete <Code>{form.getValues().name}</Code>?
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, ['admin', 'nests']))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label='Name'
            placeholder='Name'
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextInput
            withAsterisk
            label='Author'
            placeholder='Author'
            key={form.key('author')}
            {...form.getInputProps('author')}
          />

          <TextArea
            label='Description'
            placeholder='Description'
            className='col-span-full'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />
        </div>

        <Group mt='md'>
          <AdminCan action={contextNest ? 'nests.update' : 'nests.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              Save
            </Button>
            {!contextNest && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                Save & Stay
              </Button>
            )}
          </AdminCan>
          {contextNest && (
            <AdminCan action='nests.delete' cantDelete>
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
