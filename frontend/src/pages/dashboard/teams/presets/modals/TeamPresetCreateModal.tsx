import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import createTeamPreset from '@/api/me/teams/presets/createTeamPreset.ts';
import Button from '@/elements/buttons/Button.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { appendInheritedIgnoredFiles } from '@/lib/domain/subusers.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamPresetUpdateSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TeamPresetFields from '../TeamPresetFields.tsx';

type Props = ModalProps & {
  team: z.infer<typeof userTeamSchema>;
};

export default function TeamPresetCreateModal({ team, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof userTeamPresetUpdateSchema>
  >({
    initialValues: {
      name: '',
      description: '',
      weight: 0,
      permissions: [],
      ignoredFiles: [],
    },
    schema: userTeamPresetUpdateSchema,
    onClose: props.onClose,
    onSubmit: async (values) => {
      await createTeamPreset(team.uuid, {
        ...userTeamPresetUpdateSchema.parse(values),
        permissions: Array.from(values.permissions),
        ignoredFiles: appendInheritedIgnoredFiles(values.ignoredFiles, team.membership?.preset.ignoredFiles ?? []),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.presets(team.uuid) });
      addToast(t('pages.account.teams.tabs.presets.modal.createPreset.toast.created', {}), 'success');
    },
  });

  return (
    <FormModal
      title={t('pages.account.teams.tabs.presets.modal.createPreset.title', {})}
      isDirty={isDirty}
      loading={loading}
      size='95%'
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TeamPresetFields team={team} form={form} />

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
