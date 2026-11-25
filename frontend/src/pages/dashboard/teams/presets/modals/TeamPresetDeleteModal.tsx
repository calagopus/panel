import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteTeamPreset from '@/api/me/teams/presets/deleteTeamPreset.ts';
import TeamPresetSelect from '@/elements/input/TeamPresetSelect.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamPresetSchema, userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  team: z.infer<typeof userTeamSchema>;
  preset: z.infer<typeof userTeamPresetSchema>;
};

export default function TeamPresetDeleteModal({ team, preset, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [replacementPresetUuid, setReplacementPresetUuid] = useState<string | null>(null);

  useEffect(() => {
    if (props.opened) {
      setReplacementPresetUuid(null);
    }
  }, [props.opened]);

  const doDelete = async () => {
    await deleteTeamPreset(team.uuid, preset.uuid, replacementPresetUuid)
      .then(() => {
        props.onClose();
        addToast(t('pages.account.teams.tabs.presets.modal.deletePreset.toast.deleted', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <ConfirmationModal
      {...props}
      title={t('pages.account.teams.tabs.presets.modal.deletePreset.title', {})}
      confirm={t('common.button.delete', {})}
      onConfirmed={doDelete}
    >
      <Stack>
        {t('common.modal.delete.content', { name: preset.name }).md()}

        <TeamPresetSelect
          clearable
          label={t('pages.account.teams.tabs.presets.modal.deletePreset.form.replacement', {})}
          description={t('pages.account.teams.tabs.presets.modal.deletePreset.form.replacementDescription', {})}
          team={team}
          exclude={[preset.uuid]}
          value={replacementPresetUuid}
          onChange={setReplacementPresetUuid}
        />
      </Stack>
    </ConfirmationModal>
  );
}
