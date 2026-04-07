import { faAddressCard, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Stack, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getSettings from '@/api/admin/settings/getSettings.ts';
import updateApplicationSettings from '@/api/admin/settings/updateApplicationSettings.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateAccount from '@/api/me/account/updateAccount.ts';
import AlertError from '@/elements/alerts/AlertError.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { oobeConfigurationSchema } from '@/lib/schemas/oobe.ts';
import { useAuth } from '@/providers/AuthProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { OobeComponentProps } from '@/routers/OobeRouter.tsx';
import { useGlobalStore } from '@/stores/global.ts';

export default function OobeConfiguration({ onNext }: OobeComponentProps) {
  const { t, setLanguage } = useTranslations();
  const { languages } = useGlobalStore();
  const { user, setUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<z.infer<typeof oobeConfigurationSchema>>({
    initialValues: {
      applicationName: '',
      applicationLanguage: 'en',
      applicationUrl: '',
      applicationRegistration: false,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(oobeConfigurationSchema),
  });

  useEffect(() => {
    setLoading(true);

    getSettings()
      .then((settings) => {
        form.setValues({
          applicationName: settings.app.name,
          applicationLanguage: settings.app.language,
          applicationUrl: window.location.origin,
          applicationRegistration: false,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLanguage(form.values.applicationLanguage);
  }, [form.values.applicationLanguage]);

  const onSubmit = async () => {
    setLoading(true);

    updateApplicationSettings({
      name: form.values.applicationName,
      icon: '/icon.svg',
      banner: null,
      language: form.values.applicationLanguage,
      url: form.values.applicationUrl,
      twoFactorRequirement: 'none',
      telemetryEnabled: true,
      registrationEnabled: form.values.applicationRegistration,
      languageChangeEnabled: true,
    })
      .then(() => {
        onNext();
      })
      .catch((msg) => {
        setError(httpErrorToHuman(msg));
      })
      .finally(() => setLoading(false));

    if (form.values.applicationLanguage !== 'en') {
      updateAccount({
        language: form.values.applicationLanguage,
      }).catch((msg) => {
        console.error('Failed to update account language', msg);
      });

      setUser({ ...user!, language: form.values.applicationLanguage });
    }
  };

  return (
    <Stack gap='lg'>
      <Title order={2}>{t('pages.oobe.configuration.title', {})}</Title>

      {error && <AlertError error={error} setError={setError} />}

      <form onSubmit={form.onSubmit(() => onSubmit())}>
        <Stack gap='xl¢'>
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col md:flex-row gap-2 '>
              <TextInput
                label={t('pages.oobe.configuration.form.applicationName', {})}
                placeholder={t('pages.oobe.configuration.form.applicationNamePlaceholder', {})}
                leftSection={<FontAwesomeIcon icon={faAddressCard} size='sm' />}
                className='flex-1'
                required
                {...form.getInputProps('applicationName')}
              />
              <Select
                withAsterisk
                label={t('pages.oobe.configuration.form.language', {})}
                placeholder={t('pages.oobe.configuration.form.languagePlaceholder', {})}
                data={languages.map((language) => ({
                  label: new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language,
                  value: language,
                }))}
                className='flex-1'
                {...form.getInputProps('applicationLanguage')}
              />
            </div>
            <TextInput
              label={t('pages.oobe.configuration.form.applicationUrl', {})}
              placeholder={t('pages.oobe.configuration.form.applicationUrlPlaceholder', {})}
              leftSection={<FontAwesomeIcon icon={faGlobe} size='sm' />}
              required
              {...form.getInputProps('applicationUrl')}
            />
            <Card>
              <Stack>
                <Switch
                  label={t('pages.oobe.configuration.form.telemetry', {})}
                  description={t('pages.oobe.configuration.form.telemetryDescription', {})}
                  {...form.getInputProps('applicationTelemetry', { type: 'checkbox' })}
                />
                <Switch
                  label={t('pages.oobe.configuration.form.registration', {})}
                  description={t('pages.oobe.configuration.form.registrationDescription', {})}
                  {...form.getInputProps('applicationRegistration', { type: 'checkbox' })}
                />
              </Stack>
            </Card>
          </div>

          <Button type='submit' className='md:max-w-fit md:ml-auto' disabled={!form.isValid()} loading={loading}>
            {t('pages.oobe.configuration.button.submit', {})}
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
