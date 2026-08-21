import {
  faArrowsRotate,
  faDatabase,
  faDownload,
  faFileLines,
  faPencil,
  faTrash,
  faUpload,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import getDatabaseInstance from '@/api/server/databases/instances/getDatabaseInstance.ts';
import { DatabaseInstancePowerAction } from '@/api/server/databases/instances/postDatabaseInstancePower.ts';
import Badge from '@/elements/Badge.tsx';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import Stack from '@/elements/Stack.tsx';
import Tabs from '@/elements/Tabs.tsx';
import Title from '@/elements/Title.tsx';
import { safeParseFromApi } from '@/lib/api-transform.ts';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceImagePullProgressSchema,
  serverDatabaseInstanceOperationSchema,
  serverDatabaseInstancePowerStateSchema,
  serverDatabaseInstanceResourceUsageSchema,
  serverDatabaseInstanceWebsocketMessageSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { formatMilliseconds } from '@/lib/time.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useWebsocket } from '@/plugins/useWebsocket.ts';
import { SocketEvent, SocketRequest } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import DatabaseInstanceDatabases from './DatabaseInstanceDatabases.tsx';
import DatabaseInstanceDetails from './DatabaseInstanceDetails.tsx';
import DatabaseInstanceLogs from './DatabaseInstanceLogs.tsx';
import DatabaseInstanceOperations from './DatabaseInstanceOperations.tsx';
import DatabaseInstanceStats from './DatabaseInstanceStats.tsx';
import DatabaseInstanceUsers from './DatabaseInstanceUsers.tsx';
import DatabaseInstanceApplyUpdateModal from './modals/DatabaseInstanceApplyUpdateModal.tsx';
import DatabaseInstanceDeleteModal from './modals/DatabaseInstanceDeleteModal.tsx';
import DatabaseInstanceEditModal from './modals/DatabaseInstanceEditModal.tsx';
import DatabaseInstanceExportModal from './modals/DatabaseInstanceExportModal.tsx';
import DatabaseInstanceImportModal from './modals/DatabaseInstanceImportModal.tsx';

function withPrelude(prelude: string, message: string) {
  return `\x1b[1m\x1b[33m${prelude} \x1b[0m${message}`;
}

function parseJson(value: string | undefined): unknown {
  try {
    return JSON.parse(value ?? '');
  } catch {
    return null;
  }
}

export default function DatabaseInstanceView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const serverStoreApi = useServerStoreApi();
  const server = useServerStore((state) => state.server);
  const settings = useGlobalStore((state) => state.settings);
  const powerState = useServerStore((state) => state.databaseInstanceUsage?.state);
  const powerAction = useServerStore((state) => state.databaseInstancePowerAction);
  const {
    setDatabaseInstance,
    clearDatabaseInstance,
    setDatabaseInstanceUsage,
    setDatabaseInstanceState,
    setDatabaseInstancePowerAction,
    addDatabaseInstanceLog,
    clearDatabaseInstanceLogs,
    setDatabaseInstanceImagePull,
    removeDatabaseInstanceImagePull,
    setDatabaseInstanceOperation,
    failDatabaseInstanceOperation,
    removeDatabaseInstanceOperation,
    resetDatabaseInstanceLiveState,
  } = useServerStore(
    useShallow((state) => ({
      setDatabaseInstance: state.setDatabaseInstance,
      clearDatabaseInstance: state.clearDatabaseInstance,
      setDatabaseInstanceUsage: state.setDatabaseInstanceUsage,
      setDatabaseInstanceState: state.setDatabaseInstanceState,
      setDatabaseInstancePowerAction: state.setDatabaseInstancePowerAction,
      addDatabaseInstanceLog: state.addDatabaseInstanceLog,
      clearDatabaseInstanceLogs: state.clearDatabaseInstanceLogs,
      setDatabaseInstanceImagePull: state.setDatabaseInstanceImagePull,
      removeDatabaseInstanceImagePull: state.removeDatabaseInstanceImagePull,
      setDatabaseInstanceOperation: state.setDatabaseInstanceOperation,
      failDatabaseInstanceOperation: state.failDatabaseInstanceOperation,
      removeDatabaseInstanceOperation: state.removeDatabaseInstanceOperation,
      resetDatabaseInstanceLiveState: state.resetDatabaseInstanceLiveState,
    })),
  );

  const [openModal, setOpenModal] = useState<'edit' | 'applyUpdate' | 'delete' | 'kill' | 'export' | 'import' | null>(
    null,
  );
  const canSeeDatabaseInstanceDatabases = useServerCan('database-instances.databases');
  const canSeeDatabaseInstanceUsers = useServerCan('database-instances.users');
  const canSeeLogs = useServerCan('database-instances.logs');

  const resource = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.detail(params.id!),
    queryFn: () => getDatabaseInstance(server.uuid, params.id!),
    enabled: !!params.id,
  });

  useEffect(() => {
    if (resource.data) {
      setDatabaseInstance(resource.data);
    }
  }, [resource.data, setDatabaseInstance]);

  useEffect(() => () => clearDatabaseInstance(), [clearDatabaseInstance]);

  const onMessage = useCallback(
    (message: z.infer<typeof serverDatabaseInstanceWebsocketMessageSchema>) => {
      const [first, second] = message.args;

      switch (message.event) {
        case SocketEvent.STATS: {
          const usage = safeParseFromApi(serverDatabaseInstanceResourceUsageSchema, parseJson(first));
          if (usage.success) {
            setDatabaseInstanceUsage(usage.data);
          }
          break;
        }
        case SocketEvent.STATUS: {
          const state = serverDatabaseInstancePowerStateSchema.safeParse(first);
          if (state.success) {
            const statusMapping: Record<z.infer<typeof serverDatabaseInstancePowerStateSchema>, string> = {
              offline: t('common.enum.serverState.offline', {}),
              running: t('common.enum.serverState.running', {}),
              starting: t('common.enum.serverState.starting', {}),
              stopping: t('common.enum.serverState.stopping', {}),
            };

            setDatabaseInstanceState(state.data);
            addDatabaseInstanceLog(
              withPrelude(
                settings.server.containerPrelude,
                t('pages.server.databases.instance.message.databaseMarkedAs', { state: statusMapping[state.data] }),
              ),
            );
          }
          break;
        }
        case SocketEvent.CONSOLE_OUTPUT:
          addDatabaseInstanceLog(first);
          break;
        case SocketEvent.DAEMON_MESSAGE:
          addDatabaseInstanceLog(withPrelude(settings.server.containerPrelude, first));
          break;
        case SocketEvent.IMAGE_PULL_PROGRESS: {
          const progress = safeParseFromApi(serverDatabaseInstanceImagePullProgressSchema, parseJson(second));
          if (progress.success) {
            setDatabaseInstanceImagePull(first, progress.data);
          }
          break;
        }
        case SocketEvent.IMAGE_PULL_COMPLETED:
          removeDatabaseInstanceImagePull(first);
          break;
        case SocketEvent.OPERATION_PROGRESS: {
          const operation = safeParseFromApi(serverDatabaseInstanceOperationSchema, parseJson(second));
          if (operation.success) {
            setDatabaseInstanceOperation(first, operation.data);
          }
          break;
        }
        case SocketEvent.OPERATION_COMPLETED: {
          const { databaseInstance, databaseInstanceOperations } = serverStoreApi.getState();
          const operation = databaseInstanceOperations.get(first);
          if (!operation) break;

          switch (operation.type) {
            case 'remote_import':
              addToast(
                t('pages.server.databases.instance.toast.operations.remoteImport.completed', {
                  database: operation.db ?? databaseInstance?.name ?? '',
                  source: operation.sourceDb ? `${operation.sourceHost}/${operation.sourceDb}` : operation.sourceHost,
                  time: formatMilliseconds(Math.max(0, Date.now() - operation.startTime.getTime()), false),
                }).md(),
                'success',
              );
              break;
          }

          if (databaseInstance) {
            queryClient
              .invalidateQueries({
                queryKey: queryKeys.server(server.uuid).databases.instances.databases(databaseInstance.uuid),
              })
              .catch(console.error);
          }

          removeDatabaseInstanceOperation(first);
          break;
        }
        case SocketEvent.OPERATION_ABORTED: {
          const { databaseInstance, databaseInstanceOperations } = serverStoreApi.getState();
          const operation = databaseInstanceOperations.get(first);
          if (!operation) break;

          switch (operation.type) {
            case 'remote_import':
              addToast(
                t('pages.server.databases.instance.toast.operations.remoteImport.aborted', {
                  database: operation.db ?? databaseInstance?.name ?? '',
                  source: operation.sourceDb ? `${operation.sourceHost}/${operation.sourceDb}` : operation.sourceHost,
                }).md(),
                'error',
              );
              break;
          }

          failDatabaseInstanceOperation(first);
          break;
        }
        case SocketEvent.OPERATION_ERROR: {
          const { databaseInstance, databaseInstanceOperations } = serverStoreApi.getState();
          const operation = databaseInstanceOperations.get(first);
          if (!operation) break;

          switch (operation.type) {
            case 'remote_import':
              addToast(
                t('pages.server.databases.instance.toast.operations.remoteImport.failed', {
                  database: operation.db ?? databaseInstance?.name ?? '',
                  source: operation.sourceDb ? `${operation.sourceHost}/${operation.sourceDb}` : operation.sourceHost,
                  error: second,
                }).md(),
                'error',
              );
              break;
          }

          failDatabaseInstanceOperation(first);
          break;
        }
        case SocketEvent.DAEMON_ERROR:
          setDatabaseInstancePowerAction(null);
          addToast(first, 'error');
          break;
      }
    },
    [
      addDatabaseInstanceLog,
      addToast,
      failDatabaseInstanceOperation,
      queryClient,
      removeDatabaseInstanceImagePull,
      removeDatabaseInstanceOperation,
      server.uuid,
      serverStoreApi,
      setDatabaseInstanceImagePull,
      setDatabaseInstanceOperation,
      setDatabaseInstancePowerAction,
      setDatabaseInstanceState,
      setDatabaseInstanceUsage,
      settings.server.containerPrelude,
      t,
    ],
  );

  const { connected, send } = useWebsocket({
    path: `/api/client/servers/${server.uuid}/databases/instances/${params.id}/ws`,
    schema: serverDatabaseInstanceWebsocketMessageSchema,
    enabled: !!params.id,
    reconnectDelay: 5000,
    onMessage,
    onOpen: () => {
      clearDatabaseInstanceLogs();
      send(JSON.stringify({ event: SocketRequest.SEND_STATS, args: [] }));
      send(JSON.stringify({ event: SocketRequest.SEND_STATUS, args: [] }));
      send(JSON.stringify({ event: SocketRequest.SEND_LOGS, args: [] }));
    },
    onClose: () => resetDatabaseInstanceLiveState(),
  });

  const onPowerAction = (action: DatabaseInstancePowerAction) => {
    setOpenModal(null);
    setDatabaseInstancePowerAction(action);

    send(JSON.stringify({ event: SocketRequest.SET_STATE, args: [action] }));
  };

  const killable = powerState === 'stopping';

  return (
    <ResourceView resource={resource}>
      {(instance) => {
        const showDatabasesTab = canSeeDatabaseInstanceDatabases && instance.type !== 'redis';
        const showUsersTab = canSeeDatabaseInstanceUsers;
        const anyTab = showDatabasesTab || showUsersTab || canSeeLogs;
        const offline = !powerState || powerState === 'offline';

        return (
          <ServerContentContainer title={instance.name} hideTitleComponent>
            <ConfirmationModal
              opened={openModal === 'kill'}
              onClose={() => setOpenModal(null)}
              title={t('pages.server.databases.instance.power.modal.forceKill.title', {})}
              confirm={t('common.button.continue', {})}
              onConfirmed={() => onPowerAction('kill')}
            >
              {t('pages.server.databases.instance.power.modal.forceKill.content', {}).md()}
            </ConfirmationModal>
            <DatabaseInstanceEditModal
              instance={instance}
              opened={openModal === 'edit'}
              onClose={() => setOpenModal(null)}
            />
            <DatabaseInstanceApplyUpdateModal
              instance={instance}
              opened={openModal === 'applyUpdate'}
              onClose={() => setOpenModal(null)}
            />
            <DatabaseInstanceDeleteModal
              instance={instance}
              opened={openModal === 'delete'}
              onClose={() => setOpenModal(null)}
              onDeleted={() => navigate(`/server/${server.uuidShort}/databases/instances`)}
            />
            {instance.type === 'redis' && (
              <>
                <DatabaseInstanceExportModal
                  instance={instance}
                  opened={openModal === 'export'}
                  onClose={() => setOpenModal(null)}
                />
                <DatabaseInstanceImportModal
                  instance={instance}
                  opened={openModal === 'import'}
                  onClose={() => setOpenModal(null)}
                />
              </>
            )}

            <Stack gap='lg'>
              <Group justify='space-between'>
                <Group gap='md'>
                  <Title order={1}>{instance.name}</Title>
                  <Badge color='blue' size='lg'>
                    {databaseAgentTypeLabelMapping[instance.type]}
                  </Badge>
                  {instance.isLocked && (
                    <Badge color='green' size='lg'>
                      {t('common.form.locked', {})}
                    </Badge>
                  )}
                  {instance.updateAvailable && (
                    <Badge color='yellow' size='lg'>
                      {t('pages.server.databases.instance.updateAvailable', {})}
                    </Badge>
                  )}
                </Group>

                <Group>
                  <DatabaseInstanceOperations />
                  <ServerCan action='database-instances.power'>
                    <Button
                      color='green'
                      disabled={!connected || powerState !== 'offline' || powerAction !== null}
                      loading={powerState === 'starting' || powerAction === 'start'}
                      onClick={() => onPowerAction('start')}
                    >
                      {t('common.enum.serverPowerAction.start', {})}
                    </Button>
                    <Button
                      color='gray'
                      disabled={!connected || !powerState || powerAction !== null}
                      loading={powerAction === 'restart'}
                      onClick={() => onPowerAction('restart')}
                    >
                      {t('common.enum.serverPowerAction.restart', {})}
                    </Button>
                    <Button
                      color='red'
                      disabled={!connected || !powerState || powerState === 'offline' || powerAction !== null}
                      loading={powerAction === 'stop'}
                      onClick={() => (killable ? setOpenModal('kill') : onPowerAction('stop'))}
                    >
                      {killable
                        ? t('common.enum.serverPowerAction.kill', {})
                        : t('common.enum.serverPowerAction.stop', {})}
                    </Button>
                  </ServerCan>
                  {instance.type === 'redis' && (
                    <>
                      <ServerCan action='database-instances.export'>
                        <Button
                          onClick={() => setOpenModal('export')}
                          color='gray'
                          disabled={offline}
                          leftSection={<FontAwesomeIcon icon={faDownload} />}
                        >
                          {t('common.button.export', {})}
                        </Button>
                      </ServerCan>
                      <ServerCan action='database-instances.import'>
                        <Button
                          onClick={() => setOpenModal('import')}
                          color='gray'
                          disabled={offline}
                          leftSection={<FontAwesomeIcon icon={faUpload} />}
                        >
                          {t('common.button.import', {})}
                        </Button>
                      </ServerCan>
                    </>
                  )}
                  {instance.updateAvailable && (
                    <ServerCan action='database-instances.apply-update'>
                      <Button
                        onClick={() => setOpenModal('applyUpdate')}
                        color='yellow'
                        disabled={instance.isLocked}
                        leftSection={<FontAwesomeIcon icon={faArrowsRotate} />}
                      >
                        {t('pages.server.databases.instance.button.applyUpdate', {})}
                      </Button>
                    </ServerCan>
                  )}
                  <ServerCan action='database-instances.update'>
                    <Button
                      onClick={() => setOpenModal('edit')}
                      color='blue'
                      leftSection={<FontAwesomeIcon icon={faPencil} />}
                    >
                      {t('common.button.edit', {})}
                    </Button>
                  </ServerCan>
                  <ServerCan action='database-instances.delete'>
                    <Button
                      onClick={() => setOpenModal('delete')}
                      color='red'
                      disabled={instance.isLocked}
                      leftSection={<FontAwesomeIcon icon={faTrash} />}
                    >
                      {t('common.button.delete', {})}
                    </Button>
                  </ServerCan>
                </Group>
              </Group>

              <div className='grid xl:grid-cols-4 gap-4'>
                <div className='xl:col-span-3 flex flex-col h-[60vh] xl:h-auto'>
                  <DatabaseInstanceStats instance={instance} />
                </div>

                <div className='flex flex-col'>
                  <DatabaseInstanceDetails instance={instance} />
                </div>
              </div>

              {anyTab && (
                <Tabs
                  defaultValue={showDatabasesTab ? 'databases' : showUsersTab ? 'users' : 'logs'}
                  keepMounted={false}
                >
                  <Tabs.List>
                    {showDatabasesTab && (
                      <Tabs.Tab value='databases' leftSection={<FontAwesomeIcon icon={faDatabase} />}>
                        {t('pages.server.databases.instance.view.tabs.databases', {})}
                      </Tabs.Tab>
                    )}
                    {showUsersTab && (
                      <Tabs.Tab value='users' leftSection={<FontAwesomeIcon icon={faUsers} />}>
                        {t('pages.server.databases.instance.view.tabs.users', {})}
                      </Tabs.Tab>
                    )}
                    {canSeeLogs && (
                      <Tabs.Tab value='logs' leftSection={<FontAwesomeIcon icon={faFileLines} />}>
                        {t('pages.server.databases.instance.view.tabs.logs', {})}
                      </Tabs.Tab>
                    )}
                  </Tabs.List>

                  {showDatabasesTab && (
                    <Tabs.Panel value='databases' pt='xs'>
                      <DatabaseInstanceDatabases instance={instance} offline={offline} />
                    </Tabs.Panel>
                  )}
                  {showUsersTab && (
                    <Tabs.Panel value='users' pt='xs'>
                      <DatabaseInstanceUsers instance={instance} offline={offline} />
                    </Tabs.Panel>
                  )}
                  {canSeeLogs && (
                    <Tabs.Panel value='logs' pt='xs'>
                      <DatabaseInstanceLogs />
                    </Tabs.Panel>
                  )}
                </Tabs>
              )}
            </Stack>
          </ServerContentContainer>
        );
      }}
    </ResourceView>
  );
}
