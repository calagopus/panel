import {
  faBug,
  faCheck,
  faExclamationTriangle,
  faInfoCircle,
  faPuzzlePiece,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMemo, useState } from 'react';
import getDebugMode from '@/api/admin/system/debug/getDebugMode.ts';
import setDebugMode from '@/api/admin/system/debug/setDebugMode.ts';
import getGeneralHealth from '@/api/admin/system/health/getGeneralHealth.ts';
import getNodesHealth from '@/api/admin/system/health/getNodesHealth.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import StatCard from '@/elements/data-display/StatCard.tsx';
import Table, { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import Code from '@/elements/typography/Code.tsx';
import { percentString } from '@/lib/format/usage.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { desyncNodeTableColumns } from '@/lib/tableColumns.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';
import OutdatedResourceCard from '../updates/OutdatedResourceCard.tsx';

export default function AdminOverviewHealth() {
  const { addToast } = useToast();
  const { t, tReact } = useTranslations();

  const canReadSettings = useAdminCan('settings.read');
  const canReadNodes = useAdminCan('nodes.read');

  const [debugLoading, setDebugLoading] = useState(false);

  const generalHealth = useResource({
    queryKey: queryKeys.admin.health.general(),
    queryFn: getGeneralHealth,
  });
  const debug = useResource({
    queryKey: queryKeys.admin.system.debug(),
    queryFn: getDebugMode,
    enabled: canReadSettings,
  });

  const {
    data: nodes,
    loading,
    error,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.health.nodes(),
    fetcher: (page) => getNodesHealth(page),
    paginationKey: 'desyncNodes',
    canRequest: canReadNodes,
  });

  const avgNtpOffsetMs = useMemo(() => {
    const offsets = Object.values(generalHealth.data?.ntpOffsets ?? {})
      .map((entry) => Math.abs(entry.offsetMicros))
      .filter((micros) => micros !== 0);

    if (!offsets.length) return 0;

    return offsets.reduce((acc, micros) => acc + micros, 0) / offsets.length / 1000;
  }, [generalHealth.data]);

  const handleToggleDebug = (enabled: boolean) => {
    setDebugLoading(true);
    setDebugMode(enabled)
      .then(() => {
        debug.refetch();
        addToast(
          enabled
            ? t('pages.admin.home.tabs.health.page.toast.debugEnabled', {})
            : t('pages.admin.home.tabs.health.page.toast.debugDisabled', {}),
          'success',
        );
      })
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setDebugLoading(false));
  };

  return (
    <div className='2xl:columns-2 gap-4 space-y-4'>
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.admin.home.health.cards.prependedComponents}
        name='health-prepended'
      />

      <TitleCard
        title={t('pages.admin.home.tabs.health.page.card.generalHealth', {})}
        icon={<FontAwesomeIcon icon={faInfoCircle} />}
      >
        <ResourceView resource={generalHealth}>
          {(general) => (
            <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
              <StatCard
                className='col-span-2'
                value={t('pages.admin.home.tabs.health.page.migrationsValue', {
                  applied: general.migrations.applied,
                  total: general.migrations.total,
                })}
                label={t('pages.admin.home.tabs.health.page.appliedMigrations', {
                  percent: percentString(general.migrations.applied, general.migrations.total, { whenEmpty: 100 }),
                })}
              />
              <StatCard
                className='col-span-2'
                valueColor={avgNtpOffsetMs > 100 ? 'yellow' : undefined}
                value={`${avgNtpOffsetMs.toFixed(2)} ms`}
                label={t('pages.admin.home.tabs.health.page.avgNtpOffset', {})}
              />
            </div>
          )}
        </ResourceView>
      </TitleCard>

      <TitleCard
        title={t('pages.admin.home.tabs.health.page.card.extensionMigrationHealth', {})}
        icon={<FontAwesomeIcon icon={faPuzzlePiece} />}
      >
        <ResourceView resource={generalHealth}>
          {(general) =>
            Object.keys(general.migrations.extensions).length === 0 ? (
              t('pages.admin.home.tabs.health.page.noExtensions', {})
            ) : (
              <Table
                columns={[
                  t('pages.admin.home.tabs.health.page.table.packageName', {}),
                  t('pages.admin.home.tabs.health.page.table.applied', {}),
                  t('pages.admin.home.tabs.health.page.table.total', {}),
                ]}
              >
                {Object.entries(general.migrations.extensions).map(([identifier, migrations]) => (
                  <TableRow key={identifier}>
                    <TableData>
                      <Code>{identifier}</Code>
                    </TableData>
                    <TableData>
                      {t('pages.admin.home.tabs.health.page.table.appliedValue', {
                        applied: migrations.applied,
                        percent: percentString(migrations.applied, migrations.total, { whenEmpty: 100 }),
                      })}
                    </TableData>
                    <TableData>{migrations.total}</TableData>
                  </TableRow>
                ))}
              </Table>
            )
          }
        </ResourceView>
      </TitleCard>

      <AdminCan action='settings.read'>
        <TitleCard
          title={t('pages.admin.home.tabs.health.page.card.debugMode', {})}
          icon={<FontAwesomeIcon icon={faBug} />}
        >
          <ResourceView resource={debug}>
            {(debugMode) => (
              <div className='flex flex-col md:flex-row gap-2 justify-between'>
                <span>
                  <FontAwesomeIcon icon={debugMode.enabled ? faExclamationTriangle : faCheck} />{' '}
                  {debugMode.enabled
                    ? t('pages.admin.home.tabs.health.page.debugEnabled', {})
                    : t('pages.admin.home.tabs.health.page.debugDisabled', {})}
                  <br />
                  <span className='text-sm text-gray-400'>
                    {tReact('pages.admin.home.tabs.health.page.debugResetNote', {
                      default: (
                        <Badge color={debugMode.default ? 'green' : 'red'} size='xs'>
                          {debugMode.default ? t('common.badge.enabled', {}) : t('common.badge.disabled', {})}
                        </Badge>
                      ),
                    })}
                  </span>
                </span>
                <AdminCan action='settings.update'>
                  {debugMode.enabled ? (
                    <Button
                      color='red'
                      loading={debugLoading}
                      onClick={() => handleToggleDebug(false)}
                      className='min-w-fit'
                    >
                      {t('pages.admin.home.tabs.health.page.button.disableDebug', {})}
                    </Button>
                  ) : (
                    <Button loading={debugLoading} onClick={() => handleToggleDebug(true)} className='min-w-fit'>
                      {t('pages.admin.home.tabs.health.page.button.enableDebug', {})}
                    </Button>
                  )}
                </AdminCan>
              </div>
            )}
          </ResourceView>
        </TitleCard>
      </AdminCan>

      <AdminCan action='nodes.read'>
        <OutdatedResourceCard
          title={t('pages.admin.home.tabs.health.page.card.desyncNodes', {})}
          icon={<FontAwesomeIcon icon={faServer} />}
          table={{
            loading,
            error,
            data: nodes?.desyncNodes,
            columns: desyncNodeTableColumns(),
            onPageSelect: setPage,
          }}
          status={{
            upToDate: t('pages.admin.home.tabs.health.page.nodesSynced', { failed: nodes?.failedNodes ?? 0 }),
            outdated: t('pages.admin.home.tabs.health.page.nodesDesync', {
              desync: nodes?.desyncNodes.total ?? 0,
              failed: nodes?.failedNodes ?? 0,
            }),
          }}
        >
          {nodes?.desyncNodes?.data.map((node) => (
            <NodeRow
              key={node.node.uuid}
              node={node.node}
              desync={Math.abs(new Date(node.localTime).getTime() - new Date(node.panelLocalTime).getTime())}
            />
          ))}
        </OutdatedResourceCard>
      </AdminCan>

      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.admin.home.health.cards.appendedComponents}
        name='health-appended'
      />
    </div>
  );
}
