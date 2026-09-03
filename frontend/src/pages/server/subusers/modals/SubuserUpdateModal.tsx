import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import updateSubuser from '@/api/server/subusers/updateSubuser.ts';
import Button from '@/elements/buttons/Button.tsx';
import IgnoredFilesInput from '@/elements/input/IgnoredFilesInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { appendInheritedIgnoredFiles, stripInheritedIgnoredFiles } from '@/lib/domain/subusers.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSubuserSchema, serverSubuserUpdateSchema } from '@/lib/schemas/server/subusers.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
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
  const queryClient = useQueryClient();
  const server = useServerStore((state) => state.server);
  const availablePermissions = useGlobalStore((state) => state.availablePermissions);

  const grantablePermissions = server.permissions.includes('*') ? undefined : server.permissions;

  const ignoredFilesDescription =
    t('pages.server.subusers.modal.createSubuser.form.ignoredFilesDescription', {}) +
    (server.ignoredFiles.length > 0
      ? ` ${t('pages.server.subusers.modal.createSubuser.form.ignoredFilesInherited', {})}`
      : '');

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverSubuserUpdateSchema>>(
    {
      initialValues: {
        permissions: subuser.permissions,
        ignoredFiles: stripInheritedIgnoredFiles(subuser.ignoredFiles, server.ignoredFiles),
      },
      validate: zod4Resolver(serverSubuserUpdateSchema),
      onClose: props.onClose,
      onSubmit: async (values) => {
        await updateSubuser(server.uuid, subuser.user.uuid, {
          permissions: Array.from(values.permissions),
          ignoredFiles: appendInheritedIgnoredFiles(values.ignoredFiles, server.ignoredFiles),
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).subusers.all() });
        addToast(t('pages.server.subusers.modal.updateSubuser.toast.updated', {}), 'success');
      },
    },
  );

  useEffect(() => {
    if (props.opened) {
      const values = {
        permissions: subuser.permissions,
        ignoredFiles: stripInheritedIgnoredFiles(subuser.ignoredFiles, server.ignoredFiles),
      };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

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
          grantablePermissions={grantablePermissions}
          selectedPermissions={form.values.permissions}
          setSelectedPermissions={(permissions) => form.setFieldValue('permissions', permissions)}
        />

        <IgnoredFilesInput
          serverUuid={server.uuid}
          label={t('common.form.ignoredFiles', {})}
          description={ignoredFilesDescription}
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
