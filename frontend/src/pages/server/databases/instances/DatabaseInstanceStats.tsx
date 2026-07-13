import { faMemory, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { z } from 'zod';
import ChartBlock from '@/elements/ChartBlock.tsx';
import { useChartTickLabel } from '@/lib/chart.ts';
import {
  serverDatabaseInstanceResourceUsageSchema,
  serverDatabaseInstanceSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { mapUnitToLocale } from '@/lib/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function DatabaseInstanceStats({
  instance,
  usage,
}: {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  usage: z.infer<typeof serverDatabaseInstanceResourceUsageSchema> | null;
}) {
  const { t } = useTranslations();

  const wasOffline = useRef(false);

  const cpu = useChartTickLabel(t('pages.server.databases.instance.view.stats.cpuLoad', {}), instance.cpu, '%', 2);
  const memory = useChartTickLabel(
    t('pages.server.databases.instance.view.stats.memoryLoad', {}),
    instance.memory,
    mapUnitToLocale('MiB'),
  );

  useEffect(() => {
    if (!usage || usage.state === 'offline') {
      if (!wasOffline.current) {
        wasOffline.current = true;
        cpu.push(0);
        memory.push(0);
      }
      return;
    }

    wasOffline.current = false;
    cpu.push(usage.cpuAbsolute);
    memory.push(Math.floor(usage.memoryBytes / 1024 / 1024));
  }, [usage]);

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0'>
      <ChartBlock
        icon={<FontAwesomeIcon icon={faMicrochip} />}
        title={t('pages.server.databases.instance.view.stats.cpuLoad', {})}
      >
        <Line {...cpu.props} options={{ ...cpu.props.options, maintainAspectRatio: false }} />
      </ChartBlock>
      <ChartBlock
        icon={<FontAwesomeIcon icon={faMemory} />}
        title={t('pages.server.databases.instance.view.stats.memoryLoad', {})}
      >
        <Line {...memory.props} options={{ ...memory.props.options, maintainAspectRatio: false }} />
      </ChartBlock>
    </div>
  );
}
