import { z } from 'zod';
import {
  adminSystemBackupPolicyRunSchema,
  adminSystemBackupPolicyRunTargetSchema,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

const SYSTEM_BACKUP_POLICY_RUN_TARGET_STALE_MS = 24 * 60 * 60 * 1000;

export type SystemBackupPolicyRunState =
  | 'running'
  | 'cancelling'
  | 'cancelled'
  | 'succeeded'
  | 'partiallySucceeded'
  | 'failed'
  | 'nothingToBackUp';

export const systemBackupPolicyRunStateInfo: Record<
  SystemBackupPolicyRunState,
  { badgeColor: string; label: () => string }
> = {
  running: {
    badgeColor: 'blue',
    label: () => getTranslations().t('common.systemBackupPolicyRun.state.running', {}),
  },
  cancelling: {
    badgeColor: 'orange',
    label: () => getTranslations().t('common.systemBackupPolicyRun.state.cancelling', {}),
  },
  cancelled: {
    badgeColor: 'orange',
    label: () => getTranslations().t('common.systemBackupPolicyRun.state.cancelled', {}),
  },
  succeeded: {
    badgeColor: 'green',
    label: () => getTranslations().t('common.systemBackupPolicyRun.state.succeeded', {}),
  },
  partiallySucceeded: {
    badgeColor: 'yellow',
    label: () => getTranslations().t('common.systemBackupPolicyRun.state.partiallySucceeded', {}),
  },
  failed: {
    badgeColor: 'red',
    label: () => getTranslations().t('common.systemBackupPolicyRun.state.failed', {}),
  },
  nothingToBackUp: {
    badgeColor: 'gray',
    label: () => getTranslations().t('common.systemBackupPolicyRun.state.nothingToBackUp', {}),
  },
};

export function getSystemBackupPolicyRunState(
  run: z.infer<typeof adminSystemBackupPolicyRunSchema>,
): SystemBackupPolicyRunState {
  if (!run.completed) return run.cancelled ? 'cancelling' : 'running';
  if (run.cancelled) return 'cancelled';
  if (run.totalTargets === 0) return 'nothingToBackUp';
  if (run.successfulTargets === run.totalTargets) return 'succeeded';
  if (run.successfulTargets === 0) return 'failed';

  return 'partiallySucceeded';
}

export function isSystemBackupPolicyRunDispatching(
  run: z.infer<typeof adminSystemBackupPolicyRunSchema> | undefined,
): boolean {
  return !!run && !run.completed && run.pendingTargets > 0;
}

export function isSystemBackupPolicyRunCancellable(run: z.infer<typeof adminSystemBackupPolicyRunSchema>): boolean {
  return !run.completed && !run.cancelled;
}

export type SystemBackupPolicyRunTargetState = 'pending' | 'running' | 'successful' | 'failed' | 'skipped';

export const systemBackupPolicyRunTargetStateInfo: Record<
  SystemBackupPolicyRunTargetState,
  { badgeColor: string; label: () => string }
> = {
  pending: {
    badgeColor: 'gray',
    label: () => getTranslations().t('common.systemBackupPolicyRunTarget.state.pending', {}),
  },
  running: {
    badgeColor: 'blue',
    label: () => getTranslations().t('common.systemBackupPolicyRunTarget.state.running', {}),
  },
  successful: {
    badgeColor: 'green',
    label: () => getTranslations().t('common.systemBackupPolicyRunTarget.state.successful', {}),
  },
  failed: {
    badgeColor: 'red',
    label: () => getTranslations().t('common.systemBackupPolicyRunTarget.state.failed', {}),
  },
  skipped: {
    badgeColor: 'gray',
    label: () => getTranslations().t('common.systemBackupPolicyRunTarget.state.skipped', {}),
  },
};

export function getSystemBackupPolicyRunTargetState(
  target: z.infer<typeof adminSystemBackupPolicyRunTargetSchema>,
): SystemBackupPolicyRunTargetState {
  switch (target.status) {
    case 'pending':
      return 'pending';
    case 'skipped':
      return 'skipped';
    case 'failed':
      return 'failed';
    case 'dispatched':
      if (target.serverBackupSuccessful) return 'successful';
      if (
        target.serverBackupUuid &&
        !target.serverBackupCompleted &&
        Date.now() - target.updated.getTime() < SYSTEM_BACKUP_POLICY_RUN_TARGET_STALE_MS
      ) {
        return 'running';
      }

      return 'failed';
  }
}
