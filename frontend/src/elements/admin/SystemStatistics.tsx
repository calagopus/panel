import { faCloudDownload, faDatabase, faMemory, faMicrochip, faUserLarge } from '@fortawesome/free-solid-svg-icons';
import { faChartBar } from '@fortawesome/free-solid-svg-icons/faChartBar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import ChartBlock from '@/elements/charts/ChartBlock.tsx';
import ChartLegend from '@/elements/charts/ChartLegend.tsx';
import StreamChart from '@/elements/charts/StreamChart.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import SemiCircleProgress from '@/elements/feedback/SemiCircleProgress.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Title from '@/elements/typography/Title.tsx';
import { formatBytes, formatBytesRate, formatPercent, useStreamChart } from '@/lib/chart.ts';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { adminSystemStatisticsSchema } from '@/lib/schemas/admin/system.ts';
import { useWebsocket } from '@/plugins/websocket/useWebsocket.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export interface SystemStatisticsLabels {
  cpu: string;
  memory: string;
  disk: string;
  network: string;
  resourcesCard: string;
  graphsCard: string;
  cpuLoad: string;
  memoryUsage: string;
  diskIo: string;
  networkTraffic: string;
  diskRead: string;
  diskWrite: string;
  inbound: string;
  outbound: string;
  connectionLost: string;
  cpuThreads: (model: string, threads: number) => string;
  memoryUsedByProcess: (size: string) => string;
  networkIn: (size: string) => string;
  networkOut: (size: string) => string;
}

export default function SystemStatistics({ wsPath, labels }: { wsPath: string; labels: SystemStatisticsLabels }) {
  const { addToast } = useToast();

  const [stats, setStats] = useState<z.infer<typeof adminSystemStatisticsSchema> | null>(null);

  const cpu = useStreamChart({
    series: useMemo(() => [labels.cpu], [labels.cpu]),
    format: formatPercent,
    min: 10,
  });
  const memory = useStreamChart({
    series: useMemo(() => [labels.memory], [labels.memory]),
    format: formatBytes,
    scale: 'binary',
    min: mbToBytes(64),
  });
  const disk = useStreamChart({
    series: useMemo(() => [labels.diskRead, labels.diskWrite], [labels.diskRead, labels.diskWrite]),
    format: formatBytesRate,
    scale: 'binary',
  });
  const network = useStreamChart({
    series: useMemo(() => [labels.inbound, labels.outbound], [labels.inbound, labels.outbound]),
    format: formatBytesRate,
    scale: 'binary',
  });

  useWebsocket({
    path: wsPath,
    schema: adminSystemStatisticsSchema,
    reconnectDelay: 5000,
    onMessage: setStats,
    onConnectionLost: () => {
      setStats(null);
      addToast(labels.connectionLost, 'error');
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

  if (!stats) {
    return <Spinner.Centered />;
  }

  const memoryPercent = (stats.memory.used / stats.memory.total) * 100;
  const diskPercent = (stats.disk.used / stats.disk.total) * 100;

  return (
    <>
      <div className='mt-4'>
        <TitleCard title={labels.resourcesCard} icon={<FontAwesomeIcon icon={faUserLarge} />}>
          <div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4'>
            <Card>
              <div className='flex flex-col md:flex-row gap-4 md:items-center'>
                <div className='flex justify-center md:flex-1'>
                  <SemiCircleProgress
                    value={stats.cpu.used}
                    label={<>{stats.cpu.used.toFixed(1)}%</>}
                    filledSegmentColor={stats.cpu.used >= 90 ? 'red' : undefined}
                  />
                </div>
                <div className='flex flex-col text-center md:text-right flex-1'>
                  <Title order={2}>{labels.cpu}</Title>
                  <h2>{labels.cpuThreads(stats.cpu.model, stats.cpu.threads)}</h2>
                </div>
              </div>
            </Card>
            <Card>
              <div className='flex flex-col md:flex-row gap-4 md:items-center'>
                <div className='flex justify-center md:flex-1'>
                  <SemiCircleProgress
                    value={memoryPercent}
                    label={<>{memoryPercent.toFixed(1)}%</>}
                    filledSegmentColor={stats.memory.used / stats.memory.total >= 0.9 ? 'red' : undefined}
                  />
                </div>
                <div className='flex flex-col text-center md:text-right flex-1'>
                  <Title order={2}>{labels.memory}</Title>
                  <h2>
                    {bytesToString(stats.memory.used)} / {bytesToString(stats.memory.total)}
                  </h2>
                  <p className='text-xs'>{labels.memoryUsedByProcess(bytesToString(stats.memory.usedProcess))}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className='flex flex-col md:flex-row gap-4 md:items-center'>
                <div className='flex justify-center md:flex-1'>
                  <SemiCircleProgress
                    value={diskPercent}
                    label={<>{diskPercent.toFixed(1)}%</>}
                    filledSegmentColor={stats.disk.used / stats.disk.total >= 0.9 ? 'red' : undefined}
                  />
                </div>
                <div className='flex flex-col text-center md:text-right flex-1'>
                  <Title order={2}>{labels.disk}</Title>
                  <h2>
                    {bytesToString(stats.disk.used)} / {bytesToString(stats.disk.total)}
                  </h2>
                </div>
              </div>
            </Card>
            <Card>
              <div className='flex flex-col md:flex-row gap-4 md:items-center'>
                <div className='flex justify-center md:flex-1'>
                  <SemiCircleProgress value={100} label='--' filledSegmentColor='gray' />
                </div>
                <div className='flex flex-col text-center md:text-right flex-1'>
                  <Title order={2}>{labels.network}</Title>
                  <h2>
                    {labels.networkIn(bytesToString(stats.network.received))}
                    <br />
                    {labels.networkOut(bytesToString(stats.network.sent))}
                  </h2>
                </div>
              </div>
            </Card>
          </div>
        </TitleCard>
      </div>
      <div className='mt-4'>
        <TitleCard title={labels.graphsCard} icon={<FontAwesomeIcon icon={faChartBar} />}>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <ChartBlock icon={<FontAwesomeIcon icon={faMicrochip} />} title={labels.cpuLoad} value={cpu.value}>
              <StreamChart {...cpu.props} />
            </ChartBlock>
            <ChartBlock icon={<FontAwesomeIcon icon={faMemory} />} title={labels.memoryUsage} value={memory.value}>
              <StreamChart {...memory.props} />
            </ChartBlock>
            <ChartBlock
              icon={<FontAwesomeIcon icon={faDatabase} />}
              title={labels.diskIo}
              legend={<ChartLegend {...disk.legend} />}
            >
              <StreamChart {...disk.props} />
            </ChartBlock>
            <ChartBlock
              icon={<FontAwesomeIcon icon={faCloudDownload} />}
              title={labels.networkTraffic}
              legend={<ChartLegend {...network.legend} />}
            >
              <StreamChart {...network.props} />
            </ChartBlock>
          </div>
        </TitleCard>
      </div>
    </>
  );
}
