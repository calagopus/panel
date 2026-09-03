import { useState } from 'react';
import { z } from 'zod';
import createNest from '@/api/admin/nests/createNest.ts';
import deleteNest from '@/api/admin/nests/deleteNest.ts';
import updateNest from '@/api/admin/nests/updateNest.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Switch from '@/elements/input/Switch.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNestSchema, adminNestUpdateSchema } from '@/lib/schemas/admin/nests.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { nestEmptyFormValues, nestToFormValues, useNestFormFields } from './nestFormValues.tsx';

type NestFormValues = z.infer<typeof adminNestUpdateSchema>;

export default function NestCreateOrUpdate({ contextNest }: { contextNest?: z.infer<typeof adminNestSchema> }) {
  const [openModal, setOpenModal] = useState<'delete' | null>(null);
  const [deleteEggs, setDeleteEggs] = useState(false);
  const { t } = useTranslations();

  const form = useFormEngine<NestFormValues>('admin.nests.createOrUpdate', {
    schema: adminNestUpdateSchema.unwrap(),
    initialValues: nestEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<NestFormValues, z.infer<typeof adminNestSchema>>({
    form,
    createFn: () => createNest(adminNestUpdateSchema.parse(form.getValues())),
    updateFn: contextNest
      ? () => updateNest(contextNest.uuid, adminNestUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextNest ? () => deleteNest(contextNest.uuid, { deleteEggs }) : undefined,
    doUpdate: !!contextNest,
    basePath: '/admin/nests',
    resourceName: t('pages.admin.nests.resourceName', {}),
  });

  useHydrateForm(form, contextNest, nestToFormValues);

  const fields = useNestFormFields();

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
        {t('common.modal.delete.content', { name: form.getValues().name }).md()}

        <Switch
          className='mt-4'
          label={t('pages.admin.nests.tabs.general.page.modal.delete.form.deleteEggs', {})}
          name='deleteEggs'
          defaultChecked={deleteEggs}
          onChange={(e) => setDeleteEggs(e.target.checked)}
        />
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.nests.all()))}>
        <FormEngine form={form} fields={fields} />

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
