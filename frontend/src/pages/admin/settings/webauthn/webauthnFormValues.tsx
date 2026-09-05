import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { adminSettingsWebauthnSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type WebauthnFormValues = z.infer<typeof adminSettingsWebauthnSchema>;

export const webauthnEmptyFormValues: WebauthnFormValues = {
  enabled: true,
  allowDiscoverable: true,
  rpId: '',
  rpOrigin: '',
  authenticationTimeoutSeconds: 300,
  registrationTimeoutSeconds: 300,
};

export const webauthnToFormValues = (webauthn: WebauthnFormValues): Partial<WebauthnFormValues> => ({ ...webauthn });

export function useWebauthnFormFields(): FieldDef<WebauthnFormValues>[] {
  const { t } = useTranslations();

  return [
    {
      type: 'switch',
      name: 'enabled',
      label: t('pages.admin.settings.tabs.webauthn.page.form.enabled', {}),
      description: t('pages.admin.settings.tabs.webauthn.page.form.enabledDescription', {}),
    },
    {
      type: 'switch',
      name: 'allowDiscoverable',
      label: t('pages.admin.settings.tabs.webauthn.page.form.allowDiscoverable', {}),
      description: t('pages.admin.settings.tabs.webauthn.page.form.allowDiscoverableDescription', {}),
    },
    { type: 'text', name: 'rpId', label: t('pages.admin.settings.tabs.webauthn.page.form.rpId', {}), required: true },
    {
      type: 'text',
      name: 'rpOrigin',
      label: t('pages.admin.settings.tabs.webauthn.page.form.rpOrigin', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'authenticationTimeoutSeconds',
      label: t('pages.admin.settings.tabs.webauthn.page.form.authenticationTimeoutSeconds', {}),
      required: true,
    },
    {
      type: 'number',
      name: 'registrationTimeoutSeconds',
      label: t('pages.admin.settings.tabs.webauthn.page.form.registrationTimeoutSeconds', {}),
      required: true,
    },
  ];
}
