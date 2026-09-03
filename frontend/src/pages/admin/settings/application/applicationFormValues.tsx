import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { adminSettingsApplicationSchema } from '@/lib/schemas/admin/settings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type ApplicationFormValues = z.infer<typeof adminSettingsApplicationSchema>;

export const applicationEmptyFormValues: ApplicationFormValues = {
  name: '',
  icon: '',
  iconLight: null,
  banner: null,
  bannerLight: null,
  url: '',
  language: 'en',
  twoFactorRequirement: 'none',
  emailTwoFactorEnabled: false,
  twoFactorAcceptedMethods: ['totp', 'security_key'],
  emailVerificationRequired: false,
  sessionCookie: '',
  sessionDurationSeconds: 3600,
  telemetryEnabled: true,
  registrationEnabled: true,
};

export const applicationToFormValues = (app: ApplicationFormValues): Partial<ApplicationFormValues> => ({ ...app });

interface ApplicationFormFieldsOptions {
  languages: string[];
  assetUrls: string[];
  onTelemetryToggle: (checked: boolean) => void;
  onRegistrationToggle: (checked: boolean) => void;
}

export function useApplicationFormFields({
  languages,
  assetUrls,
  onTelemetryToggle,
  onRegistrationToggle,
}: ApplicationFormFieldsOptions): FieldDef<ApplicationFormValues>[] {
  const { t } = useTranslations();

  return [
    { type: 'text', name: 'name', label: t('common.form.name', {}), required: true },
    {
      type: 'select',
      name: 'language',
      label: t('common.form.language', {}),
      required: true,
      options: languages.map((l) => ({
        label: new Intl.DisplayNames([l], { type: 'language' }).of(l) ?? l,
        value: l,
      })),
      props: { searchable: true },
    },
    {
      type: 'autocomplete',
      name: 'icon',
      label: t('pages.admin.settings.tabs.application.page.form.icon', {}),
      required: true,
      options: assetUrls,
    },
    {
      type: 'autocomplete',
      name: 'iconLight',
      label: t('pages.admin.settings.tabs.application.page.form.iconLight', {}),
      options: assetUrls,
      advanced: true,
    },
    {
      type: 'autocomplete',
      name: 'banner',
      label: t('pages.admin.settings.tabs.application.page.form.banner', {}),
      options: assetUrls,
    },
    {
      type: 'autocomplete',
      name: 'bannerLight',
      label: t('pages.admin.settings.tabs.application.page.form.bannerLight', {}),
      options: assetUrls,
      advanced: true,
    },
    { type: 'text', name: 'url', label: t('common.form.url', {}), required: true },
    {
      type: 'text',
      name: 'sessionCookie',
      label: t('pages.admin.settings.tabs.application.page.form.sessionCookie', {}),
      required: true,
      advanced: true,
    },
    {
      type: 'number',
      name: 'sessionDurationSeconds',
      label: t('pages.admin.settings.tabs.application.page.form.sessionDurationSeconds', {}),
      required: true,
      advanced: true,
    },
    {
      type: 'select',
      name: 'twoFactorRequirement',
      label: t('pages.admin.settings.tabs.application.page.form.twoFactorRequirement', {}),
      required: true,
      options: [
        {
          label: t('pages.admin.settings.tabs.application.page.enum.twoFactorRequirement.admins', {}),
          value: 'admins',
        },
        {
          label: t('pages.admin.settings.tabs.application.page.enum.twoFactorRequirement.allUsers', {}),
          value: 'all_users',
        },
        { label: t('pages.admin.settings.tabs.application.page.enum.twoFactorRequirement.none', {}), value: 'none' },
      ],
    },
    {
      type: 'switch',
      name: 'emailTwoFactorEnabled',
      label: t('pages.admin.settings.tabs.application.page.form.emailTwoFactorEnabled', {}),
      description: t('pages.admin.settings.tabs.application.page.form.emailTwoFactorEnabledDescription', {}),
    },
    {
      type: 'multiselect',
      name: 'twoFactorAcceptedMethods',
      label: t('pages.admin.settings.tabs.application.page.form.twoFactorAcceptedMethods', {}),
      description: t('pages.admin.settings.tabs.application.page.form.twoFactorAcceptedMethodsDescription', {}),
      options: [
        { label: t('pages.admin.settings.tabs.application.page.enum.twoFactorMethod.totp', {}), value: 'totp' },
        {
          label: t('pages.admin.settings.tabs.application.page.enum.twoFactorMethod.securityKey', {}),
          value: 'security_key',
        },
        { label: t('pages.admin.settings.tabs.application.page.enum.twoFactorMethod.email', {}), value: 'email' },
      ],
    },
    {
      type: 'switch',
      name: 'emailVerificationRequired',
      label: t('pages.admin.settings.tabs.application.page.form.emailVerificationRequired', {}),
      description: t('pages.admin.settings.tabs.application.page.form.emailVerificationRequiredDescription', {}),
    },
    {
      type: 'switch',
      name: 'telemetryEnabled',
      label: t('pages.admin.settings.tabs.application.page.form.telemetryEnabled', {}),
      description: t('pages.admin.settings.tabs.application.page.form.telemetryEnabledDescription', {}),
      props: {
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onTelemetryToggle(e.target.checked),
      },
    },
    {
      type: 'switch',
      name: 'registrationEnabled',
      label: t('pages.admin.settings.tabs.application.page.form.registrationEnabled', {}),
      props: {
        name: 'registrationEnabled',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onRegistrationToggle(e.target.checked),
      },
    },
  ];
}
