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
import Anchor from '@/elements/Anchor.tsx';
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
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import NodeRow from '../../nodes/NodeRow.tsx';

export default function AdminOverviewUpdates() {
  const { addToast } = useToast();
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
        addToast('Recheck complete', 'success');
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setRecheckLoading(false));
  };

  return (
    <>
      {updateInformation &&
        parseVersion(updateInformation.latestPanelVersion).isNewerThan(updateInformation.panelVersion) && (
          <Alert className='mb-4' color='yellow'>
            A new version is available for the panel! You are currently on {updateInformation.panelVersion} and the
            latest version is {updateInformation.latestPanelVersion}. You may want to consider upgrading.{' '}
            <Anchor
              href='https://calagopus.com/docs/panel/updating'
              className='underline text-blue-400'
              target='_blank'
            >
              Click here
            </Anchor>{' '}
            to view upgrade instructions.
          </Alert>
        )}

      <div className='2xl:columns-2 gap-4 space-y-4'>
        <TitleCard title='Panel Version' icon={<FontAwesomeIcon icon={faInfoCircle} />}>
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
              Your panel is currently running version <Code>{updateInformation?.panelVersion || 'unknown'}</Code>. The
              latest available version is <Code>{updateInformation?.latestPanelVersion || 'unknown'}</Code>.
            </span>

            <Button
              leftSection={<FontAwesomeIcon icon={faRefresh} />}
              onClick={doRecheck}
              loading={recheckLoading}
              className='min-w-fit'
            >
              Recheck for Updates
            </Button>
          </div>
        </TitleCard>
        <TitleCard
          title='Version History'
          icon={<FontAwesomeIcon icon={faClockRotateLeft} />}
          rightSection={
            <Select
              placeholder='Select an update history to view'
              value={selectedUpdateHistory || ''}
              onChange={(value) => setSelectedUpdateHistory(value || null)}
              data={[
                { label: 'Panel', value: '' },
                ...(updateHistory
                  ? Object.keys(updateHistory.extensions).map((ext) => ({
                      label: `Extension: ${ext}`,
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
              <Table columns={['Version', 'Installed']}>
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
        <TitleCard title='Outdated Extensions' icon={<FontAwesomeIcon icon={faPuzzlePiece} />}>
          {!updateInformation ? (
            <Spinner.Centered />
          ) : !extensionUpdates.length && !extensionUpdateErrors.length ? (
            <>
              <FontAwesomeIcon icon={faCheck} /> All extensions are up to date.
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faExclamationTriangle} /> Some extensions are outdated or had errors when checking
              for updates.
              {extensionUpdates.length > 0 && (
                <>
                  <div className='mt-4' />
                  <Table columns={['Package Name', 'Version', 'Latest Version', 'Changes']} loading={loading}>
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
                          {!update.changes.length && <span>No changelog</span>}
                        </TableData>
                      </TableRow>
                    ))}
                  </Table>
                </>
              )}
              {extensionUpdateErrors.length > 0 && (
                <>
                  <Alert className='my-4' color='red'>
                    <FontAwesomeIcon icon={faExclamationTriangle} /> There were errors checking for updates for some
                    extensions.
                  </Alert>

                  <Table columns={['Package Name', 'Error']} loading={loading}>
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
        <TitleCard title='Outdated Nodes' icon={<FontAwesomeIcon icon={faServer} />}>
          {loading || !nodes?.outdatedNodes ? (
            <Spinner.Centered />
          ) : !nodes?.outdatedNodes.total ? (
            <>
              <FontAwesomeIcon icon={faCheck} /> Seems like all nodes are up to date. ({nodes?.failedNodes} failed to
              check)
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faExclamationTriangle} /> Some nodes are outdated, the latest available version is{' '}
              <Code>{updateInformation?.latestWingsVersion || 'unknown'}</Code>. ({nodes?.outdatedNodes.total} outdated,{' '}
              {nodes?.failedNodes} failed to check)
              <div className='mt-4' />
              <Table
                columns={nodeTableColumns}
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
