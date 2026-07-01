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
import getNodeUpdates from '@/api/admin/system/updates/getNodeUpdates.ts';
import getUpdateHistory from '@/api/admin/system/updates/getUpdateHistory.ts';
import recheckUpdates from '@/api/admin/system/updates/recheckUpdates.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
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
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { parseVersion } from '@/lib/version.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';

export default function AdminOverviewUpdates() {
  const { addToast } = useToast();
  const { t } = useTranslations();
  const { updateInformation, setUpdateInformation } = useAdminStore();

  const [updateHistory, setUpdateHistory] = useState<Awaited<ReturnType<typeof getUpdateHistory>> | null>(null);
  const [selectedUpdateHistory, setSelectedUpdateHistory] = useState<string | null>(null);
  const [recheckLoading, setRecheckLoading] = useState(false);

  const {
    data: nodes,
    loading,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.updates.nodes(),
    fetcher: (page) => getNodeUpdates(page),
    paginationKey: 'outdatedNodes',
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
        addToast(t('pages.admin.home.tabs.updates.page.toast.recheckComplete', {}), 'success');
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setRecheckLoading(false));
  };

  const unknownLabel = t('pages.admin.home.tabs.updates.page.unknown', {});

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
        <TitleCard
          title={t('pages.admin.home.tabs.updates.page.card.panelVersion', {})}
          icon={<FontAwesomeIcon icon={faInfoCircle} />}
        >
          <div className='flex flex-row justify-between'>
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
        <TitleCard
          title={t('pages.admin.home.tabs.updates.page.card.outdatedNodes', {})}
          icon={<FontAwesomeIcon icon={faServer} />}
        >
          {loading || !nodes?.outdatedNodes ? (
            <Spinner.Centered />
          ) : !nodes?.outdatedNodes.total ? (
            <>
              <FontAwesomeIcon icon={faCheck} />{' '}
              {t('pages.admin.home.tabs.updates.page.nodesUpToDate', { failed: nodes?.failedNodes ?? 0 })}
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faExclamationTriangle} />{' '}
              {t('pages.admin.home.tabs.updates.page.nodesOutdated', {
                latest: updateInformation?.latestWingsVersion || unknownLabel,
                outdated: nodes?.outdatedNodes.total ?? 0,
                failed: nodes?.failedNodes ?? 0,
              }).md()}
              <div className='mt-4' />
              <Table
                columns={nodeTableColumns()}
                loading={loading}
                pagination={nodes.outdatedNodes}
                onPageSelect={setPage}
              >
                {nodes.outdatedNodes.data.map((node) => (
                  <NodeRow key={node.node.uuid} node={node.node} />
                ))}
              </Table>
            </>
          )}
        </TitleCard>
      </div>
    </>
  );
}
