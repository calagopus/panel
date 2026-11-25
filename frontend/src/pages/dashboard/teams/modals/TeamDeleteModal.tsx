import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteTeam from '@/api/me/teams/deleteTeam.ts';
import ForceDeleteModal from '@/elements/modals/ForceDeleteModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = Omit<ModalProps, 'title' | 'children'> & {
  team: z.infer<typeof userTeamSchema>;
};

export default function TeamDeleteModal({ team, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [deleteDoForce, setDeleteDoForce] = useState(false);

  const doDelete = () =>
    deleteTeam(team.uuid, { force: deleteDoForce })
      .then(() => {
        addToast(t('pages.account.teams.modal.deleteTeam.toast.deleted', {}), 'success');
        setDeleteDoForce(false);
        props.onClose();
        queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.user.servers.all() });
        navigate('/account/teams');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });

  return (
    <ForceDeleteModal
      title={t('pages.account.teams.modal.deleteTeam.title', {})}
      name={team.name}
      force={deleteDoForce}
      onForceChange={setDeleteDoForce}
      forceWarning={t('pages.account.teams.modal.deleteTeam.alert.forceWarning', {})}
      onConfirmed={doDelete}
      {...props}
    />
  );
}
