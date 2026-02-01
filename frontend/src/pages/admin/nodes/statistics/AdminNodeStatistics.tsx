import {
  faCloudArrowDown,
  faCloudArrowUp,
  faCloudDownload,
  faDatabase,
  faMemory,
  faMicrochip,
  faPen,
  faSearch,
faUserLarge,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
import Card from '@/elements/Card.tsx';
import ChartBlock from '@/elements/ChartBlock.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import SemiCircleProgress from '@/elements/SemiCircleProgress.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { useChart, useChartTickLabel } from '@/lib/chart.ts';
import { hexToRgba } from '@/lib/color.ts';
import { bytesToString } from '@/lib/size.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import TitleCard from '@/elements/TitleCard';
import { faChartBar } from '@fortawesome/free-solid-svg-icons/faChartBar';

interface NodeStatistics {
  cpu: {
    used: number;
    threads: number;
    model: string;
  };
  network: {
    received: number;
    receivingRate: number;
    sent: number;
    sendingRate: number;
  };
  memory: {
    used: number;
    usedProcess: number;
    total: number;
  };
  disk: {
    used: number;
    total: number;
    read: number;
    readingRate: number;
    written: number;
    writingRate: number;
  };
}

export default function AdminNodeStatistics({ node }: { node: Node }) {
  const { addToast } = useToast();

  const [stats, setStats] = useState<NodeStatistics | null>(null);

  const cpu = useChartTickLabel('CPU', 100, '%', 2);
  const memory = useChartTickLabel('Memory', stats ? Math.floor(stats.memory.total / 1024 / 1024) : 0, 'MiB');
  const disk = useChart('Disk', {
    sets: 2,
    options: {
      scales: {
        y: {
          ticks: {
            callback(value) {
              return bytesToString(typeof value === 'string' ? parseInt(value, 10) : value);
            },
          },
        },
      },
    },
    callback(opts, index) {
      return {
        ...opts,
        label: !index ? 'Disk Read' : 'Disk Write',
        borderColor: !index ? '#22d3ee' : '#facc15', // cyan-400 & yellow-400
        backgroundColor: hexToRgba(!index ? '#0e7490' : '#a16207', 0.5), // cyan-700 & yellow-700
      };
    },
  });
  const network = useChart('Network', {
    sets: 2,
    options: {
      scales: {
        y: {
          ticks: {
            callback(value) {
              return bytesToString(typeof value === 'string' ? parseInt(value, 10) : value);
            },
          },
        },
      },
    },
    callback(opts, index) {
      return {
        ...opts,
        label: !index ? 'Network In' : 'Network Out',
        borderColor: !index ? '#22d3ee' : '#facc15', // cyan-400 & yellow-400
        backgroundColor: hexToRgba(!index ? '#0e7490' : '#a16207', 0.5), // cyan-700 & yellow-700
      };
    },
  });

  useEffect(() => {
    const run = () => {
      axiosInstance
        .get(`${new URL(node.publicUrl ?? node.url).origin}/api/system/stats`, {
          headers: {
            Authorization: `Bearer ${node.token}`,
          },
        })
        .then(({ data }) => {
          setStats(data.stats);
        })
        .catch((msg) => {
          addToast(httpErrorToHuman(msg), 'error');
        });
    };

    run();

    const interval = setInterval(run, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!stats) {
      return;
    }

    cpu.push(stats.cpu.used);
    memory.push(Math.floor(stats.memory.used / 1024 / 1024));
    disk.push([stats.disk.readingRate, stats.disk.writingRate]);
    network.push([stats.network.receivingRate, stats.network.sendingRate]);
  }, [stats]);

  return (
    <AdminSubContentContainer title='Node Statistics' titleOrder={2}>
      {!stats ? (
        <Spinner.Centered />
      ) : (
        <>
          <div className='mt-4'>
            <TitleCard title={'Resources'} icon={<FontAwesomeIcon icon={faUserLarge}/>}>
              <div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4'>
                <Card className='flex flex-row!'>
                  <SemiCircleProgress
                    value={stats.cpu.used}
                    label={<>{stats.cpu.used.toFixed(1)}%</>}
                    filledSegmentColor={stats.cpu.used >= 90 ? 'red' : undefined}
                    mr='md'
                  />
                  <div className='flex flex-col text-right flex-1'>
                    <Title order={2}>CPU</Title>
                    <h2>{stats.cpu.model}</h2>
                  </div>
                </Card>
                <Card className='flex flex-row!'>
                  <SemiCircleProgress
                    value={(stats.memory.used / stats.memory.total) * 100}
                    label={<>{((stats.memory.used / stats.memory.total) * 100).toFixed(1)}%</>}
                    filledSegmentColor={stats.memory.used / stats.memory.total >= 0.9 ? 'red' : undefined}
                    mr='md'
                  />
                  <div className='flex flex-col text-right flex-1'>
                    <Title order={2}>Memory</Title>
                    <h2>
                      {bytesToString(stats.memory.used)} / {bytesToString(stats.memory.total)}
                    </h2>
                    <p className='text-xs'>{bytesToString(stats.memory.usedProcess)} used by Wings</p>
                  </div>
                </Card>
                <Card className='flex flex-row!'>
                  <SemiCircleProgress
                    value={(stats.disk.used / stats.disk.total) * 100}
                    label={<>{((stats.disk.used / stats.disk.total) * 100).toFixed(1)}%</>}
                    filledSegmentColor={stats.disk.used / stats.disk.total >= 0.9 ? 'red' : undefined}
                    mr='md'
                  />
                  <div className='flex flex-col text-right flex-1'>
                    <Title order={2}>Disk</Title>
                    <h2>
                      {bytesToString(stats.disk.used)} / {bytesToString(stats.disk.total)}
                    </h2>
                  </div>
                </Card>
                <Card className='flex flex-row!'>
                  <SemiCircleProgress value={100} label='--' filledSegmentColor='gray' mr='md' />
                  <div className='flex flex-col text-right flex-1'>
                    <Title order={2}>Network</Title>
                    <h2>
                      In: {bytesToString(stats.network.received)}
                      <br />
                      Out: {bytesToString(stats.network.sent)}
                    </h2>
                  </div>
                </Card>
              </div>
            </TitleCard>
          </div>
          <div className="mt-4">
            <TitleCard title='Graphs' icon={<FontAwesomeIcon icon={faChartBar} />}>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <ChartBlock icon={<FontAwesomeIcon icon={faMicrochip} />} title='CPU Load'>
                  <Line {...cpu.props} />
                </ChartBlock>
                <ChartBlock icon={<FontAwesomeIcon icon={faMemory} />} title='Memory Usage'>
                  <Line {...memory.props} />
                </ChartBlock>
                <ChartBlock
                  icon={<FontAwesomeIcon icon={faDatabase} />}
                  title='Disk I/O'
                  legend={
                    <>
                      <Tooltip label='Disk Read'>
                        <FontAwesomeIcon icon={faSearch} className='mr-2 h-4 w-4 text-yellow-400' />
                      </Tooltip>
                      <Tooltip label='Disk Write'>
                        <FontAwesomeIcon icon={faPen} className='h-4 w-4 text-cyan-400' />
                      </Tooltip>
                    </>
                  }
                >
                  <Line {...disk.props} />
                </ChartBlock>
                <ChartBlock
                  icon={<FontAwesomeIcon icon={faCloudDownload} />}
                  title='Network Traffic'
                  legend={
                    <>
                      <Tooltip label='Inbound'>
                        <FontAwesomeIcon icon={faCloudArrowDown} className='mr-2 h-4 w-4 text-yellow-400' />
                      </Tooltip>
                      <Tooltip label='Outbound'>
                        <FontAwesomeIcon icon={faCloudArrowUp} className='h-4 w-4 text-cyan-400' />
                      </Tooltip>
                    </>
                  }
                >
                  <Line {...network.props} />
                </ChartBlock>
              </div>
            </TitleCard>
          </div>
        </>
      )}
    </AdminSubContentContainer>
  );
}
