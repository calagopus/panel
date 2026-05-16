import { z } from 'zod';
import { oobeStepKey } from '@/lib/schemas/oobe.ts';
import { nullableNumber, nullableString } from '@/lib/transformers.ts';
import { hostnameSchema } from '../generic.ts';

export const adminSettingsApplicationSchema = z.object({
  name: z.string().min(1).max(64),
  icon: z.string().min(1).max(255),
  banner: z.preprocess(nullableString, z.string().min(1).max(255).nullable()),
  url: z.url({ protocol: /^https?$/ }).max(255),
  language: z.string(),
  twoFactorRequirement: z.enum(['admins', 'all_users', 'none']),
  sessionCookie: z.string().min(1).max(255),
  sessionDurationSeconds: z.number().min(60).max(31536000),
  telemetryEnabled: z.boolean(),
  registrationEnabled: z.boolean(),
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

export const adminSettingsCaptchaProviderSchema = z.discriminatedUnion('type', [
  adminSettingsCaptchaProviderNoneSchema,
  adminSettingsCaptchaProviderTurnstileSchema,
  adminSettingsCaptchaProviderRecaptchaSchema,
  adminSettingsCaptchaProviderHcaptchaSchema,
  adminSettingsCaptchaProviderFriendlyCaptchaSchema,
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
  useTls: z.boolean(),
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
  defaultContent: z.string(),
  content: z.string().nullable(),
});

export const adminSettingsEmailTemplateUpdateSchema = z.lazy(() =>
  adminSettingsEmailTemplateSchema.omit({
    availableVariables: true,
    defaultContent: true,
  }),
);

export const adminSettingsServerSchema = z.object({
  maxFileManagerViewSize: z.number().min(0),
  maxFileManagerContentSearchSize: z.number().min(0),
  maxFileManagerSearchResults: z.number().min(1),
  maxSubuserCount: z.number().min(0),
  maxScheduleStepCount: z.number().min(0),
  allowOverwritingCustomDockerImage: z.boolean(),
  allowEditingStartupCommand: z.boolean(),
  allowViewingInstallationLogs: z.boolean(),
  allowAcknowledgingInstallationFailure: z.boolean(),
  allowViewingTransferProgress: z.boolean(),
});

export const adminSettingsUserSchema = z.object({
  maxServerGroupCount: z.number().min(0),
  maxApiKeyCount: z.number().min(0),
  maxCommandSnippetCount: z.number().min(0),
  maxSecurityKeyCount: z.number().min(0),
  maxSshKeyCount: z.number().min(0),
  allowChangingLanguage: z.boolean(),
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
});

export const adminSettingsRatelimitConfigurationSchema = z.object({
  hits: z.number().min(1),
  windowSeconds: z.number().min(1),
});

export const adminSettingsRatelimitsSchema = z.object({
  authRegister: adminSettingsRatelimitConfigurationSchema,
  authLogin: adminSettingsRatelimitConfigurationSchema,
  authLoginCheckpoint: adminSettingsRatelimitConfigurationSchema,
  authLoginSecurityKey: adminSettingsRatelimitConfigurationSchema,
  authPasswordForgot: adminSettingsRatelimitConfigurationSchema,
  client: adminSettingsRatelimitConfigurationSchema,
  clientServersBackupsCreate: adminSettingsRatelimitConfigurationSchema,
  clientServersFilesPull: adminSettingsRatelimitConfigurationSchema,
  clientServersFilesPullQuery: adminSettingsRatelimitConfigurationSchema,
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
  rpId: z.string().min(1).max(255),
  rpOrigin: z.url({ protocol: /^https?$/ }).max(255),
});

export const twoFactorRequirement = z.enum(['admins', 'all_users', 'none']);

export const adminSettingsSchema = z.object({
  oobeStep: oobeStepKey.nullable(),
  storageDriver: adminSettingsStorageSchema,
  mailMode: adminSettingsEmailSchema,
  captchaProvider: adminSettingsCaptchaProviderSchema,
  app: adminSettingsApplicationSchema,
  webauthn: adminSettingsWebauthnSchema,
  server: adminSettingsServerSchema,
  user: adminSettingsUserSchema,
  activity: adminSettingsActivitySchema,
  ratelimits: adminSettingsRatelimitsSchema,
});
