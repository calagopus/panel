import { faAnglesLeft, faAnglesRight, faCode, faTable, faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Group from '@/elements/layout/Group.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Tabs from '@/elements/layout/Tabs.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { serverDatabaseSchemaTableSchema } from '@/lib/schemas/server/databases.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseQueryConsole from './DatabaseQueryConsole.tsx';
import DatabaseSchemaPanel, { tableIdentity } from './DatabaseSchemaPanel.tsx';
import DatabaseTableRows, { clearRowParams } from './DatabaseTableRows.tsx';
import DatabaseTableStructure from './DatabaseTableStructure.tsx';
import TableCreateModal from './modals/TableCreateModal.tsx';

export default function DatabaseExplorer() {
  const { t } = useTranslations();
  const { api, keys, can, engine, typeLabel, name } = useDatabaseExplorer();
  const canQueryRaw = can('query-raw');
  const canEditStructure = can('edit-structure');
  const [searchParams, setSearchParams] = useSearchParams();

  const [schemaOpen, setSchemaOpen] = useState(true);
  const [openModal, setOpenModal] = useState<'createTable' | null>(null);

  const { data: schema, loading } = useResource({
    queryKey: keys.schema,
    queryFn: api.getSchema,
  });

  const tables = schema?.tables ?? [];
  const truncated = schema?.truncated ?? false;

  const requested = searchParams.get('table');
  const missing = requested !== null && !tables.some((entry) => tableIdentity(entry) === requested);
  const beyondCap = missing && truncated;
  const table = beyondCap ? null : (tables.find((entry) => tableIdentity(entry) === requested) ?? tables[0] ?? null);

  useEffect(() => {
    if (loading || !table || requested === tableIdentity(table)) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('table', tableIdentity(table));

        return next;
      },
      { replace: true },
    );
  }, [loading, requested, table]);

  const selectTable = (selected: z.infer<typeof serverDatabaseSchemaTableSchema>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('table', tableIdentity(selected));
      clearRowParams(next);

      return next;
    });

    if (window.matchMedia('(pointer: coarse)').matches) {
      setSchemaOpen(false);
    }
  };

  const emptyMessage = beyondCap
    ? t('pages.server.databases.explorer.schema.tableBeyondLimit', { tables: tables.length })
    : loading
      ? t('pages.server.databases.explorer.rows.noTable', {})
      : t('pages.server.databases.explorer.schema.empty', {});

  const draftRef = useRef('');

  return (
    <ServerContentContainer title={name} hideTitleComponent>
      {canEditStructure && (
        <TableCreateModal
          opened={openModal === 'createTable'}
          onClose={() => setOpenModal(null)}
          onCreated={(created) =>
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('table', engine === 'postgres' ? `public.${created}` : created);
              clearRowParams(next);

              return next;
            })
          }
        />
      )}
      <Stack gap='lg'>
        <Group gap='md'>
          <Title order={1}>{name}</Title>
          <Badge color='blue' size='lg'>
            {typeLabel}
          </Badge>
        </Group>

        <div className='flex flex-col xl:flex-row gap-4 items-start'>
          {schemaOpen && (
            <div className='w-full xl:w-72 xl:shrink-0 xl:sticky xl:top-4'>
              <DatabaseSchemaPanel
                tables={tables}
                truncated={truncated}
                loading={loading}
                selected={table}
                onSelect={selectTable}
                onCreateTable={canEditStructure ? () => setOpenModal('createTable') : undefined}
              />
            </div>
          )}

          <div className='w-full flex-1 min-w-0'>
            <Tabs defaultValue='rows' keepMounted={false}>
              <Tabs.List>
                <Tooltip
                  label={t(
                    schemaOpen
                      ? 'pages.server.databases.explorer.button.hideTables'
                      : 'pages.server.databases.explorer.button.showTables',
                    {},
                  )}
                >
                  <ActionIcon
                    variant='subtle'
                    color='gray'
                    className='mr-1 self-center'
                    onClick={() => setSchemaOpen((open) => !open)}
                  >
                    <FontAwesomeIcon icon={schemaOpen ? faAnglesLeft : faAnglesRight} />
                  </ActionIcon>
                </Tooltip>
                <Tabs.Tab value='rows' leftSection={<FontAwesomeIcon icon={faTable} />}>
                  {t('pages.server.databases.explorer.tabs.rows', {})}
                </Tabs.Tab>
                <Tabs.Tab value='structure' leftSection={<FontAwesomeIcon icon={faTableColumns} />}>
                  {t('pages.server.databases.explorer.tabs.structure', {})}
                </Tabs.Tab>
                {canQueryRaw && (
                  <Tabs.Tab value='query' leftSection={<FontAwesomeIcon icon={faCode} />}>
                    {t('pages.server.databases.explorer.tabs.query', {})}
                  </Tabs.Tab>
                )}
              </Tabs.List>

              <Tabs.Panel value='rows' pt='xs'>
                {table ? (
                  <DatabaseTableRows key={tableIdentity(table)} table={table} />
                ) : (
                  <Text size='sm' c='dimmed'>
                    {emptyMessage}
                  </Text>
                )}
              </Tabs.Panel>

              <Tabs.Panel value='structure' pt='xs'>
                {table ? (
                  <DatabaseTableStructure key={tableIdentity(table)} table={table} />
                ) : (
                  <Text size='sm' c='dimmed'>
                    {emptyMessage}
                  </Text>
                )}
              </Tabs.Panel>

              {canQueryRaw && (
                <Tabs.Panel value='query' pt='xs'>
                  <DatabaseQueryConsole draftRef={draftRef} />
                </Tabs.Panel>
              )}
            </Tabs>
          </div>
        </div>
      </Stack>
    </ServerContentContainer>
  );
}
