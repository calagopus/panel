import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { ModalProps, useModalsStack } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import createApiKey from '@/api/me/api-keys/createApiKey.ts';
import updateApiKey from '@/api/me/api-keys/updateApiKey.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import DateTimePicker from '@/elements/input/DateTimePicker.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userApiKeySchema, userApiKeyUpdateSchema } from '@/lib/schemas/user/apiKeys.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useAvailablePermissions } from '@/plugins/useAvailablePermissions.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  contextApiKey?: z.infer<typeof userApiKeySchema>;
  onCreated?: (token: string) => void;
};

export default function ApiKeyCreateOrUpdateModal({ contextApiKey, onCreated, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { availablePermissions } = useAvailablePermissions();
  const { user } = useAuth();
  const stack = useModalsStack(['form', 'enableUnrestrictedAdmin']);

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<z.infer<typeof userApiKeyUpdateSchema>>({
    initialValues: {
      name: '',
      allowedIps: [],
      enabled: true,
      userPermissions: [],
      serverPermissions: [],
      adminPermissions: [],
      unrestrictedAdmin: false,
      expires: null,
    },
    schema: userApiKeyUpdateSchema,
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
    if (props.opened) {
      stack.open('form');
    } else {
      stack.closeAll();
    }
  }, [props.opened]);

  useEffect(() => {
    if (!props.opened) {
      return;
    }

    if (contextApiKey) {
      const values = {
        name: contextApiKey.name,
        allowedIps: contextApiKey.allowedIps,
        enabled: contextApiKey.enabled,
        userPermissions: contextApiKey.userPermissions,
        serverPermissions: contextApiKey.serverPermissions,
        adminPermissions: contextApiKey.adminPermissions,
        unrestrictedAdmin: contextApiKey.unrestrictedAdmin,
        expires: contextApiKey.expires ? new Date(contextApiKey.expires) : null,
      };

      form.setValues(values);
      form.resetDirty(values);
    } else {
      form.reset();
    }
  }, [props.opened]);

  return (
    <Modal.Stack>
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
        {...stack.register('form')}
        onClose={handleClose}
        onSubmit={handleSubmit}
      >
        <Stack>
          {user!.admin && form.values.unrestrictedAdmin && (
            <Alert color='red' icon={faExclamationTriangle}>
              {t('pages.account.apiKeys.alert.unrestrictedAdmin', {}).md()}
            </Alert>
          )}

          <Group grow>
            <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

            <DateTimePicker
              label={t('pages.account.apiKeys.table.columns.expires', {})}
              clearable
              value={form.values.expires}
              onChange={(value) => form.setFieldValue('expires', value ? new Date(value) : null)}
            />
          </Group>

          <Group grow>
            <Switch
              label={t('common.form.enabled', {})}
              name='enabled'
              {...form.getInputProps('enabled', { type: 'checkbox' })}
            />
            {user!.admin && (
              <Switch
                label={t('pages.account.apiKeys.form.unrestrictedAdmin', {})}
                description={t('pages.account.apiKeys.form.unrestrictedAdminDescription', {})}
                name='unrestrictedAdmin'
                checked={form.values.unrestrictedAdmin}
                onChange={(e) =>
                  e.currentTarget.checked
                    ? stack.open('enableUnrestrictedAdmin')
                    : form.setFieldValue('unrestrictedAdmin', false)
                }
              />
            )}
          </Group>

          <TagsInput
            label={t('pages.account.apiKeys.form.allowedIps', {})}
            placeholder='e.g. 192.168.1.1, 2001:db8::1'
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

      <ConfirmationModal
        {...stack.register('enableUnrestrictedAdmin')}
        title={t('pages.account.apiKeys.modal.enableUnrestrictedAdmin.title', {})}
        confirm={t('common.button.enable', {})}
        onConfirmed={() => {
          form.setFieldValue('unrestrictedAdmin', true);
          stack.close('enableUnrestrictedAdmin');
        }}
      >
        {t('pages.account.apiKeys.modal.enableUnrestrictedAdmin.content', {}).md()}
        <Alert color='red' mt='md' icon={faExclamationTriangle}>
          {t('pages.account.apiKeys.alert.unrestrictedAdmin', {}).md()}
        </Alert>
      </ConfirmationModal>
    </Modal.Stack>
  );
}
