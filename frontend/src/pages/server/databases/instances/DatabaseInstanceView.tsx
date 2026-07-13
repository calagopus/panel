import { faDatabase, faFileLines, faPencil, faTrash, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getDatabaseInstance from '@/api/server/databases/instances/getDatabaseInstance.ts';
import postDatabaseInstancePower, {
  DatabaseInstancePowerAction,
} from '@/api/server/databases/instances/postDatabaseInstancePower.ts';
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
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceResourceUsageSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { transformKeysToCamelCase } from '@/lib/transformers.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceDatabases from './DatabaseInstanceDatabases.tsx';
import DatabaseInstanceDetails from './DatabaseInstanceDetails.tsx';
import DatabaseInstanceLogs from './DatabaseInstanceLogs.tsx';
import DatabaseInstanceStats from './DatabaseInstanceStats.tsx';
import DatabaseInstanceUsers from './DatabaseInstanceUsers.tsx';
import DatabaseInstanceDeleteModal from './modals/DatabaseInstanceDeleteModal.tsx';
import DatabaseInstanceEditModal from './modals/DatabaseInstanceEditModal.tsx';

export default function DatabaseInstanceView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const server = useServerStore((state) => state.server);

  const [openModal, setOpenModal] = useState<'edit' | 'delete' | 'kill' | null>(null);
  const [usage, setUsage] = useState<z.infer<typeof serverDatabaseInstanceResourceUsageSchema> | null>(null);
  const [powerLoading, setPowerLoading] = useState<DatabaseInstancePowerAction | null>(null);
  const [connected, setConnected] = useState(false);
  const canSeeDatabaseInstanceDatabases = useServerCan('database-instances.databases');
  const canSeeDatabaseInstanceUsers = useServerCan('database-instances.users');
  const canSeeLogs = useServerCan('database-instances.logs');

  const resource = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.detail(params.id!),
    queryFn: () => getDatabaseInstance(server.uuid, params.id!),
    enabled: !!params.id,
  });

  useEffect(() => {
    let socketRef: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const connect = () => {
      if (destroyed) {
        return;
      }

      const url = new URL(
        `/api/client/servers/${server.uuid}/databases/instances/${params.id}/resources/ws`,
        window.location.origin,
      );
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

      const socket = new WebSocket(url);
      socketRef = socket;

      socket.onopen = () => {
        if (destroyed || socket !== socketRef) {
          return;
        }

        setConnected(true);
      };

      socket.onmessage = (event) => {
        if (destroyed || socket !== socketRef) {
          return;
        }

        try {
          const data = serverDatabaseInstanceResourceUsageSchema.safeParse(
            transformKeysToCamelCase(JSON.parse(event.data)),
          );
          if (data.success) {
            setUsage(data.data);
          }
        } catch {
          // ignore
        }
      };

      socket.onclose = (e) => {
        if (destroyed || socket !== socketRef) {
          return;
        }

        socketRef = null;
        setConnected(false);
        setUsage(null);

        if (e.wasClean) {
          return;
        }

        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      socketRef?.close();
      socketRef = null;
    };
  }, [server.uuid, params.id]);

  useEffect(() => {
    setPowerLoading(null);
  }, [usage?.state]);

  const onPowerAction = (action: DatabaseInstancePowerAction) => {
    setOpenModal(null);
    setPowerLoading(action);

    postDatabaseInstancePower(server.uuid, params.id!, action)
      .then(() => addToast(t(`pages.server.databases.instance.power.toast.${action}`, {}), 'success'))
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
        setPowerLoading(null);
      });
  };

  const killable = usage?.state === 'stopping';

  return (
    <ResourceView resource={resource}>
      {(instance) => {
        const showDatabasesTab = canSeeDatabaseInstanceDatabases && instance.type !== 'redis';
        const showUsersTab = canSeeDatabaseInstanceUsers;
        const anyTab = showDatabasesTab || showUsersTab || canSeeLogs;
        const offline = !usage || usage.state === 'offline';

        return (
          <ServerContentContainer title={t('pages.server.databases.instance.title', {})} hideTitleComponent>
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
            <DatabaseInstanceDeleteModal
              instance={instance}
              opened={openModal === 'delete'}
              onClose={() => setOpenModal(null)}
              onDeleted={() => navigate(`/server/${server.uuidShort}/databases`)}
            />

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
                </Group>

                <Group>
                  <ServerCan action='database-instances.power'>
                    <Button
                      color='green'
                      disabled={!connected || usage?.state !== 'offline' || powerLoading !== null}
                      loading={usage?.state === 'starting' || powerLoading === 'start'}
                      onClick={() => onPowerAction('start')}
                    >
                      {t('common.enum.serverPowerAction.start', {})}
                    </Button>
                    <Button
                      color='gray'
                      disabled={!connected || !usage || powerLoading !== null}
                      loading={powerLoading === 'restart'}
                      onClick={() => onPowerAction('restart')}
                    >
                      {t('common.enum.serverPowerAction.restart', {})}
                    </Button>
                    <Button
                      color='red'
                      disabled={!connected || !usage || usage.state === 'offline' || powerLoading !== null}
                      loading={powerLoading === 'stop'}
                      onClick={() => (killable ? setOpenModal('kill') : onPowerAction('stop'))}
                    >
                      {killable
                        ? t('common.enum.serverPowerAction.kill', {})
                        : t('common.enum.serverPowerAction.stop', {})}
                    </Button>
                  </ServerCan>
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
                  <DatabaseInstanceStats instance={instance} usage={usage} />
                </div>

                <div className='flex flex-col'>
                  <DatabaseInstanceDetails instance={instance} usage={usage} />
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
                      <DatabaseInstanceLogs instance={instance} />
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
