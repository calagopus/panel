import { faClock, faEthernet, faHardDrive, faMemory, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { z } from 'zod';
import StatCard from '@/elements/StatCard.tsx';
import {
  serverDatabaseInstanceResourceUsageSchema,
  serverDatabaseInstanceSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { bytesToString, mbToBytes } from '@/lib/size.ts';
import { formatMilliseconds } from '@/lib/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DatabaseInstanceDetails({
  instance,
  usage,
}: {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  usage: z.infer<typeof serverDatabaseInstanceResourceUsageSchema> | null;
}) {
  const { t } = useTranslations();

  const offline = !usage || usage.state === 'offline';
  const host = instance.host ? `${instance.host}${instance.port ? `:${instance.port}` : ''}` : null;

  return (
    <div className='flex flex-col space-y-4'>
      <StatCard
        icon={faEthernet}
        label={t('common.table.columns.address', {})}
        copyOnClick={!!host}
        value={host ?? t('common.na', {})}
      />
      <StatCard
        icon={faClock}
        label={t('pages.server.databases.instance.view.stats.uptime', {})}
        value={offline ? t('common.enum.serverState.offline', {}) : formatMilliseconds(usage.uptime)}
      />
      <StatCard
        icon={faMicrochip}
        label={t('pages.server.databases.instance.view.stats.cpuLoad', {})}
        value={offline ? t('common.enum.serverState.offline', {}) : `${usage.cpuAbsolute.toFixed(2)}%`}
        limit={instance.cpu !== 0 ? `${instance.cpu}%` : t('common.unlimited', {})}
      />
      <StatCard
        icon={faMemory}
        label={t('pages.server.databases.instance.view.stats.memoryLoad', {})}
        value={offline ? t('common.enum.serverState.offline', {}) : bytesToString(usage.memoryBytes)}
        limit={instance.memory !== 0 ? bytesToString(mbToBytes(instance.memory)) : t('common.unlimited', {})}
      />
      <StatCard
        icon={faHardDrive}
        label={t('pages.server.databases.instance.view.stats.diskUsage', {})}
        value={bytesToString(usage?.diskBytes ?? 0)}
        limit={instance.disk !== 0 ? bytesToString(mbToBytes(instance.disk)) : t('common.unlimited', {})}
      />
    </div>
  );
}
