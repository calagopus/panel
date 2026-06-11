import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsCaptchaProviderFriendlyCaptchaSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function CaptchaFriendlyCaptcha({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminSettingsCaptchaProviderFriendlyCaptchaSchema>>;
}) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      siteKey: form.values.siteKey ?? '',
      apiKey: form.values.apiKey ?? '',
    });
  }, []);

  return (
    <Stack mt='md'>
      <Group grow>
        <TextInput
          withAsterisk
          label={t('common.form.siteKey', {})}
          key={form.key('siteKey')}
          {...form.getInputProps('siteKey')}
        />
        <PasswordInput
          withAsterisk
          label={t('common.form.apiKey', {})}
          key={form.key('apiKey')}
          {...form.getInputProps('apiKey')}
        />
      </Group>
    </Stack>
  );
}
