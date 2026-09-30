import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { ignorePasswordManagerProps } from '@/lib/passwordManager.ts';
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
    {
      type: 'text',
      name: 'siteKey',
      label: t('common.form.siteKey', {}),
      required: true,
      props: ignorePasswordManagerProps,
    },
    { type: 'password', name: 'secretKey', label: t('common.form.secretKey', {}), required: true },
  ];

  return {
    cap: {
      formId: 'admin.settings.captcha.cap',
      defaults: { apiUrl: '', siteKey: '', secretKey: '' },
      fields: [
        {
          type: 'text',
          name: 'apiUrl',
          label: t('pages.admin.settings.tabs.captcha.page.cap.form.apiUrl', {}),
          description: t('pages.admin.settings.tabs.captcha.page.cap.form.apiUrlDescription', {}),
          props: { placeholder: 'https://cap.example.com' },
          required: true,
        },
        ...siteAndSecret,
      ],
    },
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
      defaults: { siteKey: '', secretKey: '', v3: false, threshold: 0.5 },
      fields: [
        ...siteAndSecret,
        {
          type: 'switch',
          name: 'v3',
          label: t('pages.admin.settings.tabs.captcha.page.recaptcha.form.v3', {}),
          colSpan: 'full',
        },
        {
          type: 'number',
          name: 'threshold',
          label: t('pages.admin.settings.tabs.captcha.page.recaptcha.form.threshold', {}),
          description: t('pages.admin.settings.tabs.captcha.page.recaptcha.form.thresholdDescription', {}),
          required: true,
          when: (values) => values.type === 'recaptcha' && values.v3,
          props: { min: 0, max: 1, step: 0.1, decimalScale: 2 },
        },
      ],
    },
    friendly_captcha: {
      formId: 'admin.settings.captcha.friendlyCaptcha',
      defaults: { siteKey: '', apiKey: '' },
      fields: [
        {
          type: 'text',
          name: 'siteKey',
          label: t('common.form.siteKey', {}),
          required: true,
          props: ignorePasswordManagerProps,
        },
        { type: 'password', name: 'apiKey', label: t('common.form.apiKey', {}), required: true },
      ],
    },
  };
}
