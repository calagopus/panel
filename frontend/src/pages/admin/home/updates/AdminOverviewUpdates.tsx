import {
  faCheck,
  faClockRotateLeft,
  faExclamationTriangle,
  faInfoCircle,
  faPuzzlePiece,
  faRefresh,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import getDatabaseAgentHostUpdates from '@/api/admin/system/updates/getDatabaseAgentHostUpdates.ts';
import getNodeUpdates from '@/api/admin/system/updates/getNodeUpdates.ts';
import getUpdateHistory from '@/api/admin/system/updates/getUpdateHistory.ts';
import recheckUpdates from '@/api/admin/system/updates/recheckUpdates.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import Select from '@/elements/input/Select.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  adminExtensionUpdateCheckResultErrorSchema,
  adminExtensionUpdateCheckResultUpdateAvailableSchema,
} from '@/lib/schemas/admin/system.ts';
import { databaseAgentHostTableColumns, nodeTableColumns } from '@/lib/tableColumns.ts';
import { parseVersion } from '@/lib/version.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import DatabaseAgentHostRow from '../../databaseAgentHosts/DatabaseAgentHostRow.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';
import OutdatedResourceCard from './OutdatedResourceCard.tsx';

export default function AdminOverviewUpdates() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const updateInformation = useAdminStore((state) => state.updateInformation);
  const setUpdateInformation = useAdminStore((state) => state.setUpdateInformation);
  const canReadNodes = useAdminCan('nodes.read');
  const canReadDatabaseAgentHosts = useAdminCan('database-agent-hosts.read');

  const [updateHistory, setUpdateHistory] = useState<Awaited<ReturnType<typeof getUpdateHistory>> | null>(null);
  const [selectedUpdateHistory, setSelectedUpdateHistory] = useState<string | null>(null);
  const [recheckLoading, setRecheckLoading] = useState(false);

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

  useEffect(() => {
    getUpdateHistory()
      .then((history) => setUpdateHistory(history))
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  }, []);

  const extensionUpdates = useMemo(
    () =>
      Object.entries(updateInformation?.extensions || {}).filter(
        ([_, update]) => update.type === 'update_available',
      ) as [string, z.infer<typeof adminExtensionUpdateCheckResultUpdateAvailableSchema>][],
    [updateInformation],
  );
  const extensionUpdateErrors = useMemo(
    () =>
      Object.entries(updateInformation?.extensions || {}).filter(([_, update]) => update.type === 'error') as [
        string,
        z.infer<typeof adminExtensionUpdateCheckResultErrorSchema>,
      ][],
    [updateInformation],
  );

  const doRecheck = () => {
    setRecheckLoading(true);

    recheckUpdates()
      .then((updateInformation) => {
        setUpdateInformation(updateInformation);
        refetch();
        refetchDatabaseAgentHosts();
        addToast(t('pages.admin.home.tabs.updates.page.toast.recheckComplete', {}), 'success');
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setRecheckLoading(false));
  };

  const unknownLabel = t('common.unknown', {});

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

      <div className='2xl:columns-2 gap-4 space-y-4'>
        {window.extensionContext.extensionRegistry.pages.admin.home.updates.cards.prependedComponents.map(
          (Component, index) => (
            <Component key={`updates-prepended-${index}`} />
          ),
        )}

        <TitleCard
          title={t('pages.admin.home.tabs.updates.page.card.panelVersion', {})}
          icon={<FontAwesomeIcon icon={faInfoCircle} />}
        >
          <div className='flex flex-col md:flex-row gap-2 justify-between'>
            <span>
              <FontAwesomeIcon
                icon={
                  updateInformation &&
                  parseVersion(updateInformation.latestPanelVersion).isNewerThan(updateInformation.panelVersion)
                    ? faExclamationTriangle
                    : faCheck
                }
              />{' '}
              {t('pages.admin.home.tabs.updates.page.panelVersion', {
                current: updateInformation?.panelVersion || unknownLabel,
                latest: updateInformation?.latestPanelVersion || unknownLabel,
              }).md()}
            </span>

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
          icon={<FontAwesomeIcon icon={faClockRotateLeft} />}
          rightSection={
            <Select
              placeholder={t('pages.admin.home.tabs.updates.page.selectHistory', {})}
              value={selectedUpdateHistory || ''}
              onChange={(value) => setSelectedUpdateHistory(value || null)}
              data={[
                { label: t('pages.admin.home.tabs.updates.page.historyPanel', {}), value: '' },
                ...(updateHistory
                  ? Object.keys(updateHistory.extensions).map((ext) => ({
                      label: t('pages.admin.home.tabs.updates.page.historyExtension', { name: ext }),
                      value: ext,
                    }))
                  : []),
              ]}
              className='ml-auto'
              size='xs'
            />
          }
          wrapperClassName='max-h-72 overflow-y-auto'
        >
          {!updateHistory ? (
            <Spinner.Centered />
          ) : (
            <>
              <Table
                columns={[
                  t('pages.admin.home.tabs.updates.page.table.version', {}),
                  t('pages.admin.home.tabs.updates.page.table.installed', {}),
                ]}
              >
                {(!selectedUpdateHistory
                  ? updateHistory.panel
                  : updateHistory.extensions[selectedUpdateHistory] || []
                ).map((entry) => (
                  <TableRow key={entry.version}>
                    <TableData>
                      <Code>{entry.version}</Code>
                    </TableData>
                    <TableData>
                      <FormattedTimestamp timestamp={entry.timestamp} />
                    </TableData>
                  </TableRow>
                ))}
              </Table>
            </>
          )}
        </TitleCard>
        <TitleCard
          title={t('pages.admin.home.tabs.updates.page.card.outdatedExtensions', {})}
          icon={<FontAwesomeIcon icon={faPuzzlePiece} />}
        >
          {!updateInformation ? (
            <Spinner.Centered />
          ) : !extensionUpdates.length && !extensionUpdateErrors.length ? (
            <>
              <FontAwesomeIcon icon={faCheck} /> {t('pages.admin.home.tabs.updates.page.extensionsUpToDate', {})}
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faExclamationTriangle} />{' '}
              {t('pages.admin.home.tabs.updates.page.extensionsOutdated', {})}
              {extensionUpdates.length > 0 && (
                <>
                  <div className='mt-4' />
                  <Table
                    columns={[
                      t('pages.admin.home.tabs.updates.page.table.packageName', {}),
                      t('pages.admin.home.tabs.updates.page.table.version', {}),
                      t('pages.admin.home.tabs.updates.page.table.latestVersion', {}),
                      t('pages.admin.home.tabs.updates.page.table.changes', {}),
                    ]}
                    loading={loading}
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
                            <span>{t('pages.admin.home.tabs.updates.page.noChangelog', {})}</span>
                          )}
                        </TableData>
                      </TableRow>
                    ))}
                  </Table>
                </>
              )}
              {extensionUpdateErrors.length > 0 && (
                <>
                  <Alert className='my-4' color='red'>
                    <FontAwesomeIcon icon={faExclamationTriangle} />{' '}
                    {t('pages.admin.home.tabs.updates.page.alert.extensionUpdateErrors', {})}
                  </Alert>

                  <Table
                    columns={[
                      t('pages.admin.home.tabs.updates.page.table.packageName', {}),
                      t('pages.admin.home.tabs.updates.page.table.error', {}),
                    ]}
                    loading={loading}
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
            icon={<FontAwesomeIcon icon={faServer} />}
            table={{ loading, error, data: nodes?.outdatedNodes, columns: nodeTableColumns(), onPageSelect: setPage }}
            status={{
              upToDate: t('pages.admin.home.tabs.updates.page.nodesUpToDate', { failed: nodes?.failedNodes ?? 0 }),
              outdated: t('pages.admin.home.tabs.updates.page.nodesOutdated', {
                latest: updateInformation?.latestWingsVersion || unknownLabel,
                outdated: nodes?.outdatedNodes.total ?? 0,
                failed: nodes?.failedNodes ?? 0,
              }).md(),
            }}
          >
            {nodes?.outdatedNodes?.data.map((node) => (
              <NodeRow key={node.node.uuid} node={node.node} />
            ))}
          </OutdatedResourceCard>
        </AdminCan>
        <AdminCan action='database-agent-hosts.read'>
          <OutdatedResourceCard
            title={t('pages.admin.home.tabs.updates.page.card.outdatedDatabaseAgentHosts', {})}
            icon={<FontAwesomeIcon icon={faServer} />}
            table={{
              loading: databaseAgentHostsLoading,
              error: databaseAgentHostsError,
              data: databaseAgentHosts?.outdatedDatabaseAgentHosts,
              columns: databaseAgentHostTableColumns(),
              onPageSelect: setDatabaseAgentHostsPage,
            }}
            status={{
              upToDate: t('pages.admin.home.tabs.updates.page.databaseAgentHostsUpToDate', {
                failed: databaseAgentHosts?.failedDatabaseAgentHosts ?? 0,
              }),
              outdated: t('pages.admin.home.tabs.updates.page.databaseAgentHostsOutdated', {
                latest: updateInformation?.latestDbAgentVersion || unknownLabel,
                outdated: databaseAgentHosts?.outdatedDatabaseAgentHosts.total ?? 0,
                failed: databaseAgentHosts?.failedDatabaseAgentHosts ?? 0,
              }).md(),
            }}
          >
            {databaseAgentHosts?.outdatedDatabaseAgentHosts?.data.map((host) => (
              <DatabaseAgentHostRow key={host.databaseAgentHost.uuid} databaseAgentHost={host.databaseAgentHost} />
            ))}
          </OutdatedResourceCard>
        </AdminCan>

        {window.extensionContext.extensionRegistry.pages.admin.home.updates.cards.appendedComponents.map(
          (Component, index) => (
            <Component key={`updates-appended-${index}`} />
          ),
        )}
      </div>
    </>
  );
}
