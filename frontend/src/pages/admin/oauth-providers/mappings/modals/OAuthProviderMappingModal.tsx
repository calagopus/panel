import { ModalProps } from '@mantine/core';
import { z } from 'zod';
import createOAuthProviderMapping from '@/api/admin/oauth-providers/mappings/createOAuthProviderMapping.ts';
import updateOAuthProviderMapping from '@/api/admin/oauth-providers/mappings/updateOAuthProviderMapping.ts';
import getRoles from '@/api/admin/roles/getRoles.ts';
import getServers from '@/api/admin/servers/getServers.ts';
import getTeams from '@/api/admin/teams/getTeams.ts';
import getTeamPresets from '@/api/admin/teams/presets/getTeamPresets.ts';
import Button from '@/elements/buttons/Button.tsx';
import IgnoredFilesInput from '@/elements/input/IgnoredFilesInput.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import Select from '@/elements/input/Select.tsx';
import ServerSelect from '@/elements/input/ServerSelect.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import PermissionSelector from '@/elements/PermissionSelector.tsx';
import Text from '@/elements/typography/Text.tsx';
import { teamMemberManagementLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminOAuthProviderMappingSchema, adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders.ts';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { userTeamMemberManagement, userTeamPresetSchema } from '@/lib/schemas/user/teams.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useAvailablePermissions } from '@/plugins/useAvailablePermissions.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  type OAuthProviderMappingFormValues,
  oauthProviderMappingEmptyFormValues,
  oauthProviderMappingFormValuesToPayload,
  oauthProviderMappingToFormValues,
} from '../oauthProviderMappingFormValues.ts';
import OAuthProviderMappingMatcherBuilder from '../OAuthProviderMappingMatcherBuilder.tsx';

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
  const { availablePermissions } = useAvailablePermissions();
  const canReadRoles = useAdminCan('roles.read');
  const canReadTeams = useAdminCan('teams.read');

  const isEdit = !!mapping;

  const roles = useInfiniteSearchableResource<z.infer<typeof roleSchema>>({
    queryKey: queryKeys.admin.roles.all(),
    fetcher: (page, search) => getRoles(page, search),
    canRequest: canReadRoles,
  });

  const teams = useInfiniteSearchableResource<z.infer<typeof adminTeamSchema>>({
    queryKey: queryKeys.admin.teams.all(),
    fetcher: (page, search) => getTeams(page, search),
    canRequest: canReadTeams,
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

  const presets = useInfiniteSearchableResource<z.infer<typeof userTeamPresetSchema>>({
    queryKey: queryKeys.admin.teams.presets(form.values.teamUuid),
    fetcher: (page, search) => getTeamPresets(form.values.teamUuid, page, search),
    canRequest: canReadTeams && !!form.values.teamUuid,
  });

  const teamOptions = teams.items.map((team) => ({ label: team.name, value: team.uuid }));
  if (form.values.teamUuid && !teamOptions.some((o) => o.value === form.values.teamUuid)) {
    teamOptions.unshift({ label: form.values.teamUuid, value: form.values.teamUuid });
  }

  const presetOptions = presets.items.map((preset) => ({ label: preset.name, value: preset.uuid }));
  if (form.values.presetUuid && !presetOptions.some((o) => o.value === form.values.presetUuid)) {
    presetOptions.unshift({ label: form.values.presetUuid, value: form.values.presetUuid });
  }

  const canSubmit =
    form.values.type === 'role'
      ? !!form.values.roleUuid
      : form.values.type === 'server_subuser'
        ? !!form.values.serverUuid
        : !!form.values.teamUuid && !!form.values.presetUuid;

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
      size={form.values.type === 'server_subuser' ? '95%' : 'lg'}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Group grow>
          <TextInput label={t('common.form.name', {})} {...form.getInputProps('name')} />

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
              {
                label: t('pages.admin.oAuthProviders.tabs.mappings.page.enum.mappingType.teamMember', {}),
                value: 'team_member',
              },
            ]}
            {...form.getInputProps('type')}
          />
        </Group>

        {form.values.type === 'role' ? (
          <Select
            withAsterisk
            label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.role', {})}
            data={roleOptions}
            searchable
            searchValue={roles.search}
            onSearchChange={roles.setSearch}
            infiniteScroll={roles.infiniteScroll}
            loading={roles.loading}
            {...form.getInputProps('roleUuid')}
          />
        ) : form.values.type === 'team_member' ? (
          <>
            <Select
              withAsterisk
              label={t('pages.admin.oAuthProviders.tabs.mappings.page.form.team', {})}
              data={teamOptions}
              renderOption={({ option }) => {
                const owner = teams.items.find((team) => team.uuid === option.value)?.owner;

                return (
                  <div className='flex items-center justify-between gap-2 w-full'>
                    <span className='truncate'>{option.label}</span>
                    {owner && (
                      <Text size='xs' c='dimmed' truncate>
                        {owner.username}
                      </Text>
                    )}
                  </div>
                );
              }}
              searchable
              searchValue={teams.search}
              onSearchChange={teams.setSearch}
              infiniteScroll={teams.infiniteScroll}
              loading={teams.loading}
              value={form.values.teamUuid}
              error={form.errors.teamUuid}
              onChange={(value) => {
                form.setFieldValue('teamUuid', value || '');
                form.setFieldValue('presetUuid', '');
              }}
            />

            <Select
              withAsterisk
              label={t('pages.account.teams.tabs.members.form.preset', {})}
              data={presetOptions}
              searchable
              searchValue={presets.search}
              onSearchChange={presets.setSearch}
              infiniteScroll={presets.infiniteScroll}
              loading={presets.loading}
              disabled={!form.values.teamUuid}
              {...form.getInputProps('presetUuid')}
            />

            <MultiSelect
              label={t('pages.account.teams.tabs.members.form.management', {})}
              description={t('pages.account.teams.tabs.members.form.managementDescription', {})}
              data={userTeamMemberManagement.options.map((management) => ({
                value: management,
                label: teamMemberManagementLabelMapping[management](),
              }))}
              {...form.getInputProps('management')}
            />
          </>
        ) : (
          <>
            <ServerSelect<z.infer<typeof adminServerSchema>>
              withAsterisk
              label={t('common.form.server', {})}
              queryKey={queryKeys.admin.servers.all()}
              paginatedFetcher={(page, search) => getServers(page, search)}
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
          sources={Object.keys(oauthProvider.infoUrls)}
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
