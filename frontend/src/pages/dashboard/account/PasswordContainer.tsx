import { faUserLock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updatePassword from '@/api/me/account/updatePassword.ts';
import deleteSessions from '@/api/me/sessions/deleteSessions.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { dashboardPasswordSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { AccountCardProps } from './DashboardAccount.tsx';

export default function PasswordContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState<'logOutOtherSessions' | null>(null);

  const form = useForm<z.infer<typeof dashboardPasswordSchema>>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(
      dashboardPasswordSchema.refine((data) => !user?.hasPassword || data.currentPassword.length > 0, {
        message: t('common.form.passwordRequired', {}),
        path: ['currentPassword'],
      }),
    ),
  });

  const doUpdate = () => {
    if (!user) return;

    setLoading(true);

    updatePassword({
      password: user.hasPassword ? form.values.currentPassword : 'aaa',
      newPassword: form.values.newPassword,
    })
      .then(() => {
        if (!user.hasPassword) {
          setUser({ ...user!, hasPassword: true });
        }

        addToast(t('pages.account.account.containers.password.toast.updated', {}), 'success');
        form.reset();
        setOpenModal('logOutOtherSessions');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  const doLogOutOtherSessions = async () => {
    const { deleted } = await deleteSessions();

    setOpenModal(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.user.sessions.all() });
    addToast(
      t('pages.account.account.containers.password.modal.logOutOtherSessions.toast.deleted', {
        sessions: tItem('session', deleted),
      }),
      'success',
    );
  };

  if (!user) {
    return <Spinner.Centered />;
  }

  return (
    <TitleCard
      title={t('pages.account.account.containers.password.title', {})}
      icon={<FontAwesomeIcon icon={faUserLock} />}
      className={classNames('h-full order-10', requireTwoFactorActivation && 'blur-xs pointer-events-none select-none')}
    >
      <ConfirmationModal
        opened={openModal === 'logOutOtherSessions'}
        onClose={() => setOpenModal(null)}
        title={t('pages.account.account.containers.password.modal.logOutOtherSessions.title', {})}
        confirm={t('pages.account.account.containers.password.button.logOutOthers', {})}
        onConfirmed={doLogOutOtherSessions}
      >
        {t('pages.account.account.containers.password.modal.logOutOtherSessions.content', {}).md()}
      </ConfirmationModal>

      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          {user.hasPassword && (
            <PasswordInput
              withAsterisk
              label={t('common.form.currentPassword', {})}
              autoComplete='current-password'
              {...form.getInputProps('currentPassword')}
            />
          )}
          <PasswordInput
            withAsterisk
            label={t('pages.account.account.containers.password.form.newPassword', {})}
            autoComplete='new-password'
            {...form.getInputProps('newPassword')}
          />
          <PasswordInput
            withAsterisk
            label={t('pages.account.account.containers.password.form.confirmNewPassword', {})}
            autoComplete='new-password'
            {...form.getInputProps('confirmNewPassword')}
          />

          <Group mt='auto'>
            <Button type='submit' disabled={!form.isValid()} loading={loading}>
              {t('common.button.update', {})}
            </Button>
          </Group>
        </Stack>
      </form>
    </TitleCard>
  );
}
