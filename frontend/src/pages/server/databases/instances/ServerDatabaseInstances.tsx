import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import getDatabaseInstances from '@/api/server/databases/instances/getDatabaseInstances.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import ConditionalTooltip from '@/elements/overlays/ConditionalTooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabasesSubNavigation from '../DatabasesSubNavigation.tsx';
import { useDatabaseRelevance } from '../useDatabaseRelevance.ts';
import DatabaseInstanceRow from './DatabaseInstanceRow.tsx';
import DatabaseInstanceCreateModal from './modals/DatabaseInstanceCreateModal.tsx';

export default function ServerDatabaseInstances() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const [createOpen, setCreateOpen] = useState(false);

  const { canReadAgent, used, full, agentTemplates } = useDatabaseRelevance();

  const { data, loading, error, search, setSearch, setPage } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).databases.instances.all(),
    fetcher: (page, search) => getDatabaseInstances(server.uuid, page, search),
    canRequest: canReadAgent,
  });

  const disabled = full || agentTemplates.length === 0;

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
        <ServerCan action='database-instances.create'>
          <ConditionalTooltip
            enabled={disabled}
            label={
              full
                ? t('pages.server.databases.tooltip.limitReached', {
                    max: server.featureLimits.databases,
                  })
                : t('pages.server.databases.instance.modal.createDatabaseInstance.form.noTemplatesFound', {})
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
      registry={window.extensionContext.extensionRegistry.pages.server.databases.instances.container}
    >
      <DatabaseInstanceCreateModal opened={createOpen} onClose={() => setCreateOpen(false)} />

      <DatabasesSubNavigation />

      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('common.table.columns.type', {}),
          t('common.table.columns.address', {}),
          t('common.form.memory', {}),
          t('common.form.disk', {}),
          t('pages.server.databases.table.columns.locked', {}),
          '',
        ]}
        loading={loading}
        pagination={data}
        onPageSelect={setPage}
        error={error}
      >
        {data?.data.map((instance) => (
          <DatabaseInstanceRow instance={instance} key={instance.uuid} />
        ))}
      </Table>
    </ServerContentContainer>
  );
}
