import { z } from 'zod';
import { adminSettingsRatelimitsSchema } from '@/lib/schemas/admin/settings.ts';

type RatelimitsFormValues = z.infer<typeof adminSettingsRatelimitsSchema>;
type RatelimitsFormKey = keyof RatelimitsFormValues;

export interface RatelimitEndpoint {
  label: string;
  key: RatelimitsFormKey;
}

export const ratelimitEndpoints: RatelimitEndpoint[] = [
  { label: 'auth/register', key: 'authRegister' },
  { label: 'auth/login', key: 'authLogin' },
  { label: 'auth/login/checkpoint', key: 'authLoginCheckpoint' },
  { label: 'auth/login/checkpoint/email', key: 'authLoginCheckpointEmail' },
  { label: 'auth/login/security-key', key: 'authLoginSecurityKey' },
  { label: 'auth/password/forgot', key: 'authPasswordForgot' },
  { label: 'auth/password/reset', key: 'authPasswordReset' },
  { label: 'auth/email/verify', key: 'authEmailVerification' },
  { label: 'client', key: 'client' },
  { label: 'client/account/email/resend-verification', key: 'clientAccountEmailResendVerification' },
  { label: 'client/servers/backups/create', key: 'clientServersBackupsCreate' },
  { label: 'client/servers/files/pull', key: 'clientServersFilesPull' },
  { label: 'client/servers/files/pull/query', key: 'clientServersFilesPullQuery' },
  { label: 'remote', key: 'remote' },
  { label: 'remote/sftp/auth', key: 'remoteSftpAuth' },
];

export const ratelimitsEmptyFormValues: RatelimitsFormValues = Object.fromEntries(
  ratelimitEndpoints.map(({ key }) => [key, { hits: 0, windowSeconds: 0 }]),
) as RatelimitsFormValues;

export const ratelimitsToFormValues = (ratelimits: RatelimitsFormValues): Partial<RatelimitsFormValues> => ({
  ...ratelimits,
});
