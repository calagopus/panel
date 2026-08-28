import { faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import classNames from 'classnames';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateAccount from '@/api/me/account/updateAccount.ts';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/Stack.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { dashboardAccountSchema } from '@/lib/schemas/dashboard.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { AccountCardProps } from './DashboardAccount.tsx';

export default function AccountContainer({ requireTwoFactorActivation }: AccountCardProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { user, setUser } = useAuth();
  const languages = useGlobalStore((state) => state.languages);
  const settings = useGlobalStore((state) => state.settings);

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof dashboardAccountSchema>>({
    initialValues: {
      username: '',
      nameFirst: '',
      nameLast: '',
      language: '',
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(dashboardAccountSchema),
  });

  useEffect(() => {
    if (user) {
      form.setValues({
        username: user.username,
        nameFirst: user.nameFirst ?? '',
        nameLast: user.nameLast ?? '',
        language: user.language,
      });
    }
  }, [user]);

  const doUpdate = () => {
    setLoading(true);

    const values = dashboardAccountSchema.parse(form.values);

    updateAccount(values)
      .then(() => {
        addToast(t('pages.account.account.containers.account.toast.updated', {}), 'success');

        setUser({
          ...user!,
          ...values,
        });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <TitleCard
      title={t('pages.account.account.containers.account.title', {})}
      icon={<FontAwesomeIcon icon={faUser} />}
      className={classNames('h-full order-50', requireTwoFactorActivation && 'blur-xs pointer-events-none select-none')}
    >
      <form onSubmit={form.onSubmit(() => doUpdate())} className='h-full'>
        <Stack h='100%'>
          <Group grow>
            <TextInput
              label={t('common.form.firstName', {})}
              autoComplete='given-name'
              {...form.getInputProps('nameFirst')}
            />
            <TextInput
              label={t('common.form.lastName', {})}
              autoComplete='family-name'
              {...form.getInputProps('nameLast')}
            />
          </Group>
          <Group grow>
            <TextInput
              withAsterisk
              label={t('common.form.username', {})}
              autoComplete='username'
              {...form.getInputProps('username')}
            />
            {settings.user.allowChangingLanguage && (
              <Select
                withAsterisk
                label={t('common.form.language', {})}
                data={languages.map((language) => ({
                  label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
                  value: language,
                }))}
                {...form.getInputProps('language')}
              />
            )}
          </Group>
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
