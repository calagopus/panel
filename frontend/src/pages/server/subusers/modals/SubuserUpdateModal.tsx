import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import updateSubuser from '@/api/server/subusers/updateSubuser.ts';
import Button from '@/elements/Button.tsx';
import IgnoredFilesInput from '@/elements/input/IgnoredFilesInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import Stack from '@/elements/Stack.tsx';
import { serverSubuserSchema, serverSubuserUpdateSchema } from '@/lib/schemas/server/subusers.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  subuser: z.infer<typeof serverSubuserSchema>;
};

export default function SubuserUpdateModal({ subuser, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const availablePermissions = useGlobalStore((state) => state.availablePermissions);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverSubuserUpdateSchema>>(
    {
      initialValues: {
        permissions: subuser.permissions,
        ignoredFiles: subuser.ignoredFiles,
      },
      validate: zod4Resolver(serverSubuserUpdateSchema),
      onClose: props.onClose,
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
      isDirty={isDirty}
      loading={loading}
      size='95%'
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <PermissionSelector
          label={t('pages.server.subusers.modal.createSubuser.form.permissions', {})}
          permissionsMapType='serverPermissions'
          permissions={availablePermissions.serverPermissions}
          selectedPermissions={form.values.permissions}
          setSelectedPermissions={(permissions) => form.setFieldValue('permissions', permissions)}
        />

        <IgnoredFilesInput
          serverUuid={server.uuid}
          label={t('common.form.ignoredFiles', {})}
          description={t('pages.server.subusers.modal.createSubuser.form.ignoredFilesDescription', {})}
          value={form.values.ignoredFiles}
          onChange={(value) => form.setFieldValue('ignoredFiles', value)}
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
