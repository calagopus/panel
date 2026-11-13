import { z } from 'zod';
import type { FieldDef } from '@/elements/form-engine/index.ts';
import { isTwoFactorMethodAvailable, TwoFactorAvailability } from '@/lib/auth/twoFactor.ts';
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
  additionalUrls: [],
  language: 'en',
  twoFactorRequirement: 'none',
  emailTwoFactorEnabled: false,
  twoFactorAcceptedMethods: ['totp', 'security_key'],
  emailVerificationRequired: false,
  sessionCookie: '',
  sessionDurationSeconds: 3600,
  telemetryEnabled: true,
  registrationEnabled: true,
  passwordLoginEnabled: true,
};

export const applicationToFormValues = (app: ApplicationFormValues): Partial<ApplicationFormValues> => ({ ...app });

interface ApplicationFormFieldsOptions {
  languages: string[];
  assetUrls: string[];
  onTelemetryToggle: (checked: boolean) => void;
  onRegistrationToggle: (checked: boolean) => void;
  onPasswordLoginToggle: (checked: boolean) => void;
  twoFactorAvailability: TwoFactorAvailability;
  selectedTwoFactorMethods: ApplicationFormValues['twoFactorAcceptedMethods'];
  values: Pick<ApplicationFormValues, 'emailTwoFactorEnabled' | 'emailVerificationRequired' | 'passwordLoginEnabled'>;
  twoFactorAcceptedMethodsError?: string;
}

export function useApplicationFormFields({
  languages,
  assetUrls,
  onTelemetryToggle,
  onRegistrationToggle,
  onPasswordLoginToggle,
  twoFactorAvailability,
  selectedTwoFactorMethods,
  values,
  twoFactorAcceptedMethodsError,
}: ApplicationFormFieldsOptions): FieldDef<ApplicationFormValues>[] {
  const { t } = useTranslations();

  const unselectable = (method: ApplicationFormValues['twoFactorAcceptedMethods'][number]) =>
    !selectedTwoFactorMethods.includes(method);

  const noMail = twoFactorAvailability.mailConfigured === false;
  const mailSwitchProps = (enabled: boolean) => ({
    disabled: noMail && !enabled,
    error: noMail && enabled ? t('pages.admin.settings.tabs.application.page.form.emailRequiresMail', {}) : undefined,
  });

  return [
    {
      type: 'divider',
      name: 'generalDivider',
      label: t('pages.admin.settings.tabs.application.page.section.general', {}),
    },
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
    { type: 'text', name: 'url', label: t('common.form.url', {}), required: true },
    {
      type: 'tags',
      name: 'additionalUrls',
      label: t('pages.admin.settings.tabs.application.page.form.additionalUrls', {}),
      description: t('pages.admin.settings.tabs.application.page.form.additionalUrlsDescription', {}),
      placeholder: 'e.g. https://panel.example.org',
      advanced: true,
    },
    {
      type: 'divider',
      name: 'brandingDivider',
      label: t('pages.admin.settings.tabs.application.page.section.branding', {}),
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
    {
      type: 'divider',
      name: 'authenticationDivider',
      label: t('pages.admin.settings.tabs.application.page.section.authentication', {}),
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
      type: 'multiselect',
      name: 'twoFactorAcceptedMethods',
      label: t('pages.admin.settings.tabs.application.page.form.twoFactorAcceptedMethods', {}),
      description: t('pages.admin.settings.tabs.application.page.form.twoFactorAcceptedMethodsDescription', {}),
      options: [
        { label: t('pages.admin.settings.tabs.application.page.enum.twoFactorMethod.totp', {}), value: 'totp' },
        isTwoFactorMethodAvailable('security_key', twoFactorAvailability)
          ? {
              label: t('pages.admin.settings.tabs.application.page.enum.twoFactorMethod.securityKey', {}),
              value: 'security_key',
            }
          : {
              label: t('pages.admin.settings.tabs.application.page.enum.twoFactorMethodUnavailable.securityKey', {}),
              value: 'security_key',
              disabled: unselectable('security_key'),
            },
        isTwoFactorMethodAvailable('email', twoFactorAvailability)
          ? { label: t('pages.admin.settings.tabs.application.page.enum.twoFactorMethod.email', {}), value: 'email' }
          : {
              label:
                twoFactorAvailability.mailConfigured === false
                  ? t('pages.admin.settings.tabs.application.page.enum.twoFactorMethodUnavailable.emailNoMail', {})
                  : t('pages.admin.settings.tabs.application.page.enum.twoFactorMethodUnavailable.email', {}),
              value: 'email',
              disabled: unselectable('email'),
            },
      ],
      props: { error: twoFactorAcceptedMethodsError },
    },
    {
      type: 'switch',
      name: 'emailTwoFactorEnabled',
      label: t('pages.admin.settings.tabs.application.page.form.emailTwoFactorEnabled', {}),
      description: noMail
        ? t('pages.admin.settings.tabs.application.page.form.emailTwoFactorEnabledNoMail', {})
        : t('pages.admin.settings.tabs.application.page.form.emailTwoFactorEnabledDescription', {}),
      props: mailSwitchProps(values.emailTwoFactorEnabled),
    },
    {
      type: 'switch',
      name: 'emailVerificationRequired',
      label: t('pages.admin.settings.tabs.application.page.form.emailVerificationRequired', {}),
      description: noMail
        ? t('pages.admin.settings.tabs.application.page.form.emailVerificationRequiredNoMail', {})
        : t('pages.admin.settings.tabs.application.page.form.emailVerificationRequiredDescription', {}),
      props: mailSwitchProps(values.emailVerificationRequired),
    },
    {
      type: 'switch',
      name: 'registrationEnabled',
      label: t('pages.admin.settings.tabs.application.page.form.registrationEnabled', {}),
      description: values.passwordLoginEnabled
        ? undefined
        : t('pages.admin.settings.tabs.application.page.form.registrationEnabledNoPasswordLogin', {}),
      props: {
        name: 'registrationEnabled',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onRegistrationToggle(e.target.checked),
      },
    },
    {
      type: 'switch',
      name: 'passwordLoginEnabled',
      label: t('pages.admin.settings.tabs.application.page.form.passwordLoginEnabled', {}),
      description: t('pages.admin.settings.tabs.application.page.form.passwordLoginEnabledDescription', {}),
      props: {
        name: 'passwordLoginEnabled',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onPasswordLoginToggle(e.target.checked),
      },
    },
    {
      type: 'divider',
      name: 'sessionsDivider',
      label: t('pages.admin.settings.tabs.application.page.section.sessions', {}),
      advanced: true,
    },
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
      type: 'divider',
      name: 'telemetryDivider',
      label: t('pages.admin.settings.tabs.application.page.section.telemetry', {}),
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
  ];
}
