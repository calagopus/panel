import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import leaveTeam from '@/api/me/teams/leaveTeam.ts';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = Omit<ModalProps, 'title' | 'children'> & {
  team: z.infer<typeof userTeamSchema>;
  onLeft?: () => void;
};

export default function TeamLeaveModal({ team, onLeft, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const doLeave = () =>
    leaveTeam(team.uuid)
      .then(() => {
        addToast(t('pages.account.teams.modal.leaveTeam.toast.left', {}), 'success');
        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.user.servers.all() });
        onLeft?.();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  return (
    <ConfirmationModal
      title={t('pages.account.teams.modal.leaveTeam.title', {})}
      confirm={t('pages.account.teams.button.leave', {})}
      onConfirmed={doLeave}
      {...props}
    >
      {t('pages.account.teams.modal.leaveTeam.content', { name: team.name }).md()}
    </ConfirmationModal>
  );
}
