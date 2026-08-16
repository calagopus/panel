import { faPencil, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import Stack from '@/elements/Stack.tsx';
import Table from '@/elements/Table.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { serverDatabaseSchemaTableSchema } from '@/lib/schemas/server/databases.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseColumnRow from './DatabaseColumnRow.tsx';
import { tableIdentity } from './DatabaseSchemaPanel.tsx';
import { clearRowParams } from './DatabaseTableRows.tsx';
import ColumnCreateModal from './modals/ColumnCreateModal.tsx';
import TableDeleteModal from './modals/TableDeleteModal.tsx';
import TableRenameModal from './modals/TableRenameModal.tsx';

export default function DatabaseTableStructure({ table }: { table: z.infer<typeof serverDatabaseSchemaTableSchema> }) {
  const { t } = useTranslations();
  const { can } = useDatabaseExplorer();
  const canEditStructure = can('edit-structure');
  const canDeleteStructure = can('delete-structure');

  const [openModal, setOpenModal] = useState<'addColumn' | 'rename' | 'delete' | null>(null);
  const [, setSearchParams] = useSearchParams();

  const actionable = !table.view;

  return (
    <Stack gap='sm'>
      {actionable && (
        <>
          <ColumnCreateModal table={table} opened={openModal === 'addColumn'} onClose={() => setOpenModal(null)} />
          <TableRenameModal
            table={table}
            opened={openModal === 'rename'}
            onClose={() => setOpenModal(null)}
            onRenamed={(name) =>
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('table', table.schema ? `${table.schema}.${name}` : name);

                  return next;
                },
                { replace: true },
              )
            }
          />
          <TableDeleteModal
            table={table}
            opened={openModal === 'delete'}
            onClose={() => setOpenModal(null)}
            onDeleted={() =>
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('table');
                  clearRowParams(next);

                  return next;
                },
                { replace: true },
              )
            }
          />
        </>
      )}

      <Group justify='space-between'>
        <Text size='sm' fw={500} ff='monospace' className='max-w-64 truncate'>
          {tableIdentity(table)}
        </Text>
        {actionable && (
          <Group gap='sm'>
            {canEditStructure && (
              <Tooltip label={t('pages.server.databases.explorer.button.renameTable', {})}>
                <ActionIcon variant='default' size='input-sm' onClick={() => setOpenModal('rename')}>
                  <FontAwesomeIcon icon={faPencil} />
                </ActionIcon>
              </Tooltip>
            )}
            {canDeleteStructure && (
              <Tooltip label={t('pages.server.databases.explorer.button.deleteTable', {})}>
                <ActionIcon variant='default' size='input-sm' c='red' onClick={() => setOpenModal('delete')}>
                  <FontAwesomeIcon icon={faTrash} />
                </ActionIcon>
              </Tooltip>
            )}
            {canEditStructure && (
              <Button
                color='blue'
                onClick={() => setOpenModal('addColumn')}
                leftSection={<FontAwesomeIcon icon={faPlus} />}
              >
                {t('pages.server.databases.explorer.button.addColumn', {})}
              </Button>
            )}
          </Group>
        )}
      </Group>

      <Table
        columns={[
          t('common.table.columns.name', {}),
          t('common.table.columns.type', {}),
          t('pages.server.databases.explorer.table.columns.nullable', {}),
          t('pages.server.databases.explorer.table.columns.key', {}),
          t('pages.server.databases.explorer.table.columns.default', {}),
          t('pages.server.databases.explorer.table.columns.attributes', {}),
          ...(actionable ? [''] : []),
        ]}
      >
        {table.columns.map((column) => (
          <DatabaseColumnRow key={column.name} table={table} column={column} />
        ))}
      </Table>
    </Stack>
  );
}
