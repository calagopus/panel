import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsCaptchaProviderHcaptchaSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type HcaptchaValues = z.infer<typeof adminSettingsCaptchaProviderHcaptchaSchema>;

export default function CaptchaHcaptcha({ form }: { form: UseFormReturnType<HcaptchaValues> }) {
  const { t } = useTranslations();
  useEffect(() => {
    form.setValues({
      siteKey: form.values.siteKey ?? '',
      secretKey: form.values.secretKey ?? '',
    });
  }, []);

  const fields: FieldDef<HcaptchaValues>[] = [
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
  ];

  return (
    <Stack mt='md'>
      <FormEngine id='admin.settings.captcha.hcaptcha' form={form} fields={fields} />
    </Stack>
  );
}
