import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateSubuser from '@/api/server/subusers/updateSubuser.ts';
import Button from '@/elements/Button.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { serverSubuserSchema, serverSubuserUpdateSchema } from '@/lib/schemas/server/subusers.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  subuser: z.infer<typeof serverSubuserSchema>;
};

export default function SubuserUpdateModal({ subuser, opened, onClose }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { availablePermissions } = useGlobalStore();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverSubuserUpdateSchema>>(
    {
      initialValues: {
        permissions: subuser.permissions,
        ignoredFiles: subuser.ignoredFiles,
      },
      validate: zod4Resolver(serverSubuserUpdateSchema),
      onClose,
      onSubmit: async (values) => {
        await updateSubuser(server.uuid, subuser.user.uuid, {
          permissions: Array.from(values.permissions),
          ignoredFiles: values.ignoredFiles,
        });
        subuser.permissions = Array.from(values.permissions);
        subuser.ignoredFiles = values.ignoredFiles;
        addToast(t('pages.server.subusers.modal.updateSubuser.toast.updated', {}), 'success');
      },
    },
  );

  return (
    <FormModal
      title={t('pages.server.subusers.modal.updateSubuser.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
      size='95%'
    >
      <Stack>
        <PermissionSelector
          label={t('pages.server.subusers.modal.createSubuser.form.permissions', {})}
          permissionsMapType='serverPermissions'
          permissions={availablePermissions.serverPermissions}
          selectedPermissions={form.values.permissions}
          setSelectedPermissions={(permissions) => form.setFieldValue('permissions', permissions)}
        />

        <TagsInput
          label={t('pages.server.subusers.modal.createSubuser.form.ignoredFiles', {})}
          placeholder={t('pages.server.subusers.modal.createSubuser.form.ignoredFiles', {})}
          description={t('pages.server.subusers.modal.createSubuser.form.ignoredFilesDescription', {})}
          {...form.getInputProps('ignoredFiles')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.update', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
