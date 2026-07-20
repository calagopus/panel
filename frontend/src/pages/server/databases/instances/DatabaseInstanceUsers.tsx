import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getDatabaseInstanceDatabases from '@/api/server/databases/instances/getDatabaseInstanceDatabases.ts';
import getDatabaseInstanceUsers from '@/api/server/databases/instances/getDatabaseInstanceUsers.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import Group from '@/elements/Group.tsx';
import Stack from '@/elements/Stack.tsx';
import Table from '@/elements/Table.tsx';
import Text from '@/elements/Text.tsx';
import Title from '@/elements/Title.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceUserRow from './DatabaseInstanceUserRow.tsx';
import DatabaseInstanceUserCreateModal from './modals/DatabaseInstanceUserCreateModal.tsx';

export default function DatabaseInstanceUsers({
  instance,
  offline,
}: {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  offline: boolean;
}) {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const maxUserCount = useGlobalStore((state) => state.settings.server.maxDatabaseInstanceUserCount);

  const hasDatabases = instance.type !== 'redis';

  const [createUserOpen, setCreateUserOpen] = useState(false);

  const { data: databases = [] } = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.databases(instance.uuid),
    queryFn: () => getDatabaseInstanceDatabases(server.uuid, instance.uuid),
    enabled: hasDatabases,
    silent: true,
  });

  const {
    data: users,
    loading,
    error,
  } = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.users(instance.uuid),
    queryFn: () => getDatabaseInstanceUsers(server.uuid, instance.uuid),
  });

  const pagination = {
    total: users?.length ?? 0,
    page: 1,
    perPage: users?.length ?? 0,
    data: users ?? [],
  };

  const databaseNameByUuid = new Map(databases.map((database) => [database.uuid, database.name]));

  const limitReached = pagination.total >= maxUserCount;
  const createDisabled = (offline && hasDatabases) || limitReached;

  return (
    <Stack>
      <DatabaseInstanceUserCreateModal
        instance={instance}
        databases={databases}
        opened={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
      />

      <Group justify='space-between'>
        <div>
          <Title order={2}>{t('pages.server.databases.instance.users.title', {})}</Title>
          <Text size='xs' c='dimmed'>
            {t('pages.server.databases.instance.users.subtitle', {
              current: pagination.total,
              max: maxUserCount,
            })}
          </Text>
        </div>
        <ServerCan action='database-instances.users'>
          <ConditionalTooltip
            enabled={createDisabled}
            label={
              limitReached
                ? t('pages.server.databases.instance.users.tooltip.limitReached', { max: maxUserCount })
                : t('pages.server.databases.instance.databases.tooltip.offline', {})
            }
          >
            <Button
              onClick={() => setCreateUserOpen(true)}
              disabled={createDisabled}
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.create', {})}
            </Button>
          </ConditionalTooltip>
        </ServerCan>
      </Group>

      <Table
        columns={[
          t('common.table.columns.username', {}),
          t('pages.server.databases.instance.databases.table.columns.database', {}),
          '',
        ]}
        loading={loading}
        error={error ? httpErrorToHuman(error) : null}
        pagination={pagination}
      >
        {pagination.data.map((user) => (
          <DatabaseInstanceUserRow
            key={user.uuid}
            instance={instance}
            user={user}
            databaseName={user.databaseUuid ? (databaseNameByUuid.get(user.databaseUuid) ?? null) : null}
          />
        ))}
      </Table>
    </Stack>
  );
}
