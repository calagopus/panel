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
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNestSchema, adminNestUpdateSchema } from '@/lib/schemas/admin/nests.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NestCreateOrUpdate({ contextNest }: { contextNest?: z.infer<typeof adminNestSchema> }) {
  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const { t } = useTranslations();

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
    resourceName: t('pages.admin.nests.resourceName', {}),
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
      title={
        contextNest
          ? t('pages.admin.nests.tabs.general.page.titleUpdate', {})
          : t('pages.admin.nests.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextNest}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.nests.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.nests.tabs.general.page.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.nests.all()))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label={t('common.form.name', {})}
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextInput
            withAsterisk
            label={t('common.form.author', {})}
            key={form.key('author')}
            {...form.getInputProps('author')}
          />

          <TextArea
            label={t('common.form.description', {})}
            className='col-span-full'
            rows={3}
            key={form.key('description')}
            {...form.getInputProps('description')}
          />
        </div>

        <Group mt='md'>
          <AdminCan action={contextNest ? 'nests.update' : 'nests.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextNest && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextNest && (
            <AdminCan action='nests.delete' cantDelete>
              <Button color='red' onClick={() => setOpenModal('delete')} loading={loading}>
                {t('common.button.delete', {})}
              </Button>
            </AdminCan>
          )}
        </Group>
      </form>
    </AdminContentContainer>
  );
}
