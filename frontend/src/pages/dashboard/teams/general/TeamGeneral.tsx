import { faArrowRightFromBracket, faCog, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateTeam from '@/api/me/teams/updateTeam.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Text from '@/elements/typography/Text.tsx';
import { isTeamMember, teamManagementLabel } from '@/lib/domain/teams.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { userTeamSchema, userTeamUpdateSchema } from '@/lib/schemas/user/teams.ts';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import TeamDeleteModal from '../modals/TeamDeleteModal.tsx';
import TeamLeaveModal from '../modals/TeamLeaveModal.tsx';

export default function TeamGeneral({ team }: { team: z.infer<typeof userTeamSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [openModal, setOpenModal] = useState<'delete' | 'leave' | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof userTeamUpdateSchema>>({
    initialValues: {
      name: team.name,
      description: team.description ?? '',
    },
    ...liveValidation,
    validate: zod4Resolver(userTeamUpdateSchema),
  });

  useEffect(() => {
    form.setValues({ name: team.name, description: team.description ?? '' });
  }, [team.name, team.description]);

  const doUpdate = () => {
    setLoading(true);

    updateTeam(team.uuid, userTeamUpdateSchema.parse(form.values))
      .then(() => {
        addToast(t('pages.account.teams.tabs.general.toast.updated', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.user.teams.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  if (isTeamMember(team)) {
    return (
      <>
        <TeamLeaveModal
          team={team}
          opened={openModal === 'leave'}
          onClose={() => setOpenModal(null)}
          onLeft={() => navigate('/account/teams')}
        />

        <TitleCard title={t('pages.account.teams.tabs.general.membership.title', {})} icon={faCog}>
          <Stack>
            <Text>
              {t('pages.account.teams.tabs.general.membership.content', {
                owner: team.owner.username,
                preset: team.membership.preset.name,
                management: teamManagementLabel(team.membership.management),
              }).md()}
            </Text>

            <Group>
              <Button
                color='red'
                leftSection={<FontAwesomeIcon icon={faArrowRightFromBracket} />}
                onClick={() => setOpenModal('leave')}
              >
                {t('pages.account.teams.button.leave', {})}
              </Button>
            </Group>
          </Stack>
        </TitleCard>
      </>
    );
  }

  return (
    <>
      <TeamDeleteModal team={team} opened={openModal === 'delete'} onClose={() => setOpenModal(null)} />

      <TitleCard title={t('pages.account.teams.tabs.general.settings.title', {})} icon={faCog}>
        <form onSubmit={form.onSubmit(() => doUpdate())}>
          <Stack>
            <TextInput withAsterisk label={t('common.form.name', {})} {...form.getInputProps('name')} />

            <TextArea label={t('common.form.description', {})} rows={3} {...form.getInputProps('description')} />

            <Group>
              <Button type='submit' loading={loading} disabled={!form.isValid()}>
                {t('common.button.save', {})}
              </Button>
              <Button
                color='red'
                leftSection={<FontAwesomeIcon icon={faTrash} />}
                onClick={() => setOpenModal('delete')}
              >
                {t('common.button.delete', {})}
              </Button>
            </Group>
          </Stack>
        </form>
      </TitleCard>
    </>
  );
}
