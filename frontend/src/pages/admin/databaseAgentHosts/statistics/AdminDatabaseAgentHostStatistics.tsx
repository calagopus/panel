import { faCloudDownload, faDatabase, faMemory, faMicrochip, faUserLarge } from '@fortawesome/free-solid-svg-icons';
import { faChartBar } from '@fortawesome/free-solid-svg-icons/faChartBar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import Card from '@/elements/Card.tsx';
import ChartBlock from '@/elements/ChartBlock.tsx';
import ChartLegend from '@/elements/ChartLegend.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import SemiCircleProgress from '@/elements/SemiCircleProgress.tsx';
import Spinner from '@/elements/Spinner.tsx';
import StreamChart from '@/elements/StreamChart.tsx';
import Title from '@/elements/Title.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { formatBytes, formatBytesRate, formatPercent, useStreamChart } from '@/lib/chart.ts';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { adminSystemStatisticsSchema } from '@/lib/schemas/admin/system.ts';
import { bytesToString, mbToBytes } from '@/lib/size.ts';
import { useWebsocket } from '@/plugins/useWebsocket.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminDatabaseAgentHostStatistics({
  databaseAgentHost,
}: {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [stats, setStats] = useState<z.infer<typeof adminSystemStatisticsSchema> | null>(null);

  const cpu = useStreamChart({
    series: useMemo(() => [t('common.stat.cpu', {})], [t]),
    format: formatPercent,
    min: 10,
  });
  const memory = useStreamChart({
    series: useMemo(() => [t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.memory', {})], [t]),
    format: formatBytes,
    scale: 'binary',
    min: mbToBytes(64),
  });
  const disk = useStreamChart({
    series: useMemo(
      () => [
        t('pages.admin.databaseAgentHosts.tabs.statistics.page.chart.diskRead', {}),
        t('pages.admin.databaseAgentHosts.tabs.statistics.page.chart.diskWrite', {}),
      ],
      [t],
    ),
    format: formatBytesRate,
    scale: 'binary',
  });
  const network = useStreamChart({
    series: useMemo(() => [t('common.stat.inbound', {}), t('common.stat.outbound', {})], [t]),
    format: formatBytesRate,
    scale: 'binary',
  });

  useWebsocket({
    path: `/api/admin/database-agent-hosts/${databaseAgentHost.uuid}/system/stats/ws`,
    schema: adminSystemStatisticsSchema,
    reconnectDelay: 5000,
    onMessage: setStats,
    onConnectionLost: () => {
      setStats(null);
      addToast(t('pages.admin.databaseAgentHosts.tabs.statistics.page.toast.connectionLost', {}), 'error');
    },
  });

  useEffect(() => {
    if (!stats) {
      return;
    }

    cpu.push(stats.cpu.used);
    memory.push(stats.memory.used);
    disk.push([stats.disk.readingRate, stats.disk.writingRate]);
    network.push([stats.network.receivingRate, stats.network.sendingRate]);
  }, [stats]);

  return (
    <AdminSubContentContainer
      title={t('pages.admin.databaseAgentHosts.tabs.statistics.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentHosts.view.statistics.subContainer}
      registryProps={{ databaseAgentHost }}
    >
      {!stats ? (
        <Spinner.Centered />
      ) : (
        <>
          <div className='mt-4'>
            <TitleCard title={t('common.stat.resources', {})} icon={<FontAwesomeIcon icon={faUserLarge} />}>
              <div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4'>
                <Card>
                  <Group grow>
                    <div className='flex justify-center'>
                      <SemiCircleProgress
                        value={stats.cpu.used}
                        label={<>{stats.cpu.used.toFixed(1)}%</>}
                        filledSegmentColor={stats.cpu.used >= 90 ? 'red' : undefined}
                      />
                    </div>
                    <div className='flex flex-col text-right flex-1'>
                      <Title order={2}>{t('common.stat.cpu', {})}</Title>
                      <h2>
                        {t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.cpuThreads', {
                          model: stats.cpu.model,
                          threads: stats.cpu.threads,
                        })}
                      </h2>
                    </div>
                  </Group>
                </Card>
                <Card>
                  <Group grow>
                    <div className='flex justify-center'>
                      <SemiCircleProgress
                        value={(stats.memory.used / stats.memory.total) * 100}
                        label={<>{((stats.memory.used / stats.memory.total) * 100).toFixed(1)}%</>}
                        filledSegmentColor={stats.memory.used / stats.memory.total >= 0.9 ? 'red' : undefined}
                      />
                    </div>
                    <div className='flex flex-col text-right flex-1'>
                      <Title order={2}>
                        {t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.memory', {})}
                      </Title>
                      <h2>
                        {bytesToString(stats.memory.used)} / {bytesToString(stats.memory.total)}
                      </h2>
                      <p className='text-xs'>
                        {t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.usedByAgent', {
                          size: bytesToString(stats.memory.usedProcess),
                        })}
                      </p>
                    </div>
                  </Group>
                </Card>
                <Card>
                  <Group grow>
                    <div className='flex justify-center'>
                      <SemiCircleProgress
                        value={(stats.disk.used / stats.disk.total) * 100}
                        label={<>{((stats.disk.used / stats.disk.total) * 100).toFixed(1)}%</>}
                        filledSegmentColor={stats.disk.used / stats.disk.total >= 0.9 ? 'red' : undefined}
                      />
                    </div>
                    <div className='flex flex-col text-right flex-1'>
                      <Title order={2}>{t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.disk', {})}</Title>
                      <h2>
                        {bytesToString(stats.disk.used)} / {bytesToString(stats.disk.total)}
                      </h2>
                    </div>
                  </Group>
                </Card>
                <Card>
                  <Group grow>
                    <div className='flex justify-center'>
                      <SemiCircleProgress value={100} label='--' filledSegmentColor='gray' />
                    </div>
                    <div className='flex flex-col text-right flex-1'>
                      <Title order={2}>{t('common.stat.network', {})}</Title>
                      <h2>
                        {t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.networkIn', {
                          in: bytesToString(stats.network.received),
                        })}
                        <br />
                        {t('pages.admin.databaseAgentHosts.tabs.statistics.page.label.networkOut', {
                          out: bytesToString(stats.network.sent),
                        })}
                      </h2>
                    </div>
                  </Group>
                </Card>
              </div>
            </TitleCard>
          </div>
          <div className='mt-4'>
            <TitleCard
              title={t('pages.admin.databaseAgentHosts.tabs.statistics.page.card.graphs', {})}
              icon={<FontAwesomeIcon icon={faChartBar} />}
            >
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <ChartBlock
                  icon={<FontAwesomeIcon icon={faMicrochip} />}
                  title={t('common.stat.cpuLoad', {})}
                  value={cpu.value}
                >
                  <StreamChart {...cpu.props} />
                </ChartBlock>
                <ChartBlock
                  icon={<FontAwesomeIcon icon={faMemory} />}
                  title={t('common.stat.memoryUsage', {})}
                  value={memory.value}
                >
                  <StreamChart {...memory.props} />
                </ChartBlock>
                <ChartBlock
                  icon={<FontAwesomeIcon icon={faDatabase} />}
                  title={t('pages.admin.databaseAgentHosts.tabs.statistics.page.chart.diskIo', {})}
                  legend={<ChartLegend {...disk.legend} />}
                >
                  <StreamChart {...disk.props} />
                </ChartBlock>
                <ChartBlock
                  icon={<FontAwesomeIcon icon={faCloudDownload} />}
                  title={t('pages.admin.databaseAgentHosts.tabs.statistics.page.chart.networkTraffic', {})}
                  legend={<ChartLegend {...network.legend} />}
                >
                  <StreamChart {...network.props} />
                </ChartBlock>
              </div>
            </TitleCard>
          </div>
        </>
      )}
    </AdminSubContentContainer>
  );
}
