import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import createTeamMember from '@/api/admin/teams/members/createTeamMember.ts';
import getTeamPresets from '@/api/admin/teams/presets/getTeamPresets.ts';
import getUsers from '@/api/admin/users/getUsers.ts';
import Button from '@/elements/buttons/Button.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import Select from '@/elements/input/Select.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { teamMemberManagementLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminTeamMemberCreateSchema, adminTeamSchema } from '@/lib/schemas/admin/teams.ts';
import { adminFullUserSchema } from '@/lib/schemas/admin/users.ts';
import { userTeamMemberManagement, userTeamPresetSchema } from '@/lib/schemas/user/teams.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  team: z.infer<typeof adminTeamSchema>;
};

export default function TeamMemberCreateModal({ team, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const users = useInfiniteSearchableResource<z.infer<typeof adminFullUserSchema>>({
    queryKey: queryKeys.admin.users.all(),
    fetcher: (page, search) => getUsers(page, search),
  });

  const presets = useInfiniteSearchableResource<z.infer<typeof userTeamPresetSchema>>({
    queryKey: queryKeys.admin.teams.presets(team.uuid),
    fetcher: (page, search) => getTeamPresets(team.uuid, page, search),
  });

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof adminTeamMemberCreateSchema>
  >({
    initialValues: {
      userUuid: '',
      presetUuid: '',
      management: [],
    },
    schema: adminTeamMemberCreateSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createTeamMember(team.uuid, values);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.teams.all() });
      addToast(t('pages.admin.teams.tabs.members.page.toast.created', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.admin.teams.tabs.members.page.modal.create.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <Select
          withAsterisk
          label={t('pages.admin.teams.tabs.members.page.form.user', {})}
          data={users.items
            .filter((user) => user.uuid !== team.owner.uuid)
            .map((user) => ({ label: `${user.username} (${user.email})`, value: user.uuid }))}
          searchable
          searchValue={users.search}
          onSearchChange={users.setSearch}
          infiniteScroll={users.infiniteScroll}
          loading={users.loading}
          {...form.getInputProps('userUuid')}
        />

        <Select
          withAsterisk
          label={t('pages.account.teams.tabs.members.form.preset', {})}
          data={presets.items.map((preset) => ({ label: preset.name, value: preset.uuid }))}
          searchable
          searchValue={presets.search}
          onSearchChange={presets.setSearch}
          infiniteScroll={presets.infiniteScroll}
          loading={presets.loading}
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

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid()}>
            {t('common.button.add', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
