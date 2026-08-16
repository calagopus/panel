import { useParams } from 'react-router';
import { z } from 'zod';
import browseDatabaseInstanceDatabaseRows from '@/api/server/databases/instances/browseDatabaseInstanceDatabaseRows.ts';
import createDatabaseInstanceDatabaseColumn from '@/api/server/databases/instances/createDatabaseInstanceDatabaseColumn.ts';
import createDatabaseInstanceDatabaseTable from '@/api/server/databases/instances/createDatabaseInstanceDatabaseTable.ts';
import deleteDatabaseInstanceDatabaseColumn from '@/api/server/databases/instances/deleteDatabaseInstanceDatabaseColumn.ts';
import deleteDatabaseInstanceDatabaseRows from '@/api/server/databases/instances/deleteDatabaseInstanceDatabaseRows.ts';
import deleteDatabaseInstanceDatabaseTable from '@/api/server/databases/instances/deleteDatabaseInstanceDatabaseTable.ts';
import getDatabaseInstance from '@/api/server/databases/instances/getDatabaseInstance.ts';
import getDatabaseInstanceDatabaseColumnTypes from '@/api/server/databases/instances/getDatabaseInstanceDatabaseColumnTypes.ts';
import getDatabaseInstanceDatabaseSchema from '@/api/server/databases/instances/getDatabaseInstanceDatabaseSchema.ts';
import getDatabaseInstanceDatabases from '@/api/server/databases/instances/getDatabaseInstanceDatabases.ts';
import insertDatabaseInstanceDatabaseRows from '@/api/server/databases/instances/insertDatabaseInstanceDatabaseRows.ts';
import queryDatabaseInstanceDatabase from '@/api/server/databases/instances/queryDatabaseInstanceDatabase.ts';
import renameDatabaseInstanceDatabaseColumn from '@/api/server/databases/instances/renameDatabaseInstanceDatabaseColumn.ts';
import renameDatabaseInstanceDatabaseTable from '@/api/server/databases/instances/renameDatabaseInstanceDatabaseTable.ts';
import updateDatabaseInstanceDatabaseRows from '@/api/server/databases/instances/updateDatabaseInstanceDatabaseRows.ts';
import ResourceView from '@/elements/ResourceView.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useResource } from '@/plugins/useResource.ts';
import { DatabaseExplorerContext } from '@/providers/contexts/databaseExplorerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseExplorer from '../explorer/DatabaseExplorer.tsx';

export default function DatabaseInstanceExplorerView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();
  const server = useServerStore((state) => state.server);

  const resource = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.detail(params.id!),
    queryFn: () => getDatabaseInstance(server.uuid, params.id!),
    enabled: !!params.id,
  });

  return (
    <ResourceView resource={resource}>
      {(instance) =>
        instance.type === 'mongodb' || instance.type === 'redis' ? (
          <ScreenBlock
            title={t('pages.server.databases.explorer.unsupported.title', {})}
            content={t('pages.server.databases.explorer.unsupported.instanceContent', {})}
          />
        ) : (
          <InstanceDatabaseExplorer instance={instance} />
        )
      }
    </ResourceView>
  );
}

function InstanceDatabaseExplorer({ instance }: { instance: z.infer<typeof serverDatabaseInstanceSchema> }) {
  const { t } = useTranslations();
  const params = useParams<'databaseId'>();
  const server = useServerStore((state) => state.server);

  const permissions = {
    'query-raw': useServerCan('database-instances.query-raw'),
    'edit-rows': useServerCan('database-instances.edit-rows'),
    'edit-structure': useServerCan('database-instances.edit-structure'),
    'delete-structure': useServerCan('database-instances.delete-structure'),
  };

  const resource = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.databases(instance.uuid),
    queryFn: () => getDatabaseInstanceDatabases(server.uuid, instance.uuid),
  });

  return (
    <ResourceView resource={resource}>
      {(databases) => {
        const database = databases.find((entry) => entry.uuid === params.databaseId);
        if (!database) {
          return (
            <ScreenBlock
              title={t('pages.server.databases.explorer.unsupported.title', {})}
              content={t('pages.server.databases.explorer.notFound', {})}
            />
          );
        }

        return (
          <DatabaseExplorerContext.Provider
            value={{
              api: {
                getSchema: () => getDatabaseInstanceDatabaseSchema(server.uuid, instance.uuid, database.uuid),
                query: (data) => queryDatabaseInstanceDatabase(server.uuid, instance.uuid, database.uuid, data),
                browseRows: (data) =>
                  browseDatabaseInstanceDatabaseRows(server.uuid, instance.uuid, database.uuid, data),
                insertRows: (data) =>
                  insertDatabaseInstanceDatabaseRows(server.uuid, instance.uuid, database.uuid, data),
                updateRows: (data) =>
                  updateDatabaseInstanceDatabaseRows(server.uuid, instance.uuid, database.uuid, data),
                deleteRows: (data) =>
                  deleteDatabaseInstanceDatabaseRows(server.uuid, instance.uuid, database.uuid, data),
                getColumnTypes: () => getDatabaseInstanceDatabaseColumnTypes(server.uuid, instance.uuid, database.uuid),
                createTable: (data) =>
                  createDatabaseInstanceDatabaseTable(server.uuid, instance.uuid, database.uuid, data),
                renameTable: (data) =>
                  renameDatabaseInstanceDatabaseTable(server.uuid, instance.uuid, database.uuid, data),
                deleteTable: (data) =>
                  deleteDatabaseInstanceDatabaseTable(server.uuid, instance.uuid, database.uuid, data),
                createColumn: (data) =>
                  createDatabaseInstanceDatabaseColumn(server.uuid, instance.uuid, database.uuid, data),
                renameColumn: (data) =>
                  renameDatabaseInstanceDatabaseColumn(server.uuid, instance.uuid, database.uuid, data),
                deleteColumn: (data) =>
                  deleteDatabaseInstanceDatabaseColumn(server.uuid, instance.uuid, database.uuid, data),
              },
              keys: {
                schema: queryKeys.server(server.uuid).databases.instances.databaseSchema(instance.uuid, database.uuid),
                rows: queryKeys.server(server.uuid).databases.instances.databaseRows(instance.uuid, database.uuid),
                columnTypes: queryKeys
                  .server(server.uuid)
                  .databases.instances.databaseColumnTypes(instance.uuid, database.uuid),
              },
              can: (action) => permissions[action],
              engine: instance.type === 'postgres' ? 'postgres' : 'mysql',
              typeLabel: databaseAgentTypeLabelMapping[instance.type],
              name: database.name,
            }}
          >
            <DatabaseExplorer />
          </DatabaseExplorerContext.Provider>
        );
      }}
    </ResourceView>
  );
}
