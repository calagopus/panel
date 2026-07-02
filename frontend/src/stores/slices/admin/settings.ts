import { z } from 'zod';
import { StateCreator } from 'zustand';
import { adminSettingsSchema } from '@/lib/schemas/admin/settings.ts';
import { adminUpdateInformationSchema } from '@/lib/schemas/admin/system.ts';
import { AdminStore } from '@/stores/admin.tsx';

export interface SettingsSlice extends z.infer<typeof adminSettingsSchema> {
  updateInformation: z.infer<typeof adminUpdateInformationSchema> | null;

  setSettings: (settings: z.infer<typeof adminSettingsSchema>) => void;
  updateSettings: (settings: Partial<z.infer<typeof adminSettingsSchema>>) => void;
  setUpdateInformation: (updateInformation: z.infer<typeof adminUpdateInformationSchema> | null) => void;
}

export const createSettingsSlice: StateCreator<AdminStore, [], [], SettingsSlice> = (set): SettingsSlice => ({
  oobeStep: null,
  storageDriver: {
    type: 'filesystem',
    path: '',
  },
  mailMode: {
    type: 'none',
  },
  captchaProvider: {
    type: 'none',
  },
  app: {
    name: '',
    icon: '',
    iconLight: null,
    language: '',
    url: '',
    banner: null,
    bannerLight: null,
    twoFactorRequirement: 'none',
    sessionCookie: '',
    sessionDurationSeconds: 3600,
    telemetryEnabled: true,
    registrationEnabled: true,
  },
  server: {
    maxFileManagerViewSize: 10 * 1024 * 1024 * 1024,
    maxFileManagerContentSearchSize: 5 * 1024 * 1024 * 1024,
    maxFileManagerSearchResults: 100,
    maxSubuserCount: 25,
    maxScheduleStepCount: 50,
    allowOverwritingCustomDockerImage: true,
    allowEditingStartupCommand: false,
    allowViewingInstallationLogs: true,
    allowAcknowledgingInstallationFailure: true,
    allowViewingTransferProgress: true,
    containerPrelude: '\x1b[1m\x1b[33mcontainer@calagopus~ \x1b[0m',
  },
  user: {
    maxServerGroupCount: 25,
    maxApiKeyCount: 50,
    maxCommandSnippetCount: 100,
    maxSecurityKeyCount: 50,
    maxSshKeyCount: 50,
    allowChangingLanguage: true,
    routeOrder: null,
  },
  webauthn: {
    rpId: '',
    rpOrigin: '',
  },
  activity: {
    adminLogRetentionDays: 180,
    adminLogRetentionCount: null,
    userLogRetentionDays: 90,
    userLogRetentionCount: null,
    serverLogRetentionDays: 90,
    serverLogRetentionCount: null,
    serverLogAdminActivity: true,
    serverLogScheduleActivity: true,
  },
  ratelimits: {
    authRegister: {
      hits: 0,
      windowSeconds: 0,
    },
    authLogin: {
      hits: 0,
      windowSeconds: 0,
    },
    authLoginCheckpoint: {
      hits: 0,
      windowSeconds: 0,
    },
    authLoginSecurityKey: {
      hits: 0,
      windowSeconds: 0,
    },
    authPasswordForgot: {
      hits: 0,
      windowSeconds: 0,
    },
    authPasswordReset: {
      hits: 0,
      windowSeconds: 0,
    },
    client: {
      hits: 0,
      windowSeconds: 0,
    },
    clientServersBackupsCreate: {
      hits: 0,
      windowSeconds: 0,
    },
    clientServersFilesPull: {
      hits: 0,
      windowSeconds: 0,
    },
    clientServersFilesPullQuery: {
      hits: 0,
      windowSeconds: 0,
    },
    remote: {
      hits: 0,
      windowSeconds: 0,
    },
    remoteSftpAuth: {
      hits: 0,
      windowSeconds: 0,
    },
  },

  updateInformation: null,

  setSettings: (value) =>
    set(() => ({
      storageDriver: value.storageDriver,
      mailMode: value.mailMode,
      captchaProvider: value.captchaProvider,
      app: value.app,
      server: value.server,
      user: value.user,
      webauthn: value.webauthn,
      activity: value.activity,
      ratelimits: value.ratelimits,
    })),
  updateSettings: (value) =>
    set((state) => ({
      ...(value.storageDriver ? { storageDriver: value.storageDriver } : {}),
      ...(value.mailMode ? { mailMode: value.mailMode } : {}),
      ...(value.captchaProvider ? { captchaProvider: value.captchaProvider } : {}),
      ...(value.app ? { app: { ...state.app, ...value.app } } : {}),
      ...(value.server ? { server: { ...state.server, ...value.server } } : {}),
      ...(value.user ? { user: { ...state.user, ...value.user } } : {}),
      ...(value.webauthn ? { webauthn: { ...state.webauthn, ...value.webauthn } } : {}),
      ...(value.activity ? { activity: { ...state.activity, ...value.activity } } : {}),
      ...(value.ratelimits ? { ratelimits: { ...state.ratelimits, ...value.ratelimits } } : {}),
    })),
  setUpdateInformation: (value) => set((state) => ({ ...state, updateInformation: value })),
});
