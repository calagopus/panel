import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { adminSettingsCaptchaProviderSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import type { DiscriminatedVariant } from '../DiscriminatedSettingsForm.tsx';

type CaptchaFormValues = z.infer<typeof adminSettingsCaptchaProviderSchema>;
type CaptchaProvider = CaptchaFormValues['type'];

export const captchaEmptyFormValues: CaptchaFormValues = { type: 'none' };

export const captchaToFormValues = (provider: CaptchaFormValues): Partial<CaptchaFormValues> => ({ ...provider });

export function useCaptchaProviderVariants(): Partial<
  Record<CaptchaProvider, DiscriminatedVariant<CaptchaFormValues>>
> {
  const { t } = useTranslations();

  const siteAndSecret: FieldDef<CaptchaFormValues>[] = [
    { type: 'text', name: 'siteKey', label: t('common.form.siteKey', {}), required: true },
    { type: 'password', name: 'secretKey', label: t('common.form.secretKey', {}), required: true },
  ];

  return {
    turnstile: {
      formId: 'admin.settings.captcha.turnstile',
      defaults: { siteKey: '', secretKey: '' },
      fields: siteAndSecret,
    },
    hcaptcha: {
      formId: 'admin.settings.captcha.hcaptcha',
      defaults: { siteKey: '', secretKey: '' },
      fields: siteAndSecret,
    },
    recaptcha: {
      formId: 'admin.settings.captcha.recaptcha',
      defaults: { siteKey: '', secretKey: '', v3: false },
      fields: [
        ...siteAndSecret,
        {
          type: 'switch',
          name: 'v3',
          label: t('pages.admin.settings.tabs.captcha.page.recaptcha.form.v3', {}),
          colSpan: 'full',
        },
      ],
    },
    friendly_captcha: {
      formId: 'admin.settings.captcha.friendlyCaptcha',
      defaults: { siteKey: '', apiKey: '' },
      fields: [
        { type: 'text', name: 'siteKey', label: t('common.form.siteKey', {}), required: true },
        { type: 'password', name: 'apiKey', label: t('common.form.apiKey', {}), required: true },
      ],
    },
  };
}
