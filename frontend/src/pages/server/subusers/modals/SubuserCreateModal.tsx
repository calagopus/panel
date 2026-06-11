import { ModalProps, Stack } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useRef } from 'react';
import { z } from 'zod';
import createSubuser from '@/api/server/subusers/createSubuser.ts';
import Button from '@/elements/Button.tsx';
import Captcha, { CaptchaRef } from '@/elements/Captcha.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { serverSubuserCreateSchema } from '@/lib/schemas/server/subusers.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

export default function SubuserCreateModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, addSubuser } = useServerStore();
  const { availablePermissions } = useGlobalStore();

  const captchaRef = useRef<CaptchaRef>(null);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof serverSubuserCreateSchema>>(
    {
      initialValues: {
        email: '',
        permissions: [],
        ignoredFiles: [],
      },
      validate: zod4Resolver(serverSubuserCreateSchema),
      onClose,
      onSubmit: async (values) => {
        const captcha = (await captchaRef.current?.getToken()) ?? null;
        const subuser = await createSubuser(server.uuid, {
          email: values.email,
          permissions: Array.from(values.permissions),
          ignoredFiles: values.ignoredFiles,
          captcha,
        });
        addSubuser(subuser);
        addToast(t('pages.server.subusers.modal.createSubuser.toast.created', {}), 'success');
      },
    },
  );

  return (
    <FormModal
      title={t('pages.server.subusers.modal.createSubuser.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
      size='95%'
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.email', {})}
          placeholder={t('pages.server.subusers.modal.createSubuser.form.emailPlaceholder', {})}
          {...form.getInputProps('email')}
        />

        <PermissionSelector
          label={t('pages.server.subusers.modal.createSubuser.form.permissions', {})}
          permissionsMapType='serverPermissions'
          permissions={availablePermissions.serverPermissions}
          selectedPermissions={form.values.permissions}
          setSelectedPermissions={(permissions) => form.setFieldValue('permissions', permissions)}
        />

        <TagsInput
          label={t('common.form.ignoredFiles', {})}
          description={t('pages.server.subusers.modal.createSubuser.form.ignoredFilesDescription', {})}
          {...form.getInputProps('ignoredFiles')}
        />

        <Captcha ref={captchaRef} />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
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
