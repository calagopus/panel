import { ModalProps, Stack } from '@mantine/core';
import { useEffect } from 'react';
import { z } from 'zod';
import createOAuthProviderMapping from '@/api/admin/oauth-providers/mappings/createOAuthProviderMapping.ts';
import updateOAuthProviderMapping from '@/api/admin/oauth-providers/mappings/updateOAuthProviderMapping.ts';
import getRoles from '@/api/admin/roles/getRoles.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderMappingSchema, adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';

type MappingType = 'role' | 'server_subuser';

type FormValues = {
  scopes: string[];
  type: MappingType;
  roleUuid: string;
  serverUuid: string;
  permissions: string[];
  ignoredFiles: string[];
};

export default function OAuthProviderMappingModal({
  oauthProvider,
  mapping,
  opened,
  onClose,
  onSaved,
}: ModalProps & {
  oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
  mapping?: z.infer<typeof adminOAuthProviderMappingSchema>;
  onSaved: () => void;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { availablePermissions } = useGlobalStore();

  const isEdit = !!mapping;

  const roles = useSearchableResource<z.infer<typeof roleSchema>>({
    queryKey: queryKeys.admin.roles.all(),
    fetcher: (search) => getRoles(1, search),
  });

  const servers = useSearchableResource<z.infer<typeof adminServerSchema>>({
    queryKey: queryKeys.admin.servers.all(),
    fetcher: (search) => getServers(1, search),
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<FormValues>({
    initialValues: {
      scopes: [],
      type: 'role',
      roleUuid: '',
      serverUuid: '',
      permissions: [],
      ignoredFiles: [],
    },
    onClose,
    onSubmit: async (values) => {
      const mappingData =
        values.type === 'role'
          ? { type: 'role' as const, roleUuid: values.roleUuid }
          : {
              type: 'server_subuser' as const,
              serverUuid: values.serverUuid,
              permissions: values.permissions,
              ignoredFiles: values.ignoredFiles,
            };

      const payload = { scopes: values.scopes, mapping: mappingData };

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

  useEffect(() => {
    if (!opened) {
      return;
    }

    if (mapping) {
      form.setValues({
        scopes: mapping.scopes,
        type: mapping.mapping.type,
        roleUuid: mapping.mapping.type === 'role' ? mapping.mapping.roleUuid : '',
        serverUuid: mapping.mapping.type === 'server_subuser' ? mapping.mapping.serverUuid : '',
        permissions: mapping.mapping.type === 'server_subuser' ? mapping.mapping.permissions : [],
        ignoredFiles: mapping.mapping.type === 'server_subuser' ? mapping.mapping.ignoredFiles : [],
      });
    } else {
      form.reset();
    }
  }, [opened, mapping]);

  const roleOptions = roles.items.map((role) => ({ label: role.name, value: role.uuid }));
  if (form.values.roleUuid && !roleOptions.some((o) => o.value === form.values.roleUuid)) {
    roleOptions.unshift({ label: form.values.roleUuid, value: form.values.roleUuid });
  }

  const serverOptions = servers.items.map((server) => ({ label: server.name, value: server.uuid }));
  if (form.values.serverUuid && !serverOptions.some((o) => o.value === form.values.serverUuid)) {
    serverOptions.unshift({ label: form.values.serverUuid, value: form.values.serverUuid });
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
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
      size={form.values.type === 'role' ? 'md' : '95%'}
    >
      <Stack>
        <TagsInput
          label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.scopes', {})}
          description={t('pages.admin.oAuthProviders.tabs.mappings.page.form.scopesDescription', {})}
          {...form.getInputProps('scopes')}
        />

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
            <Select
              withAsterisk
              label={t('common.form.server', {})}
              data={serverOptions}
              searchable
              searchValue={servers.search}
              onSearchChange={servers.setSearch}
              loading={servers.loading}
              {...form.getInputProps('serverUuid')}
            />

            <PermissionSelector
              label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.permissions', {})}
              permissionsMapType='serverPermissions'
              permissions={availablePermissions.serverPermissions}
              selectedPermissions={form.values.permissions}
              setSelectedPermissions={(permissions) => form.setFieldValue('permissions', permissions)}
            />

            <TagsInput label={t('common.form.ignoredFiles', {})} {...form.getInputProps('ignoredFiles')} />
          </>
        )}

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
