import { faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Group from '@/elements/Group.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import { serverDatabaseSchemaColumnSchema, serverDatabaseSchemaTableSchema } from '@/lib/schemas/server/databases.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { parseFilters, serializeFilters } from './DatabaseTableFilters.tsx';
import { clearRowParams } from './DatabaseTableRows.tsx';
import ColumnDeleteModal from './modals/ColumnDeleteModal.tsx';
import ColumnRenameModal from './modals/ColumnRenameModal.tsx';

export default function DatabaseColumnRow({
  table,
  column,
}: {
  table: z.infer<typeof serverDatabaseSchemaTableSchema>;
  column: z.infer<typeof serverDatabaseSchemaColumnSchema>;
}) {
  const { t } = useTranslations();
  const { can } = useDatabaseExplorer();
  const [openModal, setOpenModal] = useState<'rename' | 'delete' | null>(null);
  const [, setSearchParams] = useSearchParams();

  const clearStaleSort = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        let changed = false;

        if (prev.get('sort') === column.name) {
          clearRowParams(next);
          changed = true;
        }

        const filters = parseFilters(prev.get('filters'));
        const kept = filters.filter((filter) => filter.column !== column.name);
        if (kept.length !== filters.length) {
          if (kept.length > 0) {
            next.set('filters', serializeFilters(kept));
          } else {
            next.delete('filters');
          }
          next.delete('page');
          changed = true;
        }

        return changed ? next : prev;
      },
      { replace: true },
    );
  };

  return (
    <>
      <ColumnRenameModal
        table={table}
        column={column}
        opened={openModal === 'rename'}
        onClose={() => setOpenModal(null)}
        onRenamed={clearStaleSort}
      />
      <ColumnDeleteModal
        table={table}
        column={column}
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        onDeleted={clearStaleSort}
      />

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPencil,
            label: t('pages.server.databases.explorer.button.rename', {}),
            onClick: () => setOpenModal('rename'),
            color: 'gray',
            canAccess: can('edit-structure'),
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: can('delete-structure'),
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={
              table.view
                ? undefined
                : (e) => {
                    e.preventDefault();
                    openMenu(e.clientX, e.clientY);
                  }
            }
          >
            <TableData>{column.name}</TableData>
            <TableData>
              <Code>{column.typeName}</Code>
            </TableData>
            <TableData>{t(column.nullable ? 'common.yes' : 'common.no', {})}</TableData>
            <TableData>
              {column.primaryKey && (
                <Badge color='blue' size='xs'>
                  {t('pages.server.databases.explorer.badge.primaryKey', {})}
                </Badge>
              )}
            </TableData>
            <TableData>{column.default}</TableData>
            <TableData>
              <Group gap={6} wrap='nowrap'>
                {column.autoIncrement && (
                  <Badge color='grape' size='xs'>
                    {t('pages.server.databases.explorer.badge.autoIncrement', {})}
                  </Badge>
                )}
                {column.generated && (
                  <Badge color='gray' size='xs'>
                    {t('pages.server.databases.explorer.badge.generated', {})}
                  </Badge>
                )}
                {column.binary && (
                  <Badge color='gray' size='xs'>
                    {t('pages.server.databases.explorer.badge.binary', {})}
                  </Badge>
                )}
              </Group>
            </TableData>
            {!table.view && <ContextMenuToggle items={items} openMenu={openMenu} />}
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
