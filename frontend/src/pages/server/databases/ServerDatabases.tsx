import { faPlus, faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Group } from '@mantine/core';
import { ReactNode, useState } from 'react';
import getDatabaseHosts from '@/api/server/databases/getDatabaseHosts.ts';
import getDatabases from '@/api/server/databases/getDatabases.ts';
import getDatabaseInstances from '@/api/server/databases/instances/getDatabaseInstances.ts';
import getDatabaseInstanceTemplates from '@/api/server/databases/instances/getDatabaseInstanceTemplates.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ConditionalTooltip from '@/elements/ConditionalTooltip.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Table from '@/elements/Table.tsx';
import Text from '@/elements/Text.tsx';
import Title from '@/elements/Title.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseRow from './DatabaseRow.tsx';
import DatabaseInstanceRow from './instances/DatabaseInstanceRow.tsx';
import DatabaseInstanceCreateModal from './instances/modals/DatabaseInstanceCreateModal.tsx';
import DatabaseCreateModal from './modals/DatabaseCreateModal.tsx';

function SectionHeader({
  title,
  subtitle,
  search,
  setSearch,
  action,
}: {
  title: string;
  subtitle: string;
  search: string;
  setSearch: (value: string) => void;
  action: ReactNode;
}) {
  const { t } = useTranslations();

  return (
    <Group justify='space-between' mb='md'>
      <div>
        <Title order={2}>{title}</Title>
        <Text size='xs' c='dimmed'>
          {subtitle}
        </Text>
      </div>
      <Group>
        <TextInput
          placeholder={t('common.input.search', {})}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<FontAwesomeIcon icon={faSearch} />}
          w={250}
        />
        {action}
      </Group>
    </Group>
  );
}

export default function ServerDatabases() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);

  const canReadClassic = useServerCan('databases.read');
  const canReadAgent = useServerCan('database-instances.read');

  const [openModal, setOpenModal] = useState<'create-classic' | 'create-agent' | null>(null);

  const {
    data: databases,
    loading,
    error,
    search,
    setSearch,
    setPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).databases.all(),
    fetcher: (page, search) => getDatabases(server.uuid, page, search),
    canRequest: canReadClassic,
  });

  const {
    data: instances,
    loading: agentsLoading,
    error: agentsError,
    search: agentSearch,
    setSearch: setAgentSearch,
    setPage: setAgentsPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.server(server.uuid).databases.instances.all(),
    fetcher: (page, search) => getDatabaseInstances(server.uuid, page, search),
    canRequest: canReadAgent,
    modifyParams: false,
  });

  const used = (databases?.total ?? 0) + (instances?.total ?? 0);
  const full = used >= server.featureLimits.databases;

  const { data: databaseHosts = [] } = useResource({
    queryKey: queryKeys.server(server.uuid).databases.hosts(),
    queryFn: () => getDatabaseHosts(server.uuid),
    enabled: canReadClassic && !full,
    silent: true,
  });

  const { data: agentTemplates = [] } = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.templates(),
    queryFn: () => getDatabaseInstanceTemplates(server.uuid),
    enabled: canReadAgent && !full,
    silent: true,
  });

  const limitReachedLabel = t('pages.server.databases.tooltip.limitReached', {
    max: server.featureLimits.databases,
  });

  const classicDisabled = full || databaseHosts.length === 0;
  const agentDisabled = full || agentTemplates.length === 0;

  const classicRelevant = canReadClassic && ((databases?.total ?? 0) > 0 || databaseHosts.length > 0);
  const agentRelevant = canReadAgent && ((instances?.total ?? 0) > 0 || agentTemplates.length > 0);
  const split = classicRelevant && agentRelevant;
  const soloKind = classicRelevant
    ? 'classic'
    : agentRelevant
      ? 'agent'
      : canReadClassic
        ? 'classic'
        : canReadAgent
          ? 'agent'
          : null;

  const classicCreateButton = (
    <ServerCan action='databases.create'>
      <ConditionalTooltip
        enabled={classicDisabled}
        label={full ? limitReachedLabel : t('pages.server.databases.modal.createDatabase.form.noHostsFound', {})}
      >
        <Button
          disabled={classicDisabled}
          onClick={() => setOpenModal('create-classic')}
          color='blue'
          leftSection={<FontAwesomeIcon icon={faPlus} />}
        >
          {t('pages.server.databases.modal.createDatabase.title', {})}
        </Button>
      </ConditionalTooltip>
    </ServerCan>
  );

  const agentCreateButton = (
    <ServerCan action='database-instances.create'>
      <ConditionalTooltip
        enabled={agentDisabled}
        label={
          full
            ? limitReachedLabel
            : t('pages.server.databases.instance.modal.createDatabaseInstance.form.noTemplatesFound', {})
        }
      >
        <Button
          disabled={agentDisabled}
          onClick={() => setOpenModal('create-agent')}
          color='blue'
          leftSection={<FontAwesomeIcon icon={faPlus} />}
        >
          {t('pages.server.databases.instance.modal.createDatabaseInstance.title', {})}
        </Button>
      </ConditionalTooltip>
    </ServerCan>
  );

  const classicTable = (
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
      pagination={databases}
      onPageSelect={setPage}
      error={error}
    >
      {databases?.data.map((database) => (
        <DatabaseRow database={database} key={database.uuid} />
      ))}
    </Table>
  );

  const agentTable = (
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
      loading={agentsLoading}
      pagination={instances}
      onPageSelect={setAgentsPage}
      error={agentsError}
    >
      {instances?.data.map((instance) => (
        <DatabaseInstanceRow instance={instance} key={instance.uuid} />
      ))}
    </Table>
  );

  const modals = (
    <>
      <DatabaseCreateModal opened={openModal === 'create-classic'} onClose={() => setOpenModal(null)} />
      <DatabaseInstanceCreateModal opened={openModal === 'create-agent'} onClose={() => setOpenModal(null)} />
    </>
  );

  if (!split) {
    const solo = soloKind === 'agent' ? 'agent' : 'classic';

    return (
      <ServerContentContainer
        title={t('pages.server.databases.title', {})}
        subtitle={t('pages.server.databases.subtitle', {
          current: used,
          max: server.featureLimits.databases,
        })}
        search={solo === 'agent' ? agentSearch : search}
        setSearch={solo === 'agent' ? setAgentSearch : setSearch}
        contentRight={soloKind ? (solo === 'agent' ? agentCreateButton : classicCreateButton) : undefined}
        registry={window.extensionContext.extensionRegistry.pages.server.databases.container}
      >
        {modals}
        {soloKind ? (solo === 'agent' ? agentTable : classicTable) : null}
      </ServerContentContainer>
    );
  }

  return (
    <ServerContentContainer
      title={t('pages.server.databases.title', {})}
      subtitle={t('pages.server.databases.subtitle', {
        current: used,
        max: server.featureLimits.databases,
      })}
      registry={window.extensionContext.extensionRegistry.pages.server.databases.container}
    >
      {modals}

      <div className='mb-8'>
        <SectionHeader
          title={t('pages.server.databases.classic.title', {})}
          subtitle={t('pages.server.databases.classic.subtitle', { current: databases?.total ?? 0 })}
          search={search}
          setSearch={setSearch}
          action={classicCreateButton}
        />
        {classicTable}
      </div>

      <div>
        <SectionHeader
          title={t('pages.server.databases.instance.title', {})}
          subtitle={t('pages.server.databases.instance.subtitle', { current: instances?.total ?? 0 })}
          search={agentSearch}
          setSearch={setAgentSearch}
          action={agentCreateButton}
        />
        {agentTable}
      </div>
    </ServerContentContainer>
  );
}
