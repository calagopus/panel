import { UseFormReturnType } from '@mantine/form';
import { useEffect } from 'react';
import { z } from 'zod';
import { type FieldDef, FormEngine, useFormExtensions } from '@/elements/form-engine/index.ts';
import Stack from '@/elements/Stack.tsx';
import { adminSettingsCaptchaProviderFriendlyCaptchaSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type FriendlyCaptchaValues = z.infer<typeof adminSettingsCaptchaProviderFriendlyCaptchaSchema>;

export default function CaptchaFriendlyCaptcha({ form }: { form: UseFormReturnType<FriendlyCaptchaValues> }) {
  const { t } = useTranslations();
  const { formExtension } = useFormExtensions('admin.settings.captcha.friendlyCaptcha');

  useEffect(() => {
    form.setValues({
      siteKey: form.values.siteKey ?? '',
      apiKey: form.values.apiKey ?? '',
    });
  }, []);

  const fields: FieldDef<FriendlyCaptchaValues>[] = [
    {
      type: 'text',
      name: 'siteKey',
      label: t('common.form.siteKey', {}),
      required: true,
    },
    {
      type: 'password',
      name: 'apiKey',
      label: t('common.form.apiKey', {}),
      required: true,
    },
  ];

  return (
    <Stack mt='md'>
      <FormEngine form={form} fields={fields} extensions={[formExtension]} />
    </Stack>
  );
}
