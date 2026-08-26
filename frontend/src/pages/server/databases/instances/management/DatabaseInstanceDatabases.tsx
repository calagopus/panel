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
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
  serverDatabaseInstanceUserSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceCredentialsModal from '../modals/DatabaseInstanceCredentialsModal.tsx';
import DatabaseInstanceDatabaseCreateModal from '../modals/DatabaseInstanceDatabaseCreateModal.tsx';
import DatabaseInstanceDatabaseRow from './DatabaseInstanceDatabaseRow.tsx';

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
  const canReadUsers = useServerCan('database-instances.users');

  const [createDatabaseOpen, setCreateDatabaseOpen] = useState(false);
  const [createdUser, setCreatedUser] = useState<{
    user: z.infer<typeof serverDatabaseInstanceUserSchema>;
    database: z.infer<typeof serverDatabaseInstanceDatabaseSchema>;
  } | null>(null);

  const {
    data: databases,
    loading,
    error,
  } = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.databases(instance.uuid),
    queryFn: () => getDatabaseInstanceDatabases(server.uuid, instance.uuid),
  });

  const { data: users } = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.users(instance.uuid),
    queryFn: () => getDatabaseInstanceUsers(server.uuid, instance.uuid),
    enabled: canReadUsers,
    silent: true,
  });

  const pagination = {
    total: databases?.length ?? 0,
    page: 1,
    perPage: databases?.length ?? 0,
    data: databases ?? [],
  };

  const databasesWithUser = new Set(
    (users ?? []).flatMap((user) => user.databases.map((database) => database.databaseUuid)),
  );
  const limitReached = pagination.total >= maxDatabaseCount;

  return (
    <Stack>
      <DatabaseInstanceDatabaseCreateModal
        instance={instance}
        userCount={users?.length ?? 0}
        onUserCreated={(user, database) => setCreatedUser({ user, database })}
        opened={createDatabaseOpen}
        onClose={() => setCreateDatabaseOpen(false)}
      />
      {createdUser && (
        <DatabaseInstanceCredentialsModal
          instance={instance}
          user={createdUser.user}
          databases={[createdUser.database]}
          offline={offline}
          opened
          onClose={() => setCreatedUser(null)}
        />
      )}

      <Group justify='space-between'>
        <div>
          <Title order={2}>{t('pages.server.databases.instance.databases.title', {})}</Title>
          <Text size='xs' c='dimmed'>
            {t('pages.server.databases.instance.databases.subtitle', {
              current: pagination.total,
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

      <Table
        columns={[t('common.table.columns.name', {}), t('common.table.columns.size', {}), '']}
        loading={loading}
        error={error ? httpErrorToHuman(error) : null}
        pagination={pagination}
      >
        {pagination.data.map((database) => (
          <DatabaseInstanceDatabaseRow
            key={database.uuid}
            instance={instance}
            database={database}
            offline={offline}
            hasUser={!users || databasesWithUser.has(database.uuid)}
          />
        ))}
      </Table>
    </Stack>
  );
}
