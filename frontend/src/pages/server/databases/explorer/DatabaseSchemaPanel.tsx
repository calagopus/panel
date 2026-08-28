import { faPlus, faSearch, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Badge from '@/elements/Badge.tsx';
import Divider from '@/elements/Divider.tsx';
import Group from '@/elements/Group.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import NavLink from '@/elements/NavLink.tsx';
import Paper from '@/elements/Paper.tsx';
import ScrollArea from '@/elements/ScrollArea.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { serverDatabaseSchemaTableSchema } from '@/lib/schemas/server/databases.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export function tableIdentity(table: z.infer<typeof serverDatabaseSchemaTableSchema>): string {
  return table.schema ? `${table.schema}.${table.name}` : table.name;
}

export default function DatabaseSchemaPanel({
  tables,
  truncated = false,
  loading,
  selected,
  onSelect,
  onCreateTable,
}: {
  tables: z.infer<typeof serverDatabaseSchemaTableSchema>[];
  truncated?: boolean;
  loading: boolean;
  selected: z.infer<typeof serverDatabaseSchemaTableSchema> | null;
  onSelect: (table: z.infer<typeof serverDatabaseSchemaTableSchema>) => void;
  onCreateTable?: () => void;
}) {
  const { t, tItem } = useTranslations();
  const [search, setSearch] = useState('');

  const filtered = tables.filter((table) => tableIdentity(table).toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Paper withBorder radius='md' className='flex flex-col overflow-hidden'>
      <div className='flex items-center justify-between px-3 py-2.5 bg-(--mantine-color-default)'>
        <Text size='xs' fw={600} c='dimmed' tt='uppercase' style={{ letterSpacing: '0.05em' }}>
          {t('pages.server.databases.explorer.schema.title', {})}
        </Text>
        {onCreateTable && (
          <Tooltip label={t('pages.server.databases.explorer.button.newTable', {})}>
            <ActionIcon variant='subtle' color='gray' size='sm' onClick={onCreateTable}>
              <FontAwesomeIcon icon={faPlus} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>
      <Divider />
      <div className='p-2'>
        <TextInput
          placeholder={t('common.input.search', {})}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<FontAwesomeIcon icon={faSearch} />}
        />
      </div>
      {truncated && (
        <div className='px-2 pb-2'>
          <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
            {t('pages.server.databases.explorer.schema.truncated', { tables: tables.length })}
          </Alert>
        </div>
      )}
      <Divider />
      <ScrollArea className='flex-1' mah='max(20rem, calc(100dvh - 26rem))' type='auto'>
        <Stack gap={0} p='xs'>
          {!loading && tables.length === 0 && (
            <Text size='sm' c='dimmed' p='xs'>
              {t('pages.server.databases.explorer.schema.empty', {})}
            </Text>
          )}
          {!loading && tables.length > 0 && filtered.length === 0 && (
            <Text size='sm' c='dimmed' p='xs'>
              {truncated
                ? t('pages.server.databases.explorer.schema.noMatchesTruncated', { tables: tables.length })
                : t('pages.server.databases.explorer.schema.noMatches', {})}
            </Text>
          )}
          {filtered.map((table) => (
            <NavLink
              key={tableIdentity(table)}
              label={tableIdentity(table)}
              active={selected !== null && tableIdentity(selected) === tableIdentity(table)}
              onClick={() => onSelect(table)}
              rightSection={
                <Group gap={6} wrap='nowrap'>
                  {table.view && (
                    <Badge color='gray' size='xs'>
                      {t('pages.server.databases.explorer.schema.badge.view', {})}
                    </Badge>
                  )}
                  {table.rowEstimate !== null && (
                    <Text size='xs' c='dimmed'>
                      {t('pages.server.databases.explorer.schema.rowEstimate', {
                        rows: tItem('row', table.rowEstimate),
                      })}
                    </Text>
                  )}
                </Group>
              }
              styles={{
                label: {
                  fontSize: 'var(--mantine-font-size-sm)',
                  fontFamily: 'var(--mantine-font-family-monospace)',
                },
              }}
            />
          ))}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}
