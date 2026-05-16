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
    language: '',
    url: '',
    banner: null,
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
  },
  user: {
    maxServerGroupCount: 25,
    maxApiKeyCount: 50,
    maxCommandSnippetCount: 100,
    maxSecurityKeyCount: 50,
    maxSshKeyCount: 50,
    allowChangingLanguage: true,
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
  },

  updateInformation: null,

  setSettings: (value) =>
    set((state) => {
      state.storageDriver = value.storageDriver;
      state.mailMode = value.mailMode;
      state.captchaProvider = value.captchaProvider;
      state.app = value.app;
      state.server = value.server;
      state.webauthn = value.webauthn;
      state.activity = value.activity;
      state.ratelimits = value.ratelimits;
      return state;
    }),
  updateSettings: (value) =>
    set((state) => {
      if (value.storageDriver) state.storageDriver = value.storageDriver;
      if (value.mailMode) state.mailMode = value.mailMode;
      if (value.captchaProvider) state.captchaProvider = value.captchaProvider;
      if (value.app) state.app = { ...state.app, ...value.app };
      if (value.server) state.server = { ...state.server, ...value.server };
      if (value.webauthn) state.webauthn = { ...state.webauthn, ...value.webauthn };
      if (value.activity) state.activity = { ...state.activity, ...value.activity };
      if (value.ratelimits) state.ratelimits = { ...state.ratelimits, ...value.ratelimits };
      return state;
    }),
  setUpdateInformation: (value) => set((state) => ({ ...state, updateInformation: value })),
});
