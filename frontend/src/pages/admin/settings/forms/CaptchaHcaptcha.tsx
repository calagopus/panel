import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsCaptchaProviderHcaptchaSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type HcaptchaValues = z.infer<typeof adminSettingsCaptchaProviderHcaptchaSchema>;

export default function CaptchaHcaptcha({ form }: { form: UseFormReturnType<HcaptchaValues> }) {
  const { t } = useTranslations();
  const { formExtension } = useFormExtensions('admin.settings.captcha.hcaptcha');

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
      <FormEngine form={form} fields={fields} extensions={[formExtension]} />
    </Stack>
  );
}
