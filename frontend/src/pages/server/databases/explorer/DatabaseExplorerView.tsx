import { useParams } from 'react-router';
import browseDatabaseRows from '@/api/server/databases/browseDatabaseRows.ts';
import createDatabaseColumn from '@/api/server/databases/createDatabaseColumn.ts';
import createDatabaseTable from '@/api/server/databases/createDatabaseTable.ts';
import deleteDatabaseColumn from '@/api/server/databases/deleteDatabaseColumn.ts';
import deleteDatabaseRows from '@/api/server/databases/deleteDatabaseRows.ts';
import deleteDatabaseTable from '@/api/server/databases/deleteDatabaseTable.ts';
import getDatabase from '@/api/server/databases/getDatabase.ts';
import getDatabaseColumnTypes from '@/api/server/databases/getDatabaseColumnTypes.ts';
import getDatabaseSchema from '@/api/server/databases/getDatabaseSchema.ts';
import insertDatabaseRows from '@/api/server/databases/insertDatabaseRows.ts';
import queryDatabase from '@/api/server/databases/queryDatabase.ts';
import renameDatabaseColumn from '@/api/server/databases/renameDatabaseColumn.ts';
import renameDatabaseTable from '@/api/server/databases/renameDatabaseTable.ts';
import updateDatabaseRows from '@/api/server/databases/updateDatabaseRows.ts';
import ScreenBlock from '@/elements/feedback/ScreenBlock.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { DatabaseExplorerContext } from '@/providers/contexts/databaseExplorerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseExplorer from './DatabaseExplorer.tsx';

export default function DatabaseExplorerView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();
  const server = useServerStore((state) => state.server);

  const permissions = {
    'query-raw': useServerCan('databases.query-raw'),
    'edit-rows': useServerCan('databases.edit-rows'),
    'edit-structure': useServerCan('databases.edit-structure'),
    'delete-structure': useServerCan('databases.delete-structure'),
  };

  const resource = useResource({
    queryKey: queryKeys.server(server.uuid).databases.detail(params.id!),
    queryFn: () => getDatabase(server.uuid, params.id!),
    enabled: !!params.id,
  });

  return (
    <ResourceView resource={resource}>
      {(database) =>
        database.type === 'mongodb' ? (
          <ScreenBlock
            title={t('pages.server.databases.explorer.unsupported.title', {})}
            content={t('pages.server.databases.explorer.unsupported.content', {})}
          />
        ) : (
          <DatabaseExplorerContext.Provider
            value={{
              api: {
                getSchema: () => getDatabaseSchema(server.uuid, database.uuid),
                query: (data) => queryDatabase(server.uuid, database.uuid, data),
                browseRows: (data) => browseDatabaseRows(server.uuid, database.uuid, data),
                insertRows: (data) => insertDatabaseRows(server.uuid, database.uuid, data),
                updateRows: (data) => updateDatabaseRows(server.uuid, database.uuid, data),
                deleteRows: (data) => deleteDatabaseRows(server.uuid, database.uuid, data),
                getColumnTypes: () => getDatabaseColumnTypes(server.uuid, database.uuid),
                createTable: (data) => createDatabaseTable(server.uuid, database.uuid, data),
                renameTable: (data) => renameDatabaseTable(server.uuid, database.uuid, data),
                deleteTable: (data) => deleteDatabaseTable(server.uuid, database.uuid, data),
                createColumn: (data) => createDatabaseColumn(server.uuid, database.uuid, data),
                renameColumn: (data) => renameDatabaseColumn(server.uuid, database.uuid, data),
                deleteColumn: (data) => deleteDatabaseColumn(server.uuid, database.uuid, data),
              },
              keys: {
                schema: queryKeys.server(server.uuid).databases.schema(database.uuid),
                rows: queryKeys.server(server.uuid).databases.rows(database.uuid),
                columnTypes: queryKeys.server(server.uuid).databases.columnTypes(database.uuid),
              },
              can: (action) => permissions[action],
              engine: database.type === 'postgres' ? 'postgres' : 'mysql',
              typeLabel: databaseTypeLabelMapping[database.type],
              name: database.name,
            }}
          >
            <DatabaseExplorer />
          </DatabaseExplorerContext.Provider>
        )
      }
    </ResourceView>
  );
}
