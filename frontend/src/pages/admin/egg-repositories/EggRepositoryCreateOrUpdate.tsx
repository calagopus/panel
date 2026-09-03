import { useState } from 'react';
import { z } from 'zod';
import createEggRepository from '@/api/admin/egg-repositories/createEggRepository.ts';
import deleteEggRepository from '@/api/admin/egg-repositories/deleteEggRepository.ts';
import syncEggRepository from '@/api/admin/egg-repositories/syncEggRepository.ts';
import updateEggRepository from '@/api/admin/egg-repositories/updateEggRepository.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositorySchema, adminEggRepositoryUpdateSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useHostAction } from '@/plugins/useHostAction.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  eggRepositoryEmptyFormValues,
  eggRepositoryToFormValues,
  useEggRepositoryFormFields,
} from './eggRepositoryFormValues.tsx';

type EggRepositoryFormValues = z.infer<typeof adminEggRepositoryUpdateSchema>;

export default function EggRepositoryCreateOrUpdate({
  contextEggRepository,
}: {
  contextEggRepository?: z.infer<typeof adminEggRepositorySchema>;
}) {
  const { t, tItem } = useTranslations();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useFormEngine<EggRepositoryFormValues>('admin.eggRepositories.createOrUpdate', {
    schema: adminEggRepositoryUpdateSchema.unwrap(),
    initialValues: eggRepositoryEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    EggRepositoryFormValues,
    z.infer<typeof adminEggRepositorySchema>
  >({
    form,
    createFn: () => createEggRepository(adminEggRepositoryUpdateSchema.parse(form.getValues())),
    updateFn: contextEggRepository
      ? () => updateEggRepository(contextEggRepository.uuid, adminEggRepositoryUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextEggRepository ? () => deleteEggRepository(contextEggRepository.uuid) : undefined,
    doUpdate: !!contextEggRepository,
    basePath: '/admin/egg-repositories',
    resourceName: t('pages.admin.eggRepositories.resourceName', {}),
  });

  const runRepoAction = useHostAction(contextEggRepository?.uuid, setLoading);

  useHydrateForm(form, contextEggRepository, eggRepositoryToFormValues);

  const doSync = () =>
    runRepoAction(syncEggRepository, (found) =>
      t('pages.admin.eggRepositories.tabs.general.page.toast.synced', { eggs: tItem('egg', found) }),
    );

  const fields = useEggRepositoryFormFields(contextEggRepository);

  return (
    <AdminContentContainer
      title={
        contextEggRepository
          ? t('pages.admin.eggRepositories.tabs.general.page.titleUpdate', {})
          : t('pages.admin.eggRepositories.tabs.general.page.titleCreate', {})
      }
      fullscreen={!!contextEggRepository}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.eggRepositories.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('common.modal.delete.content', {
          name: form.getValues().name,
        }).md()}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.eggRepositories.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan action={contextEggRepository ? 'egg-repositories.update' : 'egg-repositories.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextEggRepository && (
              <Button
                onClick={() => doCreateOrUpdate(true, queryKeys.admin.eggRepositories.all())}
                disabled={!form.isValid()}
                loading={loading}
              >
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextEggRepository && (
            <AdminCan action='egg-repositories.sync'>
              <Button variant='outline' onClick={doSync} loading={loading}>
                {t('pages.admin.eggRepositories.tabs.general.page.button.sync', {})}
              </Button>
            </AdminCan>
          )}
          {contextEggRepository && (
            <AdminCan action='egg-repositories.delete' cantDelete>
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
