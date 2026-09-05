import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import createMount from '@/api/admin/mounts/createMount.ts';
import deleteMount from '@/api/admin/mounts/deleteMount.ts';
import updateMount from '@/api/admin/mounts/updateMount.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import { FormEngine, useFormEngine } from '@/elements/form-engine/index.ts';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminMountSchema, adminMountUpdateSchema } from '@/lib/schemas/admin/mounts.ts';
import MountDuplicateModal from '@/pages/admin/mounts/modals/MountDuplicateModal.tsx';
import { useHydrateForm } from '@/plugins/form/useHydrateForm.ts';
import { useResourceForm } from '@/plugins/resource/useResourceForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  type MountFormValues,
  mountEmptyFormValues,
  mountToFormValues,
  useMountFormFields,
} from './mountFormValues.tsx';

export default function MountCreateOrUpdate({ contextMount }: { contextMount?: z.infer<typeof adminMountSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'delete' | 'duplicate' | null>(null);

  const form = useFormEngine<MountFormValues>('admin.mounts.createOrUpdate', {
    schema: adminMountUpdateSchema.unwrap(),
    initialValues: mountEmptyFormValues,
    validateInputOnBlur: true,
  });

  const { loading, doCreateOrUpdate, doDelete } = useResourceForm<MountFormValues, z.infer<typeof adminMountSchema>>({
    form,
    createFn: () => createMount(adminMountUpdateSchema.parse(form.getValues())),
    updateFn: contextMount
      ? () => updateMount(contextMount.uuid, adminMountUpdateSchema.parse(form.getValues()))
      : undefined,
    deleteFn: contextMount ? () => deleteMount(contextMount.uuid) : undefined,
    doUpdate: !!contextMount,
    basePath: '/admin/mounts',
    resourceName: t('pages.admin.mounts.resourceName', {}),
  });

  useHydrateForm(form, contextMount, mountToFormValues, { key: (mount) => mount.uuid });

  const fields = useMountFormFields();

  return (
    <AdminContentContainer
      title={t(
        contextMount
          ? 'pages.admin.mounts.tabs.general.page.titleUpdate'
          : 'pages.admin.mounts.tabs.general.page.titleCreate',
        {},
      )}
      fullscreen={!!contextMount}
      titleOrder={2}
    >
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.mounts.tabs.general.page.modal.delete.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('common.modal.delete.content', { name: form.getValues().name }).md()}
      </ConfirmationModal>

      {contextMount && (
        <MountDuplicateModal
          mount={contextMount}
          opened={openModal === 'duplicate'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <Alert color='yellow' icon={<FontAwesomeIcon icon={faExclamationTriangle} />} mb='md'>
        {t('pages.admin.mounts.tabs.general.page.alert', {})}
      </Alert>

      <form onSubmit={form.onSubmit(() => doCreateOrUpdate(false, queryKeys.admin.mounts.all()))}>
        <FormEngine form={form} fields={fields} />

        <Group mt='md'>
          <AdminCan action={contextMount ? 'mounts.update' : 'mounts.create'} cantSave>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.save', {})}
            </Button>
            {!contextMount && (
              <Button onClick={() => doCreateOrUpdate(true)} disabled={!form.isValid()} loading={loading}>
                {t('common.button.saveAndStay', {})}
              </Button>
            )}
          </AdminCan>
          {contextMount && (
            <AdminCan action='mounts.create'>
              <Button variant='default' onClick={() => setOpenModal('duplicate')} loading={loading}>
                {t('common.button.duplicate', {})}
              </Button>
            </AdminCan>
          )}
          {contextMount && (
            <AdminCan action='mounts.delete' cantDelete>
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
