import { faArchive } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getBackupConfigurationStats, {
  type BackupStats,
} from '@/api/admin/backup-configurations/getBackupConfigurationStats.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Card from '@/elements/Card.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { bytesToString } from '@/lib/size.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function AdminBackupConfigurationStats({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { addToast } = useToast();

  const [stats, setStats] = useState<Record<'allTime' | 'today' | 'week' | 'month', BackupStats> | null>(null);

  useEffect(() => {
    getBackupConfigurationStats(backupConfiguration.uuid)
      .then((data) => {
        setStats(data);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  }, []);

  return (
    <AdminSubContentContainer title={`Backup Config Stats`} titleOrder={2}>
      {!stats ? (
        <Spinner.Centered />
      ) : (
        <TitleCard title={`Backup Statistics`} icon={<FontAwesomeIcon icon={faArchive} />} className='mt-4'>
          <div className='grid grid-cols-2 xl:grid-cols-5 gap-4'>
            <Card className='col-span-2 xl:col-span-1'>
              <Title order={3}>All Time</Title>
            </Card>
            <Card className='flex'>
              <Title order={3}>{stats.allTime.total}</Title>
              Total backups all time
            </Card>
            <Card className='flex'>
              <Title order={3}>
                {stats.allTime.successful} ({bytesToString(stats.allTime.successfulBytes)})
              </Title>
              Successful backups all time
            </Card>
            <Card className='flex'>
              <Title order={3}>{stats.allTime.failed}</Title>
              Failed backups all time
            </Card>
            <Card className='flex'>
              <Title order={3}>
                {stats.allTime.deleted} ({bytesToString(stats.allTime.deletedBytes)})
              </Title>
              Deleted backups all time
            </Card>
            <Card className='col-span-2 xl:col-span-1'>
              <Title order={3}>Today</Title>
            </Card>
            <Card className='flex'>
              <Title order={3}>{stats.today.total}</Title>
              Total backups today
            </Card>
            <Card className='flex'>
              <Title order={3}>
                {stats.today.successful} ({bytesToString(stats.today.successfulBytes)})
              </Title>
              Successful backups today
            </Card>
            <Card className='flex'>
              <Title order={3}>{stats.today.failed}</Title>
              Failed backups today
            </Card>
            <Card className='flex'>
              <Title order={3}>
                {stats.today.deleted} ({bytesToString(stats.today.deletedBytes)})
              </Title>
              Deleted backups today
            </Card>
            <Card className='col-span-2 xl:col-span-1'>
              <Title order={3}>This Week</Title>
            </Card>
            <Card className='flex'>
              <Title order={3}>{stats.week.total}</Title>
              Total backups this week
            </Card>
            <Card className='flex'>
              <Title order={3}>
                {stats.week.successful} ({bytesToString(stats.week.successfulBytes)})
              </Title>
              Successful backups this week
            </Card>
            <Card className='flex'>
              <Title order={3}>{stats.week.failed}</Title>
              Failed backups this week
            </Card>
            <Card className='flex'>
              <Title order={3}>
                {stats.week.deleted} ({bytesToString(stats.week.deletedBytes)})
              </Title>
              Deleted backups this week
            </Card>
            <Card className='col-span-2 xl:col-span-1'>
              <Title order={3}>This Month</Title>
            </Card>
            <Card className='flex'>
              <Title order={3}>{stats.month.total}</Title>
              Total backups this month
            </Card>
            <Card className='flex'>
              <Title order={3}>
                {stats.month.successful} ({bytesToString(stats.month.successfulBytes)})
              </Title>
              Successful backups this month
            </Card>
            <Card className='flex'>
              <Title order={3}>{stats.month.failed}</Title>
              Failed backups this month
            </Card>
            <Card className='flex'>
              <Title order={3}>
                {stats.month.deleted} ({bytesToString(stats.month.deletedBytes)})
              </Title>
              Deleted backups this month
            </Card>
          </div>
        </TitleCard>
      )}
    </AdminSubContentContainer>
  );
}
