import {
  faClockRotateLeft,
  faExclamationTriangle,
  faInfoCircle,
  faPuzzlePiece,
  faRefresh,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import getDatabaseAgentHostUpdates from '@/api/admin/system/updates/getDatabaseAgentHostUpdates.ts';
import getNodeUpdates from '@/api/admin/system/updates/getNodeUpdates.ts';
import getUpdateHistory from '@/api/admin/system/updates/getUpdateHistory.ts';
import recheckUpdates from '@/api/admin/system/updates/recheckUpdates.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Table, { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import StatusLine from '@/elements/feedback/StatusLine.tsx';
import Select from '@/elements/input/Select.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminExtensionUpdateCheckResultErrorSchema,
  adminExtensionUpdateCheckResultUpdateAvailableSchema,
} from '@/lib/schemas/admin/system.ts';
import { databaseAgentHostTableColumns, nodeTableColumns } from '@/lib/tableColumns.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import PanelUpdateAlert, { usePanelUpdateAvailable } from '../PanelUpdateAlert.tsx';
import OutdatedDatabaseAgentHostRow from './OutdatedDatabaseAgentHostRow.tsx';
import OutdatedNodeRow from './OutdatedNodeRow.tsx';
import OutdatedResourceCard from './OutdatedResourceCard.tsx';

type ExtensionUpdateEntry = [string, z.infer<typeof adminExtensionUpdateCheckResultUpdateAvailableSchema>];
type ExtensionErrorEntry = [string, z.infer<typeof adminExtensionUpdateCheckResultErrorSchema>];

export default function AdminOverviewUpdates() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const updateInformation = useAdminStore((state) => state.updateInformation);
  const setUpdateInformation = useAdminStore((state) => state.setUpdateInformation);
  const updateInformationError = useAdminStore((state) => state.updateInformationError);
  const loadUpdateInformation = useAdminStore((state) => state.loadUpdateInformation);
  const panelUpdateAvailable = usePanelUpdateAvailable();
  const canReadNodes = useAdminCan('nodes.read');
  const canReadDatabaseAgentHosts = useAdminCan('database-agent-hosts.read');

  const [selectedUpdateHistory, setSelectedUpdateHistory] = useState<string | null>(null);
  const [recheckLoading, setRecheckLoading] = useState(false);

  const updateHistory = useResource({
    queryKey: queryKeys.admin.updates.history(),
    queryFn: () => getUpdateHistory().then((history) => history ?? { panel: [], extensions: {} }),
  });

  const {
    data: nodes,
    loading,
    error,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.updates.nodes(),
    fetcher: (page) => getNodeUpdates(page),
    paginationKey: 'outdatedNodes',
    canRequest: canReadNodes,
  });

  const {
    data: databaseAgentHosts,
    loading: databaseAgentHostsLoading,
    error: databaseAgentHostsError,
    setPage: setDatabaseAgentHostsPage,
    refetch: refetchDatabaseAgentHosts,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.updates.databaseAgentHosts(),
    fetcher: (page) => getDatabaseAgentHostUpdates(page),
    paginationKey: 'outdatedDatabaseAgentHosts',
    canRequest: canReadDatabaseAgentHosts,
  });

  const { extensionUpdates, extensionUpdateErrors } = useMemo(() => {
    const entries = Object.entries(updateInformation?.extensions ?? {});

    return {
      extensionUpdates: entries.filter((entry): entry is ExtensionUpdateEntry => entry[1].type === 'update_available'),
      extensionUpdateErrors: entries.filter((entry): entry is ExtensionErrorEntry => entry[1].type === 'error'),
    };
  }, [updateInformation]);

  const doRecheck = () => {
    setRecheckLoading(true);

    recheckUpdates()
      .then((information) => {
        setUpdateInformation(information);
        refetch();
        refetchDatabaseAgentHosts();
        updateHistory.refetch();
        addToast(t('pages.admin.home.tabs.updates.page.toast.recheckComplete', {}), 'success');
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setRecheckLoading(false));
  };

  const unknownLabel = t('common.unknown', {});

  return (
    <>
      <PanelUpdateAlert />

      <div className='2xl:columns-2 gap-4 space-y-4'>
        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.admin.home.updates.cards.prependedComponents}
          name='updates-prepended'
        />

        <TitleCard title={t('pages.admin.home.tabs.updates.page.card.panelVersion', {})} icon={faInfoCircle}>
          <div className='flex flex-col md:flex-row gap-2 justify-between'>
            <StatusLine status={panelUpdateAvailable ? 'warning' : 'ok'}>
              {t('pages.admin.home.tabs.updates.page.panelVersion', {
                current: updateInformation?.panelVersion || unknownLabel,
                latest: updateInformation?.latestPanelVersion || unknownLabel,
              }).md()}
            </StatusLine>

            <Button
              leftSection={<FontAwesomeIcon icon={faRefresh} />}
              onClick={doRecheck}
              loading={recheckLoading}
              className='min-w-fit'
            >
              {t('pages.admin.home.tabs.updates.page.button.recheck', {})}
            </Button>
          </div>
        </TitleCard>

        <TitleCard
          title={t('pages.admin.home.tabs.updates.page.card.versionHistory', {})}
          icon={faClockRotateLeft}
          rightSection={
            <Select
              placeholder={t('pages.admin.home.tabs.updates.page.selectHistory', {})}
              value={selectedUpdateHistory || ''}
              onChange={(value) => setSelectedUpdateHistory(value || null)}
              data={[
                { label: t('pages.admin.home.tabs.updates.page.historyPanel', {}), value: '' },
                ...Object.keys(updateHistory.data?.extensions ?? {}).map((ext) => ({
                  label: t('pages.admin.home.tabs.updates.page.historyExtension', { name: ext }),
                  value: ext,
                })),
              ]}
              className='ml-auto'
              size='xs'
            />
          }
          wrapperClassName='max-h-72 overflow-y-auto'
        >
          <ResourceView resource={updateHistory}>
            {(history) => (
              <Table
                columns={[
                  t('common.table.columns.version', {}),
                  t('pages.admin.home.tabs.updates.page.table.installed', {}),
                ]}
              >
                {(selectedUpdateHistory ? history.extensions[selectedUpdateHistory] || [] : history.panel).map(
                  (entry) => (
                    <TableRow key={entry.version}>
                      <TableData>
                        <Code>{entry.version}</Code>
                      </TableData>
                      <TableData>
                        <FormattedTimestamp timestamp={entry.timestamp} />
                      </TableData>
                    </TableRow>
                  ),
                )}
              </Table>
            )}
          </ResourceView>
        </TitleCard>

        <TitleCard title={t('pages.admin.home.tabs.updates.page.card.outdatedExtensions', {})} icon={faPuzzlePiece}>
          {!updateInformation ? (
            updateInformationError ? (
              <ErrorState error={updateInformationError} onRetry={loadUpdateInformation} />
            ) : (
              <Spinner.Centered />
            )
          ) : !extensionUpdates.length && !extensionUpdateErrors.length ? (
            <StatusLine status='ok'>{t('pages.admin.home.tabs.updates.page.extensionsUpToDate', {})}</StatusLine>
          ) : (
            <>
              <StatusLine status='warning'>{t('pages.admin.home.tabs.updates.page.extensionsOutdated', {})}</StatusLine>
              {extensionUpdates.length > 0 && (
                <>
                  <div className='mt-4' />
                  <Table
                    columns={[
                      t('pages.admin.home.tabs.updates.page.table.packageName', {}),
                      t('common.table.columns.version', {}),
                      t('pages.admin.home.tabs.updates.page.table.latestVersion', {}),
                      t('pages.admin.home.tabs.updates.page.table.changes', {}),
                    ]}
                  >
                    {extensionUpdates.map(([identifier, update]) => (
                      <TableRow key={identifier}>
                        <TableData>
                          <Code>{identifier}</Code>
                        </TableData>
                        <TableData>
                          <Code>{update.version}</Code>
                        </TableData>
                        <TableData>
                          <Code>{update.latestVersion}</Code>
                        </TableData>
                        <TableData>
                          <ul className='list-disc list-inside'>
                            {update.changes.map((change, index) => (
                              <li key={index}>{change}</li>
                            ))}
                          </ul>
                          {!update.changes.length && (
                            <span className='text-(--mantine-color-dimmed)'>
                              {t('pages.admin.home.tabs.updates.page.noChangelog', {})}
                            </span>
                          )}
                        </TableData>
                      </TableRow>
                    ))}
                  </Table>
                </>
              )}
              {extensionUpdateErrors.length > 0 && (
                <>
                  <Alert className='my-4' color='red' icon={faExclamationTriangle}>
                    {t('pages.admin.home.tabs.updates.page.alert.extensionUpdateErrors', {})}
                  </Alert>

                  <Table
                    columns={[
                      t('pages.admin.home.tabs.updates.page.table.packageName', {}),
                      t('pages.admin.home.tabs.updates.page.table.error', {}),
                    ]}
                  >
                    {extensionUpdateErrors.map(([identifier, update]) => (
                      <TableRow key={identifier}>
                        <TableData>
                          <Code>{identifier}</Code>
                        </TableData>
                        <TableData>
                          <Code>{update.error}</Code>
                        </TableData>
                      </TableRow>
                    ))}
                  </Table>
                </>
              )}
            </>
          )}
        </TitleCard>

        <AdminCan action='nodes.read'>
          <OutdatedResourceCard
            title={t('pages.admin.home.tabs.updates.page.card.outdatedNodes', {})}
            icon={faServer}
            table={{
              loading,
              error,
              data: nodes?.outdatedNodes,
              columns: [...nodeTableColumns(), ''],
              onPageSelect: setPage,
              onRetry: refetch,
            }}
            status={{
              upToDate: t('pages.admin.home.tabs.updates.page.nodesUpToDate', { failed: nodes?.failedNodes ?? 0 }),
              outdated: t('pages.admin.home.tabs.updates.page.nodesOutdatedSummary', {
                outdated: nodes?.outdatedNodes.total ?? 0,
                failed: nodes?.failedNodes ?? 0,
              }),
            }}
          >
            {nodes?.outdatedNodes?.data.map((outdatedNode) => (
              <OutdatedNodeRow key={outdatedNode.node.uuid} outdatedNode={outdatedNode} />
            ))}
          </OutdatedResourceCard>
        </AdminCan>
        <AdminCan action='database-agent-hosts.read'>
          <OutdatedResourceCard
            title={t('pages.admin.home.tabs.updates.page.card.outdatedDatabaseAgentHosts', {})}
            icon={faServer}
            table={{
              loading: databaseAgentHostsLoading,
              error: databaseAgentHostsError,
              data: databaseAgentHosts?.outdatedDatabaseAgentHosts,
              columns: [...databaseAgentHostTableColumns(), ''],
              onPageSelect: setDatabaseAgentHostsPage,
              onRetry: refetchDatabaseAgentHosts,
            }}
            status={{
              upToDate: t('pages.admin.home.tabs.updates.page.databaseAgentHostsUpToDate', {
                failed: databaseAgentHosts?.failedDatabaseAgentHosts ?? 0,
              }),
              outdated: t('pages.admin.home.tabs.updates.page.databaseAgentHostsOutdatedSummary', {
                outdated: databaseAgentHosts?.outdatedDatabaseAgentHosts.total ?? 0,
                failed: databaseAgentHosts?.failedDatabaseAgentHosts ?? 0,
              }),
            }}
          >
            {databaseAgentHosts?.outdatedDatabaseAgentHosts?.data.map((outdatedDatabaseAgentHost) => (
              <OutdatedDatabaseAgentHostRow
                key={outdatedDatabaseAgentHost.databaseAgentHost.uuid}
                outdatedDatabaseAgentHost={outdatedDatabaseAgentHost}
              />
            ))}
          </OutdatedResourceCard>
        </AdminCan>

        <ExtensionSlot
          components={window.extensionContext.extensionRegistry.pages.admin.home.updates.cards.appendedComponents}
          name='updates-appended'
        />
      </div>
    </>
  );
}
