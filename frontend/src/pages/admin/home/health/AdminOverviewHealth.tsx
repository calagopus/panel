import {
  faBug,
  faCheck,
  faExclamationTriangle,
  faInfoCircle,
  faPuzzlePiece,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import getDebugMode from '@/api/admin/system/debug/getDebugMode.ts';
import setDebugMode from '@/api/admin/system/debug/setDebugMode.ts';
import getGeneralHealth from '@/api/admin/system/health/getGeneralHealth.ts';
import getNodesHealth from '@/api/admin/system/health/getNodesHealth.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Card from '@/elements/Card.tsx';
import Code from '@/elements/Code.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import Title from '@/elements/Title.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';

export default function AdminOverviewHealth() {
  const { addToast } = useToast();
  const { t, tReact } = useTranslations();

  const [general, setGeneral] = useState<Awaited<ReturnType<typeof getGeneralHealth>> | null>(null);
  const [debugMode, setDebugModeState] = useState<Awaited<ReturnType<typeof getDebugMode>> | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const canReadSettings = useAdminCan('settings.read');

  const {
    data: nodes,
    loading,
    error,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.health.nodes(),
    fetcher: (page) => getNodesHealth(page),
    paginationKey: 'desyncNodes',
  });

  useEffect(() => {
    getGeneralHealth()
      .then(setGeneral)
      .catch((err) => {
        addToast(httpErrorToHuman(err), 'error');
      });

    if (canReadSettings) {
      getDebugMode()
        .then(setDebugModeState)
        .catch((err) => {
          addToast(httpErrorToHuman(err), 'error');
        });
    }
  }, []);

  const handleToggleDebug = (enabled: boolean) => {
    setDebugLoading(true);
    setDebugMode(enabled)
      .then(() => {
        setDebugModeState((prev) => prev && { ...prev, enabled });
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

  const avgNtpOffset =
    general && general.ntpOffsets
      ? Object.values(general.ntpOffsets)
          .filter((o) => o.offsetMicros !== 0)
          .reduce((acc, o) => acc + Math.abs(o.offsetMicros), 0) /
        Object.values(general.ntpOffsets).length /
        1000
      : 0;

  return (
    <>
      <div className='2xl:columns-2 gap-4 space-y-4'>
        <TitleCard
          title={t('pages.admin.home.tabs.health.page.card.generalHealth', {})}
          icon={<FontAwesomeIcon icon={faInfoCircle} />}
        >
          {!general ? (
            <Spinner.Centered />
          ) : (
            <>
              <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
                <Card className='flex col-span-2'>
                  <Title order={3}>
                    {t('pages.admin.home.tabs.health.page.migrationsValue', {
                      applied: general.migrations.applied,
                      total: general.migrations.total,
                    })}
                  </Title>
                  {t('pages.admin.home.tabs.health.page.appliedMigrations', {
                    percent: ((general.migrations.applied / general.migrations.total) * 100).toFixed(2),
                  })}
                </Card>
                <Card className='flex col-span-2'>
                  <Title order={3} c={avgNtpOffset > 100 ? 'yellow' : 'white'}>
                    {avgNtpOffset.toFixed(2)} ms
                  </Title>
                  {t('pages.admin.home.tabs.health.page.avgNtpOffset', {})}
                </Card>
              </div>
            </>
          )}
        </TitleCard>
        <TitleCard
          title={t('pages.admin.home.tabs.health.page.card.extensionMigrationHealth', {})}
          icon={<FontAwesomeIcon icon={faPuzzlePiece} />}
        >
          {!general ? (
            <Spinner.Centered />
          ) : !Object.keys(general.migrations.extensions).length ? (
            <>{t('pages.admin.home.tabs.health.page.noExtensions', {})}</>
          ) : (
            <>
              {Object.keys(general.migrations.extensions).length > 0 && (
                <Table
                  columns={[
                    t('pages.admin.home.tabs.health.page.table.packageName', {}),
                    t('pages.admin.home.tabs.health.page.table.applied', {}),
                    t('pages.admin.home.tabs.health.page.table.total', {}),
                  ]}
                  loading={loading}
                >
                  {Object.entries(general.migrations.extensions).map(([identifier, migrations]) => (
                    <TableRow key={identifier}>
                      <TableData>
                        <Code>{identifier}</Code>
                      </TableData>
                      <TableData>
                        {t('pages.admin.home.tabs.health.page.table.appliedValue', {
                          applied: migrations.applied,
                          percent: (migrations.total === 0
                            ? 100
                            : (migrations.applied / migrations.total) * 100
                          ).toFixed(2),
                        })}
                      </TableData>
                      <TableData>{migrations.total}</TableData>
                    </TableRow>
                  ))}
                </Table>
              )}
            </>
          )}
        </TitleCard>
        <AdminCan action='settings.read'>
          <TitleCard
            title={t('pages.admin.home.tabs.health.page.card.debugMode', {})}
            icon={<FontAwesomeIcon icon={faBug} />}
          >
            {!debugMode ? (
              <Spinner.Centered />
            ) : (
              <div className='flex flex-row justify-between'>
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
          </TitleCard>
        </AdminCan>
        <TitleCard
          title={t('pages.admin.home.tabs.health.page.card.desyncNodes', {})}
          icon={<FontAwesomeIcon icon={faServer} />}
        >
          {loading || !nodes?.desyncNodes ? (
            <Spinner.Centered />
          ) : !nodes?.desyncNodes.total ? (
            <>
              <FontAwesomeIcon icon={faCheck} />{' '}
              {t('pages.admin.home.tabs.health.page.nodesSynced', { failed: nodes?.failedNodes ?? 0 })}
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faExclamationTriangle} />{' '}
              {t('pages.admin.home.tabs.health.page.nodesDesync', {
                desync: nodes?.desyncNodes.total ?? 0,
                failed: nodes?.failedNodes ?? 0,
              })}
              <div className='mt-4' />
              <Table
                columns={[
                  '',
                  t('pages.admin.home.tabs.health.page.table.id', {}),
                  t('pages.admin.home.tabs.health.page.table.desync', {}),
                  ...nodeTableColumns().slice(2),
                ]}
                loading={loading}
                error={error}
                pagination={nodes.desyncNodes}
                onPageSelect={setPage}
              >
                {nodes.desyncNodes.data.map((node) => (
                  <NodeRow
                    key={node.node.uuid}
                    node={node.node}
                    desync={Math.abs(new Date(node.localTime).getTime() - new Date(node.panelLocalTime).getTime())}
                  />
                ))}
              </Table>
            </>
          )}
        </TitleCard>
      </div>
    </>
  );
}
