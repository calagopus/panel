import {
  faArchive,
  faArrowRightLong,
  faBan,
  faChartBar,
  faCheck,
  faCircleQuestion,
  faComputer,
  faCrow,
  faDatabase,
  faEarth,
  faEgg,
  faMemory,
  faMicrochip,
  faScroll,
  faServer,
  faStethoscope,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Text, Title } from '@mantine/core';
import { startTransition, useEffect, useState } from 'react';
import getBackupStats, { type BackupStats } from '@/api/admin/stats/getBackupStats.ts';
import getGeneralStats, { type GeneralStats } from '@/api/admin/stats/getGeneralStats.ts';
import getOverview, { AdminSystemOverview } from '@/api/admin/system/getOverview.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import Spinner from '@/elements/Spinner.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { bytesToString } from '@/lib/size.ts';
import { parseVersion } from '@/lib/version.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function AdminOverview() {
  const { addToast } = useToast();
  const { updateInformation } = useAdminStore();
  const canReadStats = useAdminCan('stats.read');

  const [systemOverview, setSystemOverview] = useState<AdminSystemOverview | null>(null);
  const [generalStats, setGeneralStats] = useState<GeneralStats | null>(null);
  const [backupStats, setBackupStats] = useState<Record<'allTime' | 'today' | 'week' | 'month', BackupStats> | null>(
    null,
  );

  useEffect(() => {
    if (!canReadStats) return;

    Promise.all([getOverview(), getGeneralStats(), getBackupStats()])
      .then(([system, general, backup]) => {
        startTransition(() => {
          setSystemOverview(system);
          setGeneralStats(general);
          setBackupStats(backup);
        });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  }, []);

  return (
    <>
      {updateInformation &&
        parseVersion(updateInformation.latestPanelVersion).isNewerThan(updateInformation.panelVersion) && (
          <Alert className='mb-4' color='yellow'>
            A new version is available for the panel! You are currently on {updateInformation.panelVersion} and the
            latest version is {updateInformation.latestPanelVersion}. You may want to consider upgrading.{' '}
            <a href='https://calagopus.com/docs/panel/updating' className='underline text-blue-400' target='_blank'>
              Click here
            </a>{' '}
            to view upgrade instructions.
          </Alert>
        )}

      <AdminCan
        action='stats.read'
        renderOnCant={
          <Text>
            You do not have permission to read the statistics that would have been here otherwise. For now, enjoy this
            bird <FontAwesomeIcon icon={faArrowRightLong} /> <FontAwesomeIcon icon={faCrow} />
          </Text>
        }
      >
        <TitleCard title='System Overview' icon={<FontAwesomeIcon icon={faStethoscope} />}>
          {!systemOverview ? (
            <Spinner.Centered />
          ) : (
            <>
              <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
                <Card className='flex col-span-2'>
                  <Title order={3} c='white'>
                    <FontAwesomeIcon icon={faMicrochip} /> {systemOverview.cpu.brand}
                  </Title>
                  CPU
                </Card>
                <Card className='flex col-span-2'>
                  <Title order={3} c='white'>
                    <FontAwesomeIcon icon={faMemory} /> {bytesToString(systemOverview.memory.usedBytes)} /{' '}
                    {bytesToString(systemOverview.memory.totalBytes)} (
                    {((systemOverview.memory.usedBytes / systemOverview.memory.totalBytes) * 100).toFixed(2)}%)
                  </Title>
                  Memory Usage ({bytesToString(systemOverview.memory.usedBytesProcess)} used by Panel)
                </Card>
              </div>

              <div className='grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4'>
                <Card className='flex'>
                  <Title order={3} c='white'>
                    <FontAwesomeIcon icon={faServer} /> {systemOverview.kernelVersion}
                  </Title>
                  Kernel Version ({systemOverview.architecture})
                </Card>
                <Card className='flex'>
                  <Title order={3} c='white'>
                    <FontAwesomeIcon
                      icon={
                        systemOverview.containerType === 'unknown'
                          ? faCircleQuestion
                          : systemOverview.containerType === 'none'
                            ? faBan
                            : faCheck
                      }
                    />{' '}
                    {systemOverview.containerType === 'unknown'
                      ? 'Unknown'
                      : systemOverview.containerType === 'none'
                        ? 'None detected'
                        : systemOverview.containerType === 'official'
                          ? 'Official'
                          : systemOverview.containerType === 'official-aio'
                            ? 'Official AIO'
                            : 'Official Heavy'}
                  </Title>
                  Container Type
                </Card>
                <Card className='flex'>
                  <Title order={3} c='white'>
                    <FontAwesomeIcon icon={faDatabase} /> PostgreSQL {systemOverview.database.version}
                  </Title>
                  Database Version ({bytesToString(systemOverview.database.sizeBytes)})
                </Card>
                <Card className='flex'>
                  <Title order={3} c='white'>
                    <FontAwesomeIcon icon={faDatabase} /> {systemOverview.cache.version}
                  </Title>
                  Cache Version
                </Card>
              </div>

              <div className='grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4'>
                <Card className='flex'>
                  <Title order={3} c='white'>
                    {systemOverview.cache.totalCalls}
                  </Title>
                  Cache Calls
                </Card>
                <Card className='flex'>
                  <Title order={3} c='white'>
                    {systemOverview.cache.totalHits}
                  </Title>
                  Cache Hits ({((systemOverview.cache.totalHits / systemOverview.cache.totalCalls) * 100).toFixed(2)}%)
                </Card>
                <Card className='flex'>
                  <Title order={3} c='white'>
                    {systemOverview.cache.totalMisses}
                  </Title>
                  Cache Misses (
                  {((systemOverview.cache.totalMisses / systemOverview.cache.totalCalls) * 100).toFixed(2)}%)
                </Card>
                <Card className='flex'>
                  <Title order={3} c='white'>
                    {(systemOverview.cache.averageCallLatencyNs / 1_000 / 1_000).toFixed(2)} ms
                  </Title>
                  Avg. Cached Call Latency
                </Card>
              </div>
            </>
          )}
        </TitleCard>

        <TitleCard title='General Statistics' icon={<FontAwesomeIcon icon={faChartBar} />} className='mt-4'>
          {!generalStats ? (
            <Spinner.Centered />
          ) : (
            <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
              <Card className='flex'>
                <Title order={3} c='white'>
                  <FontAwesomeIcon icon={faUsers} /> {generalStats.users}
                </Title>
                Users
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  <FontAwesomeIcon icon={faComputer} /> {generalStats.servers}
                </Title>
                Servers
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  <FontAwesomeIcon icon={faEarth} /> {generalStats.locations}
                </Title>
                Locations
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  <FontAwesomeIcon icon={faServer} /> {generalStats.nodes}
                </Title>
                Nodes
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  <FontAwesomeIcon icon={faEgg} /> {generalStats.nestEggs}
                </Title>
                Nest Eggs
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  <FontAwesomeIcon icon={faDatabase} /> {generalStats.databaseHosts}
                </Title>
                Database Hosts
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  <FontAwesomeIcon icon={faArchive} /> {generalStats.backupConfigurations}
                </Title>
                Backup Configurations
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  <FontAwesomeIcon icon={faScroll} /> {generalStats.roles}
                </Title>
                Roles
              </Card>
            </div>
          )}
        </TitleCard>

        <TitleCard title='Backup Statistics' icon={<FontAwesomeIcon icon={faArchive} />} className='mt-4'>
          {!backupStats ? (
            <Spinner.Centered />
          ) : (
            <div className='grid grid-cols-2 xl:grid-cols-5 gap-4'>
              <Card className='col-span-2 xl:col-span-1'>
                <Title order={3} c='white'>
                  All Time
                </Title>
              </Card>

              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.allTime.total}
                </Title>
                Total backups all time
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.allTime.successful} ({bytesToString(backupStats.allTime.successfulBytes)})
                </Title>
                Successful backups all time
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.allTime.failed}
                </Title>
                Failed backups all time
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.allTime.deleted} ({bytesToString(backupStats.allTime.deletedBytes)})
                </Title>
                Deleted backups all time
              </Card>

              <Card className='col-span-2 xl:col-span-1'>
                <Title order={3} c='white'>
                  Today
                </Title>
              </Card>

              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.today.total}
                </Title>
                Total backups today
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.today.successful} ({bytesToString(backupStats.today.successfulBytes)})
                </Title>
                Successful backups today
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.today.failed}
                </Title>
                Failed backups today
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.today.deleted} ({bytesToString(backupStats.today.deletedBytes)})
                </Title>
                Deleted backups today
              </Card>

              <Card className='col-span-2 xl:col-span-1'>
                <Title order={3} c='white'>
                  This Week
                </Title>
              </Card>

              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.week.total}
                </Title>
                Total backups this week
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.week.successful} ({bytesToString(backupStats.week.successfulBytes)})
                </Title>
                Successful backups this week
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.week.failed}
                </Title>
                Failed backups this week
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.week.deleted} ({bytesToString(backupStats.week.deletedBytes)})
                </Title>
                Deleted backups this week
              </Card>

              <Card className='col-span-2 xl:col-span-1'>
                <Title order={3} c='white'>
                  This Month
                </Title>
              </Card>

              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.month.total}
                </Title>
                Total backups this month
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.month.successful} ({bytesToString(backupStats.month.successfulBytes)})
                </Title>
                Successful backups this month
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.month.failed}
                </Title>
                Failed backups this month
              </Card>
              <Card className='flex'>
                <Title order={3} c='white'>
                  {backupStats.month.deleted} ({bytesToString(backupStats.month.deletedBytes)})
                </Title>
                Deleted backups this month
              </Card>
            </div>
          )}
        </TitleCard>
      </AdminCan>
    </>
  );
}
