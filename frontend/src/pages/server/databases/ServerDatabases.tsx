import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import getDatabases from '@/api/server/databases/getDatabases.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseRow from './DatabaseRow.tsx';
import DatabasesSubNavigation from './DatabasesSubNavigation.tsx';
import ServerDatabaseInstances from './instances/ServerDatabaseInstances.tsx';
import DatabaseCreateModal from './modals/DatabaseCreateModal.tsx';
import { useDatabaseRelevance } from './useDatabaseRelevance.ts';

export default function ServerDatabases() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const [createOpen, setCreateOpen] = useState(false);

  const { canReadClassic, used, full, databaseHosts, classicRelevant, agentRelevant, settled } = useDatabaseRelevance();

  const { data, loading, error, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).databases.all(),
    fetcher: (page, search) => getDatabases(server.uuid, page, search),
    canRequest: canReadClassic,
  });

  if (settled && !classicRelevant && agentRelevant) {
    return <ServerDatabaseInstances />;
  }

  const disabled = full || databaseHosts.length === 0;

  return (
    <ServerContentContainer
      title={t('pages.server.databases.title', {})}
      subtitle={t('pages.server.databases.subtitle', {
        current: used,
        max: server.featureLimits.databases,
      })}
      search={search}
      setSearch={setSearch}
      contentRight={
        <ServerCan action='databases.create'>
          <ConditionalTooltip
            enabled={disabled}
            label={
              full
                ? t('pages.server.databases.tooltip.limitReached', {
                    max: server.featureLimits.databases,
                  })
                : t('pages.server.databases.modal.createDatabase.form.noHostsFound', {})
            }
          >
            <Button
              disabled={disabled}
              onClick={() => setCreateOpen(true)}
              color='blue'
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('common.button.create', {})}
            </Button>
          </ConditionalTooltip>
        </ServerCan>
      }
      registry={window.extensionContext.extensionRegistry.pages.server.databases.container}
    >
      <DatabaseCreateModal opened={createOpen} onClose={() => setCreateOpen(false)} />

      <DatabasesSubNavigation />

      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('common.table.columns.type', {}),
          t('common.table.columns.address', {}),
          t('common.table.columns.username', {}),
          t('common.table.columns.size', {}),
          t('pages.server.databases.table.columns.locked', {}),
          '',
        ]}
        loading={loading}
        pagination={data}
        onPageSelect={setPage}
        error={error}
      >
        {data?.data.map((database) => (
          <DatabaseRow database={database} key={database.uuid} />
        ))}
      </Table>
    </ServerContentContainer>
  );
}
