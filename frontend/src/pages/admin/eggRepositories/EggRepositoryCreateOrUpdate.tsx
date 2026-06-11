import { Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createEggRepository from '@/api/admin/egg-repositories/createEggRepository.ts';
import deleteEggRepository from '@/api/admin/egg-repositories/deleteEggRepository.ts';
import syncEggRepository from '@/api/admin/egg-repositories/syncEggRepository.ts';
import updateEggRepository from '@/api/admin/egg-repositories/updateEggRepository.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositorySchema, adminEggRepositoryUpdateSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useResourceForm } from '@/plugins/useResourceForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggRepositoryCreateOrUpdate({
  contextEggRepository,
}: {
  contextEggRepository?: z.infer<typeof adminEggRepositorySchema>;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const form = useForm<z.infer<typeof adminEggRepositoryUpdateSchema>>({
    initialValues: {
      name: '',
      description: null,
      gitRepository: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminEggRepositoryUpdateSchema),
  });

  const { loading, setLoading, doCreateOrUpdate, doDelete } = useResourceForm<
    z.infer<typeof adminEggRepositoryUpdateSchema>,
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

  useEffect(() => {
    if (contextEggRepository) {
      form.setValues({
        name: contextEggRepository.name,
        description: contextEggRepository.description,
        gitRepository: contextEggRepository.gitRepository,
      });
    }
  }, [contextEggRepository]);

  const doSync = () => {
    if (!contextEggRepository) {
      return;
    }

    setLoading(true);

    syncEggRepository(contextEggRepository.uuid)
      .then((found) => {
        addToast(
          t('pages.admin.eggRepositories.tabs.general.page.toast.synced', { eggs: tItem('egg', found) }),
          'success',
        );
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

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
        {t('pages.admin.eggRepositories.tabs.general.page.modal.delete.content', {
          name: form.getValues().name,
        }).md()}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.eggRepositories.all()))}>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <TextInput
            withAsterisk
            label={t('common.form.name', {})}
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextInput
            withAsterisk
            label={t('pages.admin.eggRepositories.tabs.general.page.form.gitRepository', {})}
            key={form.key('gitRepository')}
            {...form.getInputProps('gitRepository')}
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
          <AdminCan action={contextEggRepository ? 'egg-repositories.update' : 'egg-repositories.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextEggRepository && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
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
