import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsCaptchaProviderRecaptchaSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type RecaptchaValues = z.infer<typeof adminSettingsCaptchaProviderRecaptchaSchema>;

export default function CaptchaRecaptcha({ form }: { form: UseFormReturnType<RecaptchaValues> }) {
  const { t } = useTranslations();
  useEffect(() => {
    form.setValues({
      siteKey: form.values.siteKey ?? '',
      secretKey: form.values.secretKey ?? '',
      v3: form.values.v3 ?? false,
    });
  }, []);

  const fields: FieldDef<RecaptchaValues>[] = [
    {
      type: 'text',
      name: 'siteKey',
      label: t('common.form.siteKey', {}),
      required: true,
    },
    {
      type: 'password',
      name: 'secretKey',
      label: t('common.form.secretKey', {}),
      required: true,
    },
    {
      type: 'switch',
      name: 'v3',
      label: t('pages.admin.settings.tabs.captcha.page.recaptcha.form.v3', {}),
      colSpan: 'full',
    },
  ];

  return (
    <Stack mt='md'>
      <FormEngine id='admin.settings.captcha.recaptcha' form={form} fields={fields} />
    </Stack>
  );
}
