import { z } from 'zod';
import { eggConfigurationRouteItemSchema } from '@/lib/schemas/generic.ts';
import { oobeStepKey } from '@/lib/schemas/oobe.ts';
import { twoFactorMethod } from '@/lib/schemas/user.ts';

export const publicSettingsCaptchaProviderNoneSchema = z.object({
  type: z.literal('none'),
});

export const publicSettingsCaptchaProviderTurnstileSchema = z.object({
  type: z.literal('turnstile'),
  siteKey: z.string(),
});

export const publicSettingsCaptchaProviderRecaptchaSchema = z.object({
  type: z.literal('recaptcha'),
  siteKey: z.string(),
  v3: z.boolean(),
});

export const publicSettingsCaptchaProviderHcaptchaSchema = z.object({
  type: z.literal('hcaptcha'),
  siteKey: z.string(),
});

export const publicSettingsCaptchaProviderFriendlyCaptchaSchema = z.object({
  type: z.literal('friendly_captcha'),
  siteKey: z.string(),
});

export const publicSettingsCaptchaProviderSchema = z.discriminatedUnion('type', [
  publicSettingsCaptchaProviderNoneSchema,
  publicSettingsCaptchaProviderTurnstileSchema,
  publicSettingsCaptchaProviderRecaptchaSchema,
  publicSettingsCaptchaProviderHcaptchaSchema,
  publicSettingsCaptchaProviderFriendlyCaptchaSchema,
]);

export const publicSettingsSchema = z.object({
  time: z.string(),
  oobeStep: oobeStepKey.nullable(),
  disabledExtensions: z.array(z.string()),
  captchaProvider: publicSettingsCaptchaProviderSchema,
  app: z.object({
    url: z.string(),
    icon: z.string(),
    iconLight: z.string().nullable(),
    banner: z.string().nullable(),
    bannerLight: z.string().nullable(),
    name: z.string(),
    language: z.string(),
    registrationEnabled: z.boolean(),
    emailTwoFactorEnabled: z.boolean(),
    emailVerificationRequired: z.boolean(),
    twoFactorAcceptedMethods: z.array(twoFactorMethod),
    debug: z.boolean(),
  }),
  webauthn: z.object({
    enabled: z.boolean(),
    allowDiscoverable: z.boolean(),
  }),
  server: z.object({
    maxFileManagerViewSize: z.number(),
    maxFileManagerContentSearchSize: z.number(),
    maxFileManagerSearchResults: z.number(),
    maxSubuserCount: z.number(),
    maxScheduleStepCount: z.number(),
    maxBackupGroupCount: z.number(),
    maxFirewallRuleCount: z.number(),
    maxFirewallRuleSourceCount: z.number(),
    maxDatabaseInstanceDatabaseCount: z.number(),
    maxDatabaseInstanceUserCount: z.number(),
    allowOverwritingCustomDockerImage: z.boolean(),
    allowAcknowledgingInstallationFailure: z.boolean(),
    containerPrelude: z.string(),
  }),
  user: z.object({
    maxServerGroupCount: z.number(),
    maxApiKeyCount: z.number(),
    maxCommandSnippetCount: z.number(),
    maxSecurityKeyCount: z.number(),
    maxSshKeyCount: z.number(),

    allowChangingLanguage: z.boolean(),

    routeOrder: z.array(eggConfigurationRouteItemSchema).nullable(),
  }),
});
