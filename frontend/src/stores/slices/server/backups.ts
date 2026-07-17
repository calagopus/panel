import { z } from 'zod';
import { StateCreator } from 'zustand';
import { getEmptyPaginationSet } from '@/api/axios.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { ServerStore } from '@/stores/server.ts';

export interface BackupProgress {
  progress: number;
  total: number;
  files: number;
}

export interface BackupsSlice {
  backups: Pagination<z.infer<typeof serverBackupSchema>>;

  setBackups: (backups: Pagination<z.infer<typeof serverBackupSchema>>) => void;
  addBackup: (backups: z.infer<typeof serverBackupSchema>) => void;
  removeBackup: (uuid: string) => void;
  updateBackup: (uuid: string, updatedProps: Partial<z.infer<typeof serverBackupSchema>>) => void;

  // Live in-progress backups keyed by uuid, kept separate from the lists so it can
  // drive both ungrouped (store) and grouped (component-local) rows uniformly. Entries
  // are removed on completion to keep the map bounded to running backups.
  backupProgress: Map<string, BackupProgress>;
  setBackupProgress: (uuid: string, progress: BackupProgress) => void;
  clearBackupProgress: (uuid: string) => void;

  backupRestoreProgress: number;
  backupRestoreTotal: number;
  backupRestoreFiles: number;

  setBackupRestoreProgress: (progress: number, total: number, files: number) => void;
}

export const createBackupsSlice: StateCreator<ServerStore, [], [], BackupsSlice> = (set): BackupsSlice => ({
  backups: getEmptyPaginationSet<z.infer<typeof serverBackupSchema>>(),

  setBackups: (value) => set((state) => ({ ...state, backups: value })),
  addBackup: (backup) =>
    set((state) => ({
      backups: {
        ...state.backups,
        data: [...state.backups.data, backup],
        total: state.backups.total + 1,
      },
    })),
  removeBackup: (uuid) =>
    set((state) => {
      if (!state.backups.data.some((b) => b.uuid === uuid)) return state;

      return {
        backups: {
          ...state.backups,
          data: state.backups.data.filter((b) => b.uuid !== uuid),
          total: state.backups.total - 1,
        },
      };
    }),
  updateBackup: (uuid, updatedProps) =>
    set((state) => ({
      backups: {
        ...state.backups,
        data: state.backups.data.map((b) => (b.uuid === uuid ? { ...b, ...updatedProps } : b)),
      },
    })),

  backupProgress: new Map(),
  setBackupProgress: (uuid, progress) =>
    set((state) => ({ backupProgress: new Map(state.backupProgress).set(uuid, progress) })),
  clearBackupProgress: (uuid) =>
    set((state) => {
      if (!state.backupProgress.has(uuid)) return state;

      const backupProgress = new Map(state.backupProgress);
      backupProgress.delete(uuid);
      return { backupProgress };
    }),

  backupRestoreProgress: 0,
  backupRestoreTotal: 0,
  backupRestoreFiles: 0,

  setBackupRestoreProgress: (progress, total, files) =>
    set((state) => ({
      ...state,
      backupRestoreProgress: progress,
      backupRestoreTotal: total,
      backupRestoreFiles: files,
    })),
});
