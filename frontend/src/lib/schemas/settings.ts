import { z } from 'zod';
import { oobeStepKey } from '@/lib/schemas/oobe.ts';

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
  captchaProvider: publicSettingsCaptchaProviderSchema,
  app: z.object({
    url: z.string(),
    icon: z.string(),
    banner: z.string().nullable(),
    name: z.string(),
    language: z.string(),
    registrationEnabled: z.boolean(),
    debug: z.boolean(),
  }),
  server: z.object({
    maxFileManagerViewSize: z.number(),
    maxFileManagerContentSearchSize: z.number(),
    maxFileManagerSearchResults: z.number(),
    maxSubuserCount: z.number(),
    maxScheduleStepCount: z.number(),
    allowOverwritingCustomDockerImage: z.boolean(),
    allowAcknowledgingInstallationFailure: z.boolean(),
  }),
  user: z.object({
    maxServerGroupCount: z.number(),
    maxApiKeyCount: z.number(),
    maxCommandSnippetCount: z.number(),
    maxSecurityKeyCount: z.number(),
    maxSshKeyCount: z.number(),

    allowChangingLanguage: z.boolean(),
  }),
});
