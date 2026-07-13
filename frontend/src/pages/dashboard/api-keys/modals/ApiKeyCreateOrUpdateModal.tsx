import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getPermissions from '@/api/getPermissions.ts';
import createApiKey from '@/api/me/api-keys/createApiKey.ts';
import updateApiKey from '@/api/me/api-keys/updateApiKey.ts';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import DateTimePicker from '@/elements/input/DateTimePicker.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userApiKeySchema, userApiKeyUpdateSchema } from '@/lib/schemas/user/apiKeys.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type Props = ModalProps & {
  contextApiKey?: z.infer<typeof userApiKeySchema>;
  onCreated?: (token: string) => void;
};

export default function ApiKeyCreateOrUpdateModal({ contextApiKey, onCreated, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { availablePermissions, setAvailablePermissions } = useGlobalStore();
  const { user } = useAuth();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof userApiKeyUpdateSchema>>({
    initialValues: {
      name: '',
      allowedIps: [],
      userPermissions: [],
      serverPermissions: [],
      adminPermissions: [],
      expires: null,
    },
    validate: zod4Resolver(userApiKeyUpdateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      if (contextApiKey) {
        await updateApiKey(contextApiKey.uuid, values);
        addToast(t('pages.account.apiKeys.modal.updateApiKey.toast.updated', {}), 'success');
      } else {
        const key = await createApiKey(values);
        addToast(t('pages.account.apiKeys.modal.createApiKey.toast.created', {}), 'success');
        onCreated?.(key.key);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.user.apiKeys.all() });
    },
  });

  useEffect(() => {
    if (contextApiKey) {
      form.setValues({
        name: contextApiKey.name,
        allowedIps: contextApiKey.allowedIps,
        userPermissions: contextApiKey.userPermissions,
        serverPermissions: contextApiKey.serverPermissions,
        adminPermissions: contextApiKey.adminPermissions,
        expires: contextApiKey.expires ? new Date(contextApiKey.expires) : null,
      });
    } else {
      form.reset();
    }
  }, [contextApiKey]);

  useEffect(() => {
    getPermissions()
      .then((res) => {
        setAvailablePermissions(res);
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      });
  }, []);

  return (
    <FormModal
      title={
        contextApiKey
          ? t('pages.account.apiKeys.modal.updateApiKey.title', {})
          : t('pages.account.apiKeys.modal.createApiKey.title', {})
      }
      isDirty={isDirty}
      loading={loading}
      size='95%'
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Group grow>
          <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

          <DateTimePicker
            label={t('pages.account.apiKeys.table.columns.expires', {})}
            clearable
            value={form.values.expires}
            onChange={(value) => form.setFieldValue('expires', value ? new Date(value) : null)}
          />
        </Group>

        <TagsInput
          label={t('pages.account.apiKeys.form.allowedIps', {})}
          placeholder={t('pages.account.apiKeys.form.allowedIpsPlaceholder', {})}
          {...form.getInputProps('allowedIps')}
        />

        {availablePermissions?.userPermissions && (
          <PermissionSelector
            label={t('pages.account.apiKeys.form.userPermissions', {})}
            permissionsMapType='userPermissions'
            permissions={availablePermissions.userPermissions}
            selectedPermissions={form.values.userPermissions}
            setSelectedPermissions={(permissions) => form.setFieldValue('userPermissions', permissions)}
          />
        )}
        {availablePermissions?.serverPermissions && (
          <PermissionSelector
            label={t('pages.account.apiKeys.form.serverPermissions', {})}
            permissionsMapType='serverPermissions'
            permissions={availablePermissions.serverPermissions}
            selectedPermissions={form.values.serverPermissions}
            setSelectedPermissions={(permissions) => form.setFieldValue('serverPermissions', permissions)}
          />
        )}
        {user!.admin && availablePermissions?.adminPermissions && (
          <PermissionSelector
            label={t('pages.account.apiKeys.form.adminPermissions', {})}
            permissionsMapType='adminPermissions'
            permissions={availablePermissions.adminPermissions}
            selectedPermissions={form.values.adminPermissions}
            setSelectedPermissions={(permissions) => form.setFieldValue('adminPermissions', permissions)}
          />
        )}

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.save', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
