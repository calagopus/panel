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
import { Fragment, startTransition, useEffect, useState } from 'react';
import getBackupStats, { type BackupStats } from '@/api/admin/stats/getBackupStats.ts';
import getGeneralStats, { type GeneralStats } from '@/api/admin/stats/getGeneralStats.ts';
import getOverview, { AdminSystemOverview } from '@/api/admin/system/getOverview.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Text from '@/elements/Text.tsx';
import Title from '@/elements/Title.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { bytesToString } from '@/lib/size.ts';
import { parseVersion } from '@/lib/version.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function AdminOverview() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const updateInformation = useAdminStore((state) => state.updateInformation);
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
  }, [canReadStats]);

  const containerTypeLabel = (type: AdminSystemOverview['containerType']) => {
    switch (type) {
      case 'unknown':
        return t('common.unknown', {});
      case 'none':
        return t('pages.admin.home.tabs.overview.page.containerType.none', {});
      case 'official':
        return t('pages.admin.home.tabs.overview.page.containerType.official', {});
      case 'official-aio':
        return t('pages.admin.home.tabs.overview.page.containerType.officialAio', {});
      default:
        return t('pages.admin.home.tabs.overview.page.containerType.officialHeavy', {});
    }
  };

  return (
    <>
      {updateInformation &&
        parseVersion(updateInformation.latestPanelVersion).isNewerThan(updateInformation.panelVersion) && (
          <Alert className='mb-4' color='yellow'>
            {t('pages.admin.home.alert.newPanelVersion', {
              current: updateInformation.panelVersion,
              latest: updateInformation.latestPanelVersion,
              upgradeUrl: 'https://calagopus.com/docs/panel/updating',
            }).md()}
          </Alert>
        )}

      {window.extensionContext.extensionRegistry.pages.admin.home.overview.cards.prependedComponents.map(
        (Component, index) => (
          <Component key={`overview-prepended-${index}`} />
        ),
      )}

      <AdminCan
        action='stats.read'
        renderOnCant={
          <Text>
            {t('pages.admin.home.tabs.overview.page.permissionDenied', {})} <FontAwesomeIcon icon={faArrowRightLong} />{' '}
            <FontAwesomeIcon icon={faCrow} />
          </Text>
        }
      >
        <TitleCard
          title={t('pages.admin.home.tabs.overview.page.card.systemOverview', {})}
          icon={<FontAwesomeIcon icon={faStethoscope} />}
        >
          {!systemOverview ? (
            <Spinner.Centered />
          ) : (
            <>
              <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
                <Card className='flex col-span-2'>
                  <Title order={3}>
                    <FontAwesomeIcon icon={faMicrochip} /> {systemOverview.cpu.brand}
                  </Title>
                  {t('common.stat.cpu', {})}
                </Card>
                <Card className='flex col-span-2'>
                  <Title order={3}>
                    <FontAwesomeIcon icon={faMemory} />{' '}
                    {t('pages.admin.home.tabs.overview.page.system.memoryValue', {
                      used: bytesToString(systemOverview.memory.usedBytes),
                      total: bytesToString(systemOverview.memory.totalBytes),
                      percent: ((systemOverview.memory.usedBytes / systemOverview.memory.totalBytes) * 100).toFixed(2),
                    })}
                  </Title>
                  {t('pages.admin.home.tabs.overview.page.system.memoryUsage', {
                    process: bytesToString(systemOverview.memory.usedBytesProcess),
                  })}
                </Card>
              </div>

              <div className='grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4'>
                <Card className='flex'>
                  <Title order={3}>
                    <FontAwesomeIcon icon={faServer} /> {systemOverview.kernelVersion}
                  </Title>
                  {t('pages.admin.home.tabs.overview.page.system.kernelVersion', {
                    architecture: systemOverview.architecture,
                  })}
                </Card>
                <Card className='flex'>
                  <Title order={3}>
                    <FontAwesomeIcon
                      icon={
                        systemOverview.containerType === 'unknown'
                          ? faCircleQuestion
                          : systemOverview.containerType === 'none'
                            ? faBan
                            : faCheck
                      }
                    />{' '}
                    {containerTypeLabel(systemOverview.containerType)}
                  </Title>
                  {t('pages.admin.home.tabs.overview.page.system.containerType', {})}
                </Card>
                <Card className='flex'>
                  <Title order={3}>
                    <FontAwesomeIcon icon={faDatabase} /> PostgreSQL {systemOverview.database.version}
                  </Title>
                  {t('pages.admin.home.tabs.overview.page.system.databaseVersion', {
                    size: bytesToString(systemOverview.database.sizeBytes),
                  })}
                </Card>
                <Card className='flex'>
                  <Title order={3}>
                    <FontAwesomeIcon icon={faDatabase} /> {systemOverview.cache.version}
                  </Title>
                  {t('pages.admin.home.tabs.overview.page.system.cacheVersion', {})}
                </Card>
              </div>

              <div className='grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4'>
                <Card className='flex'>
                  <Title order={3}>{systemOverview.cache.totalCalls}</Title>
                  {t('pages.admin.home.tabs.overview.page.system.cacheCalls', {})}
                </Card>
                <Card className='flex'>
                  <Title order={3}>{systemOverview.cache.totalHits}</Title>
                  {t('pages.admin.home.tabs.overview.page.system.cacheHits', {
                    percent: ((systemOverview.cache.totalHits / systemOverview.cache.totalCalls) * 100).toFixed(2),
                  })}
                </Card>
                <Card className='flex'>
                  <Title order={3}>{systemOverview.cache.totalMisses}</Title>
                  {t('pages.admin.home.tabs.overview.page.system.cacheMisses', {
                    percent: ((systemOverview.cache.totalMisses / systemOverview.cache.totalCalls) * 100).toFixed(2),
                  })}
                </Card>
                <Card className='flex'>
                  <Title order={3}>{(systemOverview.cache.averageCallLatencyNs / 1_000 / 1_000).toFixed(2)} ms</Title>
                  {t('pages.admin.home.tabs.overview.page.system.avgCachedCallLatency', {})}
                </Card>
              </div>
            </>
          )}
        </TitleCard>

        <TitleCard
          title={t('pages.admin.home.tabs.overview.page.card.generalStatistics', {})}
          icon={<FontAwesomeIcon icon={faChartBar} />}
          className='mt-4'
        >
          {!generalStats ? (
            <Spinner.Centered />
          ) : (
            <div className='grid md:grid-cols-2 xl:grid-cols-4 gap-4'>
              <Card className='flex'>
                <Title order={3}>
                  <FontAwesomeIcon icon={faUsers} /> {generalStats.users}
                </Title>
                {t('pages.admin.home.tabs.overview.page.stats.users', {})}
              </Card>
              <Card className='flex'>
                <Title order={3}>
                  <FontAwesomeIcon icon={faComputer} /> {generalStats.servers}
                </Title>
                {t('pages.admin.home.tabs.overview.page.stats.servers', {})}
              </Card>
              <Card className='flex'>
                <Title order={3}>
                  <FontAwesomeIcon icon={faEarth} /> {generalStats.locations}
                </Title>
                {t('pages.admin.home.tabs.overview.page.stats.locations', {})}
              </Card>
              <Card className='flex'>
                <Title order={3}>
                  <FontAwesomeIcon icon={faServer} /> {generalStats.nodes}
                </Title>
                {t('pages.admin.home.tabs.overview.page.stats.nodes', {})}
              </Card>
              <Card className='flex'>
                <Title order={3}>
                  <FontAwesomeIcon icon={faEgg} /> {generalStats.nestEggs}
                </Title>
                {t('pages.admin.home.tabs.overview.page.stats.nestEggs', {})}
              </Card>
              <Card className='flex'>
                <Title order={3}>
                  <FontAwesomeIcon icon={faDatabase} /> {generalStats.databaseHosts}
                </Title>
                {t('pages.admin.home.tabs.overview.page.stats.databaseHosts', {})}
              </Card>
              <Card className='flex'>
                <Title order={3}>
                  <FontAwesomeIcon icon={faArchive} /> {generalStats.backupConfigurations}
                </Title>
                {t('pages.admin.home.tabs.overview.page.stats.backupConfigurations', {})}
              </Card>
              <Card className='flex'>
                <Title order={3}>
                  <FontAwesomeIcon icon={faScroll} /> {generalStats.roles}
                </Title>
                {t('pages.admin.home.tabs.overview.page.stats.roles', {})}
              </Card>
            </div>
          )}
        </TitleCard>

        <TitleCard
          title={t('pages.admin.home.tabs.overview.page.card.backupStatistics', {})}
          icon={<FontAwesomeIcon icon={faArchive} />}
          className='mt-4'
        >
          {!backupStats ? (
            <Spinner.Centered />
          ) : (
            <div className='flex flex-col 2xl:flex-row gap-4'>
              {(['allTime', 'today', 'week', 'month'] as const).map((period) => {
                const periodLabel = t(`pages.admin.backupConfigurations.tabs.stats.page.periodLabel.${period}`, {});

                return (
                  <Fragment key={period}>
                    <TitleCard
                      title={t(`pages.admin.backupConfigurations.tabs.stats.page.period.${period}`, {})}
                      className='flex-1 min-w-0'
                    >
                      <div className='flex flex-col gap-4'>
                        <Card>
                          <Title order={3}>{backupStats[period].total}</Title>
                          {t('pages.admin.backupConfigurations.tabs.stats.page.stat.total', { period: periodLabel })}
                        </Card>
                        <Card>
                          <Title order={3}>
                            {backupStats[period].successful} ({bytesToString(backupStats[period].successfulBytes)})
                          </Title>
                          {t('pages.admin.backupConfigurations.tabs.stats.page.stat.successful', {
                            period: periodLabel,
                          })}
                        </Card>
                        <Card>
                          <Title order={3}>{backupStats[period].failed}</Title>
                          {t('pages.admin.backupConfigurations.tabs.stats.page.stat.failed', { period: periodLabel })}
                        </Card>
                        <Card>
                          <Title order={3}>
                            {backupStats[period].deleted} ({bytesToString(backupStats[period].deletedBytes)})
                          </Title>
                          {t('pages.admin.backupConfigurations.tabs.stats.page.stat.deleted', { period: periodLabel })}
                        </Card>
                      </div>
                    </TitleCard>
                  </Fragment>
                );
              })}
            </div>
          )}
        </TitleCard>
      </AdminCan>

      {window.extensionContext.extensionRegistry.pages.admin.home.overview.cards.appendedComponents.map(
        (Component, index) => (
          <Component key={`overview-appended-${index}`} />
        ),
      )}
    </>
  );
}
