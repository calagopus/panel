import {
  faCheck,
  faExclamationTriangle,
  faInfoCircle,
  faPuzzlePiece,
  faRefresh,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import getNodeUpdates from '@/api/admin/system/updates/getNodeUpdates.ts';
import recheckUpdates from '@/api/admin/system/updates/recheckUpdates.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import {
  adminExtensionUpdateCheckResultErrorSchema,
  adminExtensionUpdateCheckResultUpdateAvailableSchema,
} from '@/lib/schemas/admin/updates.ts';
import { nodeTableColumns } from '@/lib/tableColumns.ts';
import { parseVersion } from '@/lib/version.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePageableTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import NodeRow from '../nodes/NodeRow.tsx';

export default function AdminUpdates() {
  const { addToast } = useToast();
  const { updateInformation, setUpdateInformation } = useAdminStore();
  const { settings } = useGlobalStore();

  const [nodes, setNodes] = useState<Awaited<ReturnType<typeof getNodeUpdates>> | null>(null);
  const [recheckLoading, setRecheckLoading] = useState(false);

  const { loading, setPage } = useSearchablePaginatedTable({
    fetcher: (page) => getNodeUpdates(page),
    setStoreData: setNodes,
    paginationKey: 'outdatedNodes',
  });

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
        addToast('Recheck complete', 'success');
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setRecheckLoading(false));
  };

  return (
    <AdminContentContainer title='Updates'>
      {updateInformation && parseVersion(updateInformation.latestPanel).isNewerThan(settings.version) && (
        <Alert className='mb-4' color='yellow'>
          A new version is available for the panel! You are currently on {settings.version} and the latest version is{' '}
          {updateInformation.latestPanel}. You may want to consider upgrading.{' '}
          <a href='https://calagopus.com/docs/panel/updating' className='underline text-blue-400'>
            Click here
          </a>{' '}
          to view upgrade instructions.
        </Alert>
      )}

      <div className='2xl:columns-2 gap-4 space-y-4'>
        <TitleCard title='Panel Version' icon={<FontAwesomeIcon icon={faInfoCircle} />}>
          <div className='flex flex-row justify-between items-center'>
            <span>
              <FontAwesomeIcon
                icon={
                  updateInformation && parseVersion(updateInformation.latestPanel).isNewerThan(settings.version)
                    ? faExclamationTriangle
                    : faCheck
                }
              />{' '}
              Your panel is currently running version <Code>{settings.version}</Code>. The latest available version is{' '}
              <Code>{updateInformation?.latestPanel || 'unknown'}</Code>.
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
        <TitleCard title='Outdated Extensions' icon={<FontAwesomeIcon icon={faPuzzlePiece} />}>
          {loading || !updateInformation ? (
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
              <Code>{updateInformation?.latestWings || 'unknown'}</Code>. ({nodes?.outdatedNodes.total} outdated,{' '}
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
    </AdminContentContainer>
  );
}
