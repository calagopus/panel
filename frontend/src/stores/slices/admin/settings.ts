import { z } from 'zod';
import { StateCreator } from 'zustand';
import { adminSettingsSchema } from '@/lib/schemas/admin/settings.ts';
import { adminUpdateInformationSchema } from '@/lib/schemas/admin/updates.ts';
import { AdminStore } from '@/stores/admin.tsx';

export interface SettingsSlice extends z.infer<typeof adminSettingsSchema> {
  updateInformation: z.infer<typeof adminUpdateInformationSchema> | null;

  setSettings: (settings: z.infer<typeof adminSettingsSchema>) => void;
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
    twoFactorRequirement: 'none',
    telemetryEnabled: true,
    registrationEnabled: true,
  },
  server: {
    maxFileManagerViewSize: 10 * 1024 * 1024 * 1024,
    maxFileManagerContentSearchSize: 5 * 1024 * 1024 * 1024,
    maxFileManagerSearchResults: 100,
    maxSchedulesStepCount: 100,
    allowOverwritingCustomDockerImage: true,
    allowEditingStartupCommand: false,
    allowViewingInstallationLogs: true,
    allowAcknowledgingInstallationFailure: true,
    allowViewingTransferProgress: true,
  },
  webauthn: {
    rpId: '',
    rpOrigin: '',
  },
  activity: {
    adminLogRetentionDays: 180,
    userLogRetentionDays: 90,
    serverLogRetentionDays: 90,
    serverLogAdminActivity: true,
    serverLogScheduleActivity: true,
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
      return state;
    }),
  setUpdateInformation: (value) => set((state) => ({ ...state, updateInformation: value })),
});
