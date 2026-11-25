import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';
import updateTeamMember from '@/api/me/teams/members/updateTeamMember.ts';
import Button from '@/elements/buttons/Button.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import TeamPresetSelect from '@/elements/input/TeamPresetSelect.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { grantableTeamManagement } from '@/lib/domain/teams.ts';
import { teamMemberManagementLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  userTeamMemberManagement,
  userTeamMemberSchema,
  userTeamMemberUpdateSchema,
  userTeamSchema,
} from '@/lib/schemas/user/teams.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  team: z.infer<typeof userTeamSchema>;
  member: z.infer<typeof userTeamMemberSchema>;
};

export default function TeamMemberUpdateModal({ team, member, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof userTeamMemberUpdateSchema>
  >({
    initialValues: {
      presetUuid: member.preset.uuid,
      management: member.management,
    },
    schema: userTeamMemberUpdateSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      await updateTeamMember(team.uuid, member.user.uuid, values);
      queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
      addToast(t('pages.account.teams.tabs.members.modal.updateMember.toast.updated', {}), 'success');
    },
  });

  useEffect(() => {
    if (props.opened) {
      const values = {
        presetUuid: member.preset.uuid,
        management: member.management,
      };

      form.setValues(values);
      form.resetDirty(values);
    }
  }, [props.opened]);

  // what the member already holds stays listed even when the caller could not hand it out
  const managementOptions = userTeamMemberManagement.options.filter(
    (management) => grantableTeamManagement(team).includes(management) || member.management.includes(management),
  );

  return (
    <FormModal
      title={t('pages.account.teams.tabs.members.modal.updateMember.title', { username: member.user.username })}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TeamPresetSelect
          withAsterisk
          allowDeselect={false}
          label={t('pages.account.teams.tabs.members.form.preset', {})}
          description={t('pages.account.teams.tabs.members.form.presetDescription', {})}
          team={team}
          includeItems={[member.preset]}
          value={form.values.presetUuid || null}
          onChange={(uuid) => form.setFieldValue('presetUuid', uuid ?? '')}
          error={form.errors.presetUuid}
        />

        <MultiSelect
          label={t('pages.account.teams.tabs.members.form.management', {})}
          description={t('pages.account.teams.tabs.members.form.managementDescription', {})}
          data={managementOptions.map((management) => ({
            value: management,
            label: teamMemberManagementLabelMapping[management](),
          }))}
          {...form.getInputProps('management')}
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
