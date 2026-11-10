import type { DiskUsageBarProps, DiskUsageSection } from 'shared/src/registries/pages/server/files/diskUsageBar.ts';
import { getThemeColor, Progress, useMantineTheme } from '@mantine/core';
import Card from '@/elements/data-display/Card.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { usageColor, usagePercent } from '@/lib/format/usage.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function FileDiskUsageBar() {
  const diskLimit = useServerStore((state) => state.server.limits.disk);
  const diskBytes = useServerStore((state) => state.stats?.diskBytes ?? null);

  if (diskLimit === 0 || diskBytes === null) return null;

  return <DiskUsageBar diskBytes={diskBytes} limitBytes={mbToBytes(diskLimit)} />;
}

function DiskUsageBar(props: DiskUsageBarProps) {
  'use no memo';

  const { diskBytes, limitBytes } = props;
  const { t } = useTranslations();
  const theme = useMantineTheme();
  const trashBytes = useServerStore((state) => state.stats?.trashBytes);

  const registry = window.extensionContext.extensionRegistry.pages.server.files.diskUsageBar;
  const hookInterceptors = registry.sectionHooks.map((hook) => hook(props));

  const percentage = usagePercent(diskBytes, limitBytes) ?? 0;

  const sections: DiskUsageSection[] = [
    {
      id: 'files',
      label: t('pages.server.files.diskUsage.section.files', {}),
      color: usageColor(diskBytes, limitBytes) ?? 'blue',
      bytes: null,
    },
  ];
  if (trashBytes !== undefined) {
    sections.push({
      id: 'trash',
      label: t('pages.server.files.diskUsage.section.trash', {}),
      color: 'gray.6',
      bytes: trashBytes,
    });
  }

  for (const interceptor of registry.sectionInterceptors) {
    interceptor(sections, props);
  }
  for (const interceptor of hookInterceptors) {
    interceptor(sections);
  }

  const carvedBytes = sections.reduce((sum, section) => sum + (section.bytes ?? 0), 0);
  const resolved = sections.map((section) => ({
    ...section,
    bytes: section.bytes ?? Math.max(0, diskBytes - carvedBytes),
  }));
  const scale = Math.max(limitBytes, diskBytes, carvedBytes);
  const legend = carvedBytes > 0;

  const details = t('pages.server.files.diskUsage.details', {
    used: bytesToString(diskBytes),
    total: bytesToString(limitBytes),
    percentage: percentage.toFixed(1),
  });

  return (
    <Card mb='sm'>
      <div className='flex flex-col sm:flex-row sm:items-center w-full text-sm gap-1 sm:gap-0'>
        <div className='flex items-center justify-between gap-2 sm:contents'>
          <span className='shrink-0'>{t('common.stat.diskUsage', {})}</span>
          <span className='text-(--mantine-color-dimmed) sm:hidden'>{details}</span>
        </div>
        <Progress.Root size='xl' radius='xl' className='flex-1 sm:mx-2'>
          {resolved.map((section) => (
            <Tooltip unwrapped key={section.id} label={`${section.label}: ${bytesToString(section.bytes)}`}>
              <Progress.Section
                value={(section.bytes / scale) * 100}
                color={section.color}
                className='border-r border-(--mantine-color-body) last:border-r-0'
              />
            </Tooltip>
          ))}
        </Progress.Root>
        <span className='hidden sm:inline text-(--mantine-color-dimmed)'>{details}</span>
      </div>
      {legend && (
        <div className='flex flex-row flex-wrap gap-x-4 gap-y-1 mt-2'>
          {resolved.map((section) => (
            <div key={section.id} className='flex flex-row items-center gap-1.5 text-xs'>
              <span
                className='inline-block size-2.5 rounded-full shrink-0'
                style={{ backgroundColor: getThemeColor(section.color, theme) }}
              />
              <span>{section.label}</span>
              <span className='text-(--mantine-color-dimmed) tabular-nums'>{bytesToString(section.bytes)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
