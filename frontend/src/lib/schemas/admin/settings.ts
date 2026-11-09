import { z } from 'zod';
import { oobeStepKey } from '@/lib/schemas/oobe.ts';
import { ruleMessage } from '@/lib/schemas/rules.ts';
import { serverTrashSettingsSchema } from '@/lib/schemas/server/settings.ts';
import { twoFactorMethod } from '@/lib/schemas/user.ts';
import { nullableNumber, nullableString } from '@/lib/serialization/transformers.ts';
import { eggConfigurationRouteItemSchema, hostnameSchema } from '../generic.ts';

export const adminSettingsApplicationSchema = z.object({
  name: z.string().min(1).max(64),
  icon: z.string().min(1).max(255),
  iconLight: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  banner: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  bannerLight: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  url: z.url({ protocol: /^https?$/ }).max(255),
  additionalUrls: z
    .array(z.string())
    .max(32)
    .refine(
      (urls) =>
        urls.every(
          (url) =>
            z
              .url({ protocol: /^https?$/ })
              .max(255)
              .safeParse(url).success,
        ),
      {
        message: 'Every URL must be a valid http or https URL',
      },
    ),
  language: z.string(),
  twoFactorRequirement: z.enum(['admins', 'all_users', 'none']),
  emailTwoFactorEnabled: z.boolean(),
  twoFactorAcceptedMethods: z.array(twoFactorMethod),
  emailVerificationRequired: z.boolean(),
  sessionCookie: z.string().min(1).max(255),
  sessionDurationSeconds: z.number().min(60).max(31536000),
  telemetryEnabled: z.boolean(),
  registrationEnabled: z.boolean(),
  passwordLoginEnabled: z.boolean(),
});

export const adminSettingsCaptchaProviderNoneSchema = z.object({
  type: z.literal('none'),
});

export const adminSettingsCaptchaProviderTurnstileSchema = z.object({
  type: z.literal('turnstile'),
  siteKey: z.string().min(1).max(255),
  secretKey: z.string().min(1).max(255),
});

export const adminSettingsCaptchaProviderRecaptchaSchema = z.object({
  type: z.literal('recaptcha'),
  siteKey: z.string().min(1).max(255),
  secretKey: z.string().min(1).max(255),
  v3: z.boolean(),
  threshold: z.number().min(0).max(1).default(0.5),
});

export const adminSettingsCaptchaProviderHcaptchaSchema = z.object({
  type: z.literal('hcaptcha'),
  siteKey: z.string().min(1).max(255),
  secretKey: z.string().min(1).max(255),
});

export const adminSettingsCaptchaProviderFriendlyCaptchaSchema = z.object({
  type: z.literal('friendly_captcha'),
  siteKey: z.string().min(1).max(255),
  apiKey: z.string().min(1).max(255),
});

export const adminSettingsCaptchaProviderCapSchema = z.object({
  type: z.literal('cap'),
  apiUrl: z
    .url({ protocol: /^https?$/ })
    .max(255)
    .refine(
      (value) => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return !url.username && !url.password && !value.includes('?') && !value.includes('#');
      },
      { message: 'The URL must not contain credentials, a query, or a fragment' },
    ),
  siteKey: z
    .string()
    .min(1)
    .max(255)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      ruleMessage((t) => t('common.form.rule.captchaSiteKey', {})),
    ),
  secretKey: z.string().min(1).max(255),
});

export const adminSettingsCaptchaProviderSchema = z.discriminatedUnion('type', [
  adminSettingsCaptchaProviderNoneSchema,
  adminSettingsCaptchaProviderTurnstileSchema,
  adminSettingsCaptchaProviderRecaptchaSchema,
  adminSettingsCaptchaProviderHcaptchaSchema,
  adminSettingsCaptchaProviderFriendlyCaptchaSchema,
  adminSettingsCaptchaProviderCapSchema,
]);

export const adminSettingsEmailNoneSchema = z.object({
  type: z.literal('none'),
});

export const adminSettingsEmailSmtpSchema = z.object({
  type: z.literal('smtp'),
  host: hostnameSchema,
  port: z.number().min(1),
  username: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  password: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  tlsMode: z.enum(['none', 'start_tls', 'implicit_tls']),
  skipCertValidation: z.boolean(),
  heloDomain: z.preprocess(nullableString, hostnameSchema.nullable()),
  fromAddress: z.email().max(255),
  fromName: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export const adminSettingsEmailSendmailSchema = z.object({
  type: z.literal('sendmail'),
  command: z.string().min(1).max(255),
  fromAddress: z.email().max(255),
  fromName: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export const adminSettingsEmailFilesystemSchema = z.object({
  type: z.literal('filesystem'),
  path: z.string().min(1).max(255),
  fromAddress: z.email().max(255),
  fromName: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export const adminSettingsEmailSchema = z.discriminatedUnion('type', [
  adminSettingsEmailNoneSchema,
  adminSettingsEmailSmtpSchema,
  adminSettingsEmailSendmailSchema,
  adminSettingsEmailFilesystemSchema,
]);

export const adminSettingsEmailTestSchema = z.object({
  email: z.email().max(255),
});

export const adminSettingsEmailTemplateListSchema = z.array(
  z.object({
    identifier: z.string(),
    availableVariables: z.array(z.string()),
  }),
);

export const adminSettingsEmailTemplateSchema = z.object({
  availableVariables: z.array(z.string()),
  defaultEnabled: z.boolean(),
  enabled: z.boolean(),
  defaultSubject: z.string(),
  subject: z.string().nullable(),
  defaultContent: z.string(),
  content: z.string().nullable(),
});

export const adminSettingsEmailTemplateUpdateSchema = z.object({
  content: z.string().min(1).nullable().optional(),
  subject: z.string().min(1).max(255).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const adminSettingsEmailVariableSchema = z.object({
  templateIdentifier: z.string().nullable(),
  name: z.string(),
  system: z.boolean(),
  defaultValue: z.string().nullable(),
  defaultTranslations: z.record(z.string(), z.string()),
  value: z.string().nullable(),
  valueTranslations: z.record(z.string(), z.string()),
});

export const adminSettingsEmailVariableCreateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z][a-z0-9_]{0,63}$/,
      ruleMessage((t) => t('common.form.rule.variableName', {})),
    ),
  value: z.string().min(1).max(8192),
  valueTranslations: z.record(z.string(), z.string().min(1).max(8192)),
});

export const adminSettingsEmailVariableUpdateSchema = z.object({
  value: z.string().min(1).max(8192).nullable().optional(),
  valueTranslations: z.record(z.string(), z.string().min(1).max(8192)).optional(),
});

export const adminSettingsServerSchema = z.object({
  maxFileManagerViewSize: z.number().min(0),
  maxFileManagerContentSearchSize: z.number().min(0),
  maxFileManagerSearchResults: z.number().min(1),
  maxSubuserCount: z.number().min(0),
  maxScheduleStepCount: z.number().min(0),
  maxBackupGroupCount: z.number().min(0),
  maxFirewallRuleCount: z.number().min(0),
  maxFirewallRuleSourceCount: z.number().min(0),
  maxTunnelConnectionCount: z.number().min(0),
  maxTunnelPortCount: z.number().min(0),
  maxDatabaseInstanceDatabaseCount: z.number().min(0),
  maxDatabaseInstanceUserCount: z.number().min(0),
  allowOverwritingCustomDockerImage: z.boolean(),
  allowViewingInstallationLogs: z.boolean(),
  allowAcknowledgingInstallationFailure: z.boolean(),
  allowViewingTransferProgress: z.boolean(),
  trash: serverTrashSettingsSchema,
  allowChangingTrashSettings: z.boolean(),
  containerPrelude: z.string().min(1).max(255),
});

export const adminSettingsUserSchema = z.object({
  maxServerGroupCount: z.number().min(0),
  maxApiKeyCount: z.number().min(0),
  maxCommandSnippetCount: z.number().min(0),
  maxSecurityKeyCount: z.number().min(0),
  maxSshKeyCount: z.number().min(0),
  maxSettingsCount: z.number().min(0),
  maxSettingsValueBytes: z.number().min(0),
  allowChangingLanguage: z.boolean(),
  allowChangingAvatar: z.boolean(),
  routeOrder: z.array(eggConfigurationRouteItemSchema).max(100).nullable(),
});

export const adminSettingsActivitySchema = z.object({
  adminLogRetentionDays: z.number().min(1).max(3650),
  adminLogRetentionCount: z.preprocess(nullableNumber, z.number().min(1).nullable()),
  userLogRetentionDays: z.number().min(1).max(3650),
  userLogRetentionCount: z.preprocess(nullableNumber, z.number().min(1).nullable()),
  serverLogRetentionDays: z.number().min(1).max(3650),
  serverLogRetentionCount: z.preprocess(nullableNumber, z.number().min(1).nullable()),
  serverLogAdminActivity: z.boolean(),
  serverLogScheduleActivity: z.boolean(),
  serverHideActivityIps: z.enum(['admins', 'all_users', 'none']),
});

export const adminSettingsRatelimitConfigurationSchema = z.object({
  hits: z.number().min(1),
  windowSeconds: z.number().min(1),
});

export const adminSettingsRatelimitsSchema = z.object({
  authRegister: adminSettingsRatelimitConfigurationSchema,
  authLogin: adminSettingsRatelimitConfigurationSchema,
  authLoginCheckpoint: adminSettingsRatelimitConfigurationSchema,
  authLoginCheckpointEmail: adminSettingsRatelimitConfigurationSchema,
  authLoginSecurityKey: adminSettingsRatelimitConfigurationSchema,
  authPasswordForgot: adminSettingsRatelimitConfigurationSchema,
  authPasswordReset: adminSettingsRatelimitConfigurationSchema,
  authEmailVerification: adminSettingsRatelimitConfigurationSchema,
  client: adminSettingsRatelimitConfigurationSchema,
  clientAccountEmailResendVerification: adminSettingsRatelimitConfigurationSchema,
  clientServersBackupsCreate: adminSettingsRatelimitConfigurationSchema,
  clientServersFilesPull: adminSettingsRatelimitConfigurationSchema,
  clientServersFilesPullQuery: adminSettingsRatelimitConfigurationSchema,
  clientServersSubusersCreate: adminSettingsRatelimitConfigurationSchema,
  remote: adminSettingsRatelimitConfigurationSchema,
  remoteSftpAuth: adminSettingsRatelimitConfigurationSchema,
  remoteEnroll: adminSettingsRatelimitConfigurationSchema,
  exemptIps: z.array(z.ipv4().or(z.ipv6()).or(z.cidrv4()).or(z.cidrv6())).max(256),
  exemptApiKeys: z.array(z.uuid()).max(256),
});

export const adminSettingsStorageFilesystemSchema = z.object({
  type: z.literal('filesystem'),
  path: z.string().min(1).max(255),
});

export const adminSettingsStorageS3Schema = z.object({
  type: z.literal('s3'),
  accessKey: z.string().min(1).max(512),
  secretKey: z.string().min(1).max(512),
  bucket: z.string().min(1).max(63),
  region: z.string().min(1).max(63),
  publicUrl: z.url({ protocol: /^https?$/ }).max(255),
  endpoint: z.string().min(1).max(255),
  pathStyle: z.boolean(),
});

export const adminSettingsStorageSchema = z.discriminatedUnion('type', [
  adminSettingsStorageFilesystemSchema,
  adminSettingsStorageS3Schema,
]);

export const adminSettingsWebauthnSchema = z.object({
  enabled: z.boolean(),
  allowDiscoverable: z.boolean(),
  rpId: z.string().min(1).max(255),
  rpOrigin: z.url({ protocol: /^https?$/ }).max(255),
  authenticationTimeoutSeconds: z.number().min(30).max(600),
  registrationTimeoutSeconds: z.number().min(30).max(600),
});

export const adminSettingsMetadataSchema = z.object({
  description: z.preprocess(nullableString, z.string().min(1).max(320).nullable()),
  themeColor: z.string().regex(
    /^#[0-9a-fA-F]{6}$/,
    ruleMessage((t) => t('common.form.rule.hexColor', {})),
  ),
  ogImage: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  twitterCard: z.enum(['summary', 'summary_large_image']),
  indexable: z.boolean(),
  pwaEnabled: z.boolean(),
  pwaName: z.preprocess(nullableString, z.string().min(1).max(64).nullable()),
  pwaShortName: z.preprocess(nullableString, z.string().min(1).max(32).nullable()),
  pwaDisplay: z.enum(['fullscreen', 'standalone', 'minimal_ui', 'browser']),
  pwaBackgroundColor: z.string().regex(
    /^#[0-9a-fA-F]{6}$/,
    ruleMessage((t) => t('common.form.rule.hexColor', {})),
  ),
  pwaIcon: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
});

export const adminSettingsUpdatesSchema = z.object({
  wingsReleaseToken: z.preprocess(nullableString, z.string().min(1).max(1024).nullable()),
  dbAgentReleaseToken: z.preprocess(nullableString, z.string().min(1).max(1024).nullable()),
});

export const twoFactorRequirement = z.enum(['admins', 'all_users', 'none']);

export const adminSettingsSchema = z.object({
  oobeStep: oobeStepKey.nullable(),
  telemetryUuid: z.string().uuid().nullable().optional(),
  telemetryCronSchedule: z.string().nullable().optional(),
  storageDriver: adminSettingsStorageSchema,
  mailMode: adminSettingsEmailSchema,
  captchaProvider: adminSettingsCaptchaProviderSchema,
  app: adminSettingsApplicationSchema,
  metadata: adminSettingsMetadataSchema,
  webauthn: adminSettingsWebauthnSchema,
  server: adminSettingsServerSchema,
  user: adminSettingsUserSchema,
  activity: adminSettingsActivitySchema,
  ratelimits: adminSettingsRatelimitsSchema,
  updates: adminSettingsUpdatesSchema,
});
