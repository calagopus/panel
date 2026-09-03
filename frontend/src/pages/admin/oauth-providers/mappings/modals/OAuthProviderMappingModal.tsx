import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import createOAuthProviderMapping from '@/api/admin/oauth-providers/mappings/createOAuthProviderMapping.ts';
import updateOAuthProviderMapping from '@/api/admin/oauth-providers/mappings/updateOAuthProviderMapping.ts';
import getRoles from '@/api/admin/roles/getRoles.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import Button from '@/elements/buttons/Button.tsx';
import IgnoredFilesInput from '@/elements/input/IgnoredFilesInput.tsx';
import Select from '@/elements/input/Select.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import Text from '@/elements/typography/Text.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderMappingSchema, adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useSearchableResource } from '@/plugins/resource/useSearchableResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import OAuthProviderMappingMatcherBuilder from '../OAuthProviderMappingMatcherBuilder.tsx';
import {
  type OAuthProviderMappingFormValues,
  oauthProviderMappingEmptyFormValues,
  oauthProviderMappingFormValuesToPayload,
  oauthProviderMappingToFormValues,
} from '../oauthProviderMappingFormValues.ts';

export default function OAuthProviderMappingModal({
  oauthProvider,
  mapping,
  onSaved,
  ...props
}: ModalProps & {
  oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
  mapping?: z.infer<typeof adminOAuthProviderMappingSchema>;
  onSaved: () => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const availablePermissions = useGlobalStore((state) => state.availablePermissions);
  const canReadRoles = useAdminCan('roles.read');

  const isEdit = !!mapping;

  const roles = useSearchableResource<z.infer<typeof roleSchema>>({
    queryKey: queryKeys.admin.roles.all(),
    fetcher: (search) => getRoles(1, search),
    canRequest: canReadRoles,
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<OAuthProviderMappingFormValues>({
    initialValues: oauthProviderMappingEmptyFormValues,
    opened: props.opened,
    hydrate: () => (mapping ? oauthProviderMappingToFormValues(mapping) : undefined),
    onClose: props.onClose,
    onSubmit: async (values) => {
      const payload = oauthProviderMappingFormValuesToPayload(values);

      if (isEdit) {
        await updateOAuthProviderMapping(oauthProvider.uuid, mapping.uuid, payload);
        addToast(t('pages.admin.oAuthProviders.tabs.mappings.page.toast.updated', {}), 'success');
      } else {
        await createOAuthProviderMapping(oauthProvider.uuid, payload);
        addToast(t('pages.admin.oAuthProviders.tabs.mappings.page.toast.created', {}), 'success');
      }

      onSaved();
    },
  });

  const roleOptions = roles.items.map((role) => ({ label: role.name, value: role.uuid }));
  if (form.values.roleUuid && !roleOptions.some((o) => o.value === form.values.roleUuid)) {
    roleOptions.unshift({ label: form.values.roleUuid, value: form.values.roleUuid });
  }

  const canSubmit = form.values.type === 'role' ? !!form.values.roleUuid : !!form.values.serverUuid;

  return (
    <FormModal
      title={t(
        isEdit
          ? 'pages.admin.oAuthProviders.tabs.mappings.page.modal.edit.title'
          : 'pages.admin.oAuthProviders.tabs.mappings.page.modal.add.title',
        {},
      )}
      isDirty={isDirty}
      loading={loading}
      size={form.values.type === 'role' ? 'lg' : '95%'}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Select
          withAsterisk
          label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.mappingType', {})}
          allowDeselect={false}
          data={[
            { label: t('pages.admin.oAuthProviders.tabs.mappings.page.enum.mappingType.role', {}), value: 'role' },
            {
              label: t('pages.admin.oAuthProviders.tabs.mappings.page.enum.mappingType.serverSubuser', {}),
              value: 'server_subuser',
            },
          ]}
          {...form.getInputProps('type')}
        />

        {form.values.type === 'role' ? (
          <Select
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.role', {})}
            data={roleOptions}
            searchable
            searchValue={roles.search}
            onSearchChange={roles.setSearch}
            loading={roles.loading}
            {...form.getInputProps('roleUuid')}
          />
        ) : (
          <>
            <ServerSelect<z.infer<typeof adminServerSchema>>
              withAsterisk
              label={t('common.form.server', {})}
              queryKey={queryKeys.admin.servers.all()}
              fetcher={(search) => getServers(1, search)}
              value={form.values.serverUuid}
              error={form.errors.serverUuid}
              onChange={(value) => form.setFieldValue('serverUuid', value || '')}
            />

            <PermissionSelector
              label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.permissions', {})}
              permissionsMapType='serverPermissions'
              permissions={availablePermissions.serverPermissions}
              selectedPermissions={form.values.permissions}
              setSelectedPermissions={(permissions) => form.setFieldValue('permissions', permissions)}
            />

            <IgnoredFilesInput
              label={t('common.form.ignoredFiles', {})}
              value={form.values.ignoredFiles}
              onChange={(value) => form.setFieldValue('ignoredFiles', value)}
            />
          </>
        )}

        <Switch
          label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.revokeUnmatched', {})}
          description={t('pages.admin.oAuthProviders.tabs.mappings.page.form.revokeUnmatchedDescription', {})}
          {...form.getInputProps('revokeUnmatched', { type: 'checkbox' })}
        />

        <Divider />

        <div>
          <Text fw={500}>{t('pages.admin.oAuthProviders.tabs.mappings.page.form.matcher', {})}</Text>
          <Text size='xs' c='dimmed'>
            {t('pages.admin.oAuthProviders.tabs.mappings.page.form.matcherDescription', {})}
          </Text>
        </div>

        <OAuthProviderMappingMatcherBuilder
          matcher={form.values.matcher}
          onChange={(matcher) => form.setFieldValue('matcher', matcher)}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!canSubmit}>
            {isEdit ? t('common.button.save', {}) : t('common.button.create', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
