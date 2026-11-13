import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import createSubuser from '@/api/server/subusers/createSubuser.ts';
import Button from '@/elements/buttons/Button.tsx';
import Captcha, { useCaptcha } from '@/elements/captcha/Captcha.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import IgnoredFilesInput from '@/elements/input/IgnoredFilesInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { appendInheritedIgnoredFiles } from '@/lib/domain/subusers.ts';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSubuserCreateSchema } from '@/lib/schemas/server/subusers.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

export default function SubuserCreateModal({ ...props }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const availablePermissions = useGlobalStore((state) => state.availablePermissions);
  const passwordLoginEnabled = useGlobalStore((state) => state.settings.app.passwordLoginEnabled);
  const queryClient = useQueryClient();

  const grantablePermissions = server.permissions.includes('*') ? undefined : server.permissions;

  const captcha = useCaptcha();

  const ignoredFilesDescription =
    t('pages.server.subusers.modal.createSubuser.form.ignoredFilesDescription', {}) +
    (server.ignoredFiles.length > 0
      ? ` ${t('pages.server.subusers.modal.createSubuser.form.ignoredFilesInherited', {})}`
      : '');

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverSubuserCreateSchema>>(
    {
      initialValues: {
        email: '',
        permissions: [],
        ignoredFiles: [],
      },
      validate: zod4Resolver(serverSubuserCreateSchema),
      onClose: props.onClose,
      onSubmit: async (values) => {
        const captchaToken = await captcha.getToken();
        await createSubuser(server.uuid, {
          email: values.email,
          permissions: Array.from(values.permissions),
          ignoredFiles: appendInheritedIgnoredFiles(values.ignoredFiles, server.ignoredFiles),
          captcha: captchaToken,
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).subusers.all(),
        });
        addToast(t('pages.server.subusers.modal.createSubuser.toast.created', {}), 'success');
      },
      onError: (err) => {
        const message = httpErrorToHuman(err);

        if (isAxiosError(err) && err.response?.status === 404) {
          if (message === 'user not found, they must sign in before being added') {
            addToast(t('pages.server.subusers.modal.createSubuser.toast.userMustSignIn', {}), 'error');
            return;
          }
          if (message === 'user not found, an administrator must create their account') {
            addToast(t('pages.server.subusers.modal.createSubuser.toast.userMustBeCreatedByAdmin', {}), 'error');
            return;
          }
        }

        addToast(message, 'error');
      },
    },
  );

  return (
    <FormModal
      title={t('pages.server.subusers.modal.createSubuser.title', {})}
      isDirty={isDirty}
      loading={loading}
      size='95%'
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        {!passwordLoginEnabled && (
          <Alert color='blue' icon={<FontAwesomeIcon icon={faCircleInfo} />}>
            {t('pages.server.subusers.modal.createSubuser.alert.existingAccountRequired', {})}
          </Alert>
        )}

        <TextInput
          withAsterisk
          label={t('common.form.email', {})}
          placeholder={t('pages.server.subusers.modal.createSubuser.form.emailPlaceholder', {})}
          {...ignorePasswordManagerProps}
          {...form.getInputProps('email')}
        />

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
          <div className='mr-auto w-full sm:w-auto'>
            <Captcha {...captcha.props} />
          </div>

          <Button type='submit' loading={loading} disabled={!form.isValid() || !captcha.isValid}>
            {t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
