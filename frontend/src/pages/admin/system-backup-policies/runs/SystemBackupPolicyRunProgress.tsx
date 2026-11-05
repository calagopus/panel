import { Progress } from '@mantine/core';
import { z } from 'zod';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import {
  SystemBackupPolicyRunTargetState,
  systemBackupPolicyRunTargetStateInfo,
} from '@/lib/domain/systemBackupPolicyRun.ts';
import { adminSystemBackupPolicyRunSchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function SystemBackupPolicyRunProgress({
  run,
}: {
  run: z.infer<typeof adminSystemBackupPolicyRunSchema>;
}) {
  const { t } = useTranslations();

  const total = Math.max(run.totalTargets, 1);
  const sections = (
    [
      ['successful', run.successfulTargets],
      ['failed', run.failedTargets],
      ['skipped', run.skippedTargets],
      ['running', run.runningTargets],
    ] satisfies [SystemBackupPolicyRunTargetState, number][]
  )
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count, ...systemBackupPolicyRunTargetStateInfo[key] }));

  const done = run.successfulTargets + run.failedTargets + run.skippedTargets;

  return (
    <div className='flex flex-row items-center gap-2 min-w-48'>
      <Progress.Root size='lg' radius='xl' className='grow'>
        {sections.map((section) => (
          <Tooltip unwrapped key={section.key} label={`${section.label()}: ${section.count}`}>
            <Progress.Section
              value={(section.count / total) * 100}
              color={section.badgeColor}
              striped={section.key === 'running'}
              animated={section.key === 'running'}
              className='border-r border-(--mantine-color-body) last:border-r-0'
            />
          </Tooltip>
        ))}
      </Progress.Root>
      <span className='text-xs text-(--mantine-color-dimmed) tabular-nums whitespace-nowrap'>
        {t('pages.admin.systemBackupPolicies.tabs.runs.page.progress.summary', {
          done,
          total: run.totalTargets,
        })}
      </span>
    </div>
  );
}
