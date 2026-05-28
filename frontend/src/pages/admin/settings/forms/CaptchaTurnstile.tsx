import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsCaptchaProviderTurnstileSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function CaptchaTurnstile({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminSettingsCaptchaProviderTurnstileSchema>>;
}) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      siteKey: form.values.siteKey ?? '',
      secretKey: form.values.secretKey ?? '',
    });
  }, []);

  return (
    <Stack mt='md'>
      <Group grow>
        <TextInput
          withAsterisk
          label={t('common.form.siteKey', {})}
          placeholder={t('common.form.siteKey', {})}
          key={form.key('siteKey')}
          {...form.getInputProps('siteKey')}
        />
        <PasswordInput
          withAsterisk
          label={t('common.form.secretKey', {})}
          placeholder={t('common.form.secretKey', {})}
          key={form.key('secretKey')}
          {...form.getInputProps('secretKey')}
        />
      </Group>
    </Stack>
  );
}
