import { faDatabase, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getDatabaseInstanceDatabases from '@/api/server/databases/instances/getDatabaseInstanceDatabases.ts';
import getDatabaseInstanceUsers from '@/api/server/databases/instances/getDatabaseInstanceUsers.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import Group from '@/elements/Group.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Stack from '@/elements/Stack.tsx';
import Table from '@/elements/Table.tsx';
import Text from '@/elements/Text.tsx';
import Title from '@/elements/Title.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceDatabaseRow from './DatabaseInstanceDatabaseRow.tsx';
import DatabaseInstanceDatabaseCreateModal from './modals/DatabaseInstanceDatabaseCreateModal.tsx';

export default function DatabaseInstanceDatabases({
  instance,
  offline,
}: {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  offline: boolean;
}) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const maxDatabaseCount = useGlobalStore((state) => state.settings.server.maxDatabaseInstanceDatabaseCount);

  const [createDatabaseOpen, setCreateDatabaseOpen] = useState(false);

  const {
    data: databases,
    error: databasesError,
    isFetching: databasesFetching,
  } = useQuery({
    queryKey: queryKeys.server(server.uuid).databases.instances.databases(instance.uuid),
    queryFn: () => getDatabaseInstanceDatabases(server.uuid, instance.uuid),
  });

  const { data: users } = useQuery({
    queryKey: queryKeys.server(server.uuid).databases.instances.users(instance.uuid),
    queryFn: () => getDatabaseInstanceUsers(server.uuid, instance.uuid),
  });

  const databasesWithUser = new Set((users ?? []).map((user) => user.databaseUuid).filter(Boolean));

  const limitReached = (databases?.length ?? 0) >= maxDatabaseCount;

  return (
    <Stack>
      <DatabaseInstanceDatabaseCreateModal
        instance={instance}
        opened={createDatabaseOpen}
        onClose={() => setCreateDatabaseOpen(false)}
      />

      <Group justify='space-between'>
        <div>
          <Title order={2}>{t('pages.server.databases.instance.databases.title', {})}</Title>
          <Text size='xs' c='dimmed'>
            {t('pages.server.databases.instance.databases.subtitle', {
              current: databases?.length ?? 0,
              max: maxDatabaseCount,
            })}
          </Text>
        </div>
        <ServerCan action='database-instances.databases'>
          <ConditionalTooltip
            enabled={offline || limitReached}
            label={
              limitReached
                ? t('pages.server.databases.instance.databases.tooltip.limitReached', { max: maxDatabaseCount })
                : t('pages.server.databases.instance.databases.tooltip.offline', {})
            }
          >
            <Button
              onClick={() => setCreateDatabaseOpen(true)}
              disabled={offline || limitReached}
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.create', {})}
            </Button>
          </ConditionalTooltip>
        </ServerCan>
      </Group>

      {databasesFetching && !databases ? (
        <Spinner.Centered />
      ) : databasesError ? (
        <Text>{httpErrorToHuman(databasesError)}</Text>
      ) : !databases?.length ? (
        <Stack align='center' gap='sm' py='xl'>
          <FontAwesomeIcon icon={faDatabase} size='2x' className='text-(--mantine-color-dimmed)' />
          <Text c='dimmed'>{t('pages.server.databases.instance.databases.noDatabases', {})}</Text>
        </Stack>
      ) : (
        <Table columns={[t('common.table.columns.name', {}), t('common.table.columns.size', {}), '']}>
          {databases.map((database) => (
            <DatabaseInstanceDatabaseRow
              key={database.uuid}
              instance={instance}
              database={database}
              offline={offline}
              hasUser={!users || databasesWithUser.has(database.uuid)}
            />
          ))}
        </Table>
      )}
    </Stack>
  );
}
