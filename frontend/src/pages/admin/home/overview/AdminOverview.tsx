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
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import getBackupStats from '@/api/admin/stats/getBackupStats.ts';
import getGeneralStats from '@/api/admin/stats/getGeneralStats.ts';
import getOverview, { AdminSystemOverview } from '@/api/admin/system/getOverview.ts';
import { AdminCan } from '@/elements/Can.tsx';
import StatCard from '@/elements/data-display/StatCard.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { percentString } from '@/lib/format/usage.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupStatsPanel from '../../backup-configurations/BackupStatsPanel.tsx';
import PanelUpdateAlert from '../PanelUpdateAlert.tsx';

export default function AdminOverview() {
  const { t } = useTranslations();
  const canReadStats = useAdminCan('stats.read');

  const systemOverview = useResource({
    queryKey: queryKeys.admin.system.overview(),
    queryFn: getOverview,
    enabled: canReadStats,
  });
  const generalStats = useResource({
    queryKey: queryKeys.admin.stats.general(),
    queryFn: getGeneralStats,
    enabled: canReadStats,
  });
  const backupStats = useResource({
    queryKey: queryKeys.admin.stats.backups(),
    queryFn: getBackupStats,
    enabled: canReadStats,
  });

  const containerTypeMeta = (type: AdminSystemOverview['containerType']): { label: string; icon: IconDefinition } => {
    switch (type) {
      case 'unknown':
        return { label: t('common.unknown', {}), icon: faCircleQuestion };
      case 'none':
        return { label: t('pages.admin.home.tabs.overview.page.containerType.none', {}), icon: faBan };
      case 'official':
        return { label: t('pages.admin.home.tabs.overview.page.containerType.official', {}), icon: faCheck };
      case 'official-aio':
        return { label: t('pages.admin.home.tabs.overview.page.containerType.officialAio', {}), icon: faCheck };
      default:
        return { label: t('pages.admin.home.tabs.overview.page.containerType.officialHeavy', {}), icon: faCheck };
    }
  };

  return (
    <>
      <PanelUpdateAlert />

      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.admin.home.overview.cards.prependedComponents}
        name='overview-prepended'
      />

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
          <ResourceView resource={systemOverview}>
            {(overview) => {
              const container = containerTypeMeta(overview.containerType);

              return (
                <>
                  <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
                    <StatCard
                      className='col-span-2'
                      icon={faMicrochip}
                      value={overview.cpu.brand}
                      label={t('common.stat.cpu', {})}
                    />
                    <StatCard
                      className='col-span-2'
                      icon={faMemory}
                      value={t('pages.admin.home.tabs.overview.page.system.memoryValue', {
                        used: bytesToString(overview.memory.usedBytes),
                        total: bytesToString(overview.memory.totalBytes),
                        percent: percentString(overview.memory.usedBytes, overview.memory.totalBytes),
                      })}
                      label={t('pages.admin.home.tabs.overview.page.system.memoryUsage', {
                        process: bytesToString(overview.memory.usedBytesProcess),
                      })}
                    />
                  </div>

                  <div className='grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4'>
                    <StatCard
                      icon={faServer}
                      value={overview.kernelVersion}
                      label={t('pages.admin.home.tabs.overview.page.system.kernelVersion', {
                        architecture: overview.architecture,
                      })}
                    />
                    <StatCard
                      icon={container.icon}
                      value={container.label}
                      label={t('pages.admin.home.tabs.overview.page.system.containerType', {})}
                    />
                    <StatCard
                      icon={faDatabase}
                      value={`PostgreSQL ${overview.database.version}`}
                      label={t('pages.admin.home.tabs.overview.page.system.databaseVersion', {
                        size: bytesToString(overview.database.sizeBytes),
                      })}
                    />
                    <StatCard
                      icon={faDatabase}
                      value={overview.cache.version}
                      label={t('pages.admin.home.tabs.overview.page.system.cacheVersion', {})}
                    />
                  </div>

                  <div className='grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4'>
                    <StatCard
                      value={overview.cache.totalCalls.toString()}
                      label={t('pages.admin.home.tabs.overview.page.system.cacheCalls', {})}
                    />
                    <StatCard
                      value={overview.cache.totalHits.toString()}
                      label={t('pages.admin.home.tabs.overview.page.system.cacheHits', {
                        percent: percentString(overview.cache.totalHits, overview.cache.totalCalls),
                      })}
                    />
                    <StatCard
                      value={overview.cache.totalMisses.toString()}
                      label={t('pages.admin.home.tabs.overview.page.system.cacheMisses', {
                        percent: percentString(overview.cache.totalMisses, overview.cache.totalCalls),
                      })}
                    />
                    <StatCard
                      value={`${(overview.cache.averageCallLatencyNs / 1_000 / 1_000).toFixed(2)} ms`}
                      label={t('pages.admin.home.tabs.overview.page.system.avgCachedCallLatency', {})}
                    />
                  </div>
                </>
              );
            }}
          </ResourceView>
        </TitleCard>

        <TitleCard
          title={t('pages.admin.home.tabs.overview.page.card.generalStatistics', {})}
          icon={<FontAwesomeIcon icon={faChartBar} />}
          className='mt-4'
        >
          <ResourceView resource={generalStats}>
            {(stats) => {
              const items: { icon: IconDefinition; value: number; label: string }[] = [
                { icon: faUsers, value: stats.users, label: t('pages.admin.home.tabs.overview.page.stats.users', {}) },
                {
                  icon: faComputer,
                  value: stats.servers,
                  label: t('pages.admin.home.tabs.overview.page.stats.servers', {}),
                },
                {
                  icon: faEarth,
                  value: stats.locations,
                  label: t('pages.admin.home.tabs.overview.page.stats.locations', {}),
                },
                { icon: faServer, value: stats.nodes, label: t('pages.admin.home.tabs.overview.page.stats.nodes', {}) },
                {
                  icon: faEgg,
                  value: stats.nestEggs,
                  label: t('pages.admin.home.tabs.overview.page.stats.nestEggs', {}),
                },
                {
                  icon: faDatabase,
                  value: stats.databaseHosts,
                  label: t('pages.admin.home.tabs.overview.page.stats.databaseHosts', {}),
                },
                {
                  icon: faArchive,
                  value: stats.backupConfigurations,
                  label: t('pages.admin.home.tabs.overview.page.stats.backupConfigurations', {}),
                },
                { icon: faScroll, value: stats.roles, label: t('pages.admin.home.tabs.overview.page.stats.roles', {}) },
              ];

              return (
                <div className='grid md:grid-cols-2 xl:grid-cols-4 gap-4'>
                  {items.map((item) => (
                    <StatCard key={item.label} icon={item.icon} value={item.value.toString()} label={item.label} />
                  ))}
                </div>
              );
            }}
          </ResourceView>
        </TitleCard>

        <TitleCard
          title={t('pages.admin.home.tabs.overview.page.card.backupStatistics', {})}
          icon={<FontAwesomeIcon icon={faArchive} />}
          className='mt-4'
        >
          <ResourceView resource={backupStats}>{(stats) => <BackupStatsPanel stats={stats} />}</ResourceView>
        </TitleCard>
      </AdminCan>

      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.admin.home.overview.cards.appendedComponents}
        name='overview-appended'
      />
    </>
  );
}
