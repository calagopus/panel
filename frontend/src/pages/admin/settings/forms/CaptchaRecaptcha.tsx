import { Group, Stack } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import PasswordInput from '@/elements/input/PasswordInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { adminSettingsCaptchaProviderRecaptchaSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function CaptchaRecaptcha({
  form,
}: {
  form: UseFormReturnType<z.infer<typeof adminSettingsCaptchaProviderRecaptchaSchema>>;
}) {
  const { t } = useTranslations();

  useEffect(() => {
    form.setValues({
      siteKey: form.values.siteKey ?? '',
      secretKey: form.values.secretKey ?? '',
      v3: form.values.v3 ?? false,
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
          label={t('common.form.secretKey', {})}
          key={form.key('secretKey')}
          {...form.getInputProps('secretKey')}
        />
      </Group>

      <Switch
        label={t('pages.admin.settings.tabs.captcha.page.recaptcha.form.v3', {})}
        key={form.key('v3')}
        {...form.getInputProps('v3', { type: 'checkbox' })}
      />
    </Stack>
  );
}
