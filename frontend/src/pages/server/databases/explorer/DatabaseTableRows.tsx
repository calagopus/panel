import { faChevronLeft, faChevronRight, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import {
  serverDatabaseBrowseFilterSchema,
  serverDatabaseQueryResultSchema,
  serverDatabaseQueryValueSchema,
  serverDatabaseSchemaTableSchema,
} from '@/lib/schemas/server/databases.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useSelectionArea } from '@/plugins/useSelectionArea.ts';
import { useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseResultSet from './DatabaseResultSet.tsx';
import { tableIdentity } from './DatabaseSchemaPanel.tsx';
import DatabaseTableFilters, { parseFilters, serializeFilters } from './DatabaseTableFilters.tsx';

const ROWS_PER_PAGE = 50;

export function clearRowParams(params: URLSearchParams) {
  params.delete('sort');
  params.delete('desc');
  params.delete('page');
}

export default function DatabaseTableRows({ table }: { table: z.infer<typeof serverDatabaseSchemaTableSchema> }) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const { api, keys, can } = useDatabaseExplorer();
  const [searchParams, setSearchParams] = useSearchParams();
  const canEdit = can('edit-rows');

  const [edits, setEdits] = useState<Record<number, Record<string, z.infer<typeof serverDatabaseQueryValueSchema>>>>(
    {},
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [ghosts, setGhosts] = useState<Record<string, z.infer<typeof serverDatabaseQueryValueSchema>>[]>([]);
  const [saving, setSaving] = useState(false);
  const [openModal, setOpenModal] = useState<'deleteRows' | null>(null);

  const orderBy = searchParams.get('sort');
  const descending = searchParams.get('desc') === '1';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const filtersParam = searchParams.get('filters');
  const filters = parseFilters(filtersParam);

  const setParams = (apply: (next: URLSearchParams) => void) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        apply(next);

        return next;
      },
      { replace: true },
    );
  };

  const setPage = (next: number) =>
    setParams((params) => (next > 1 ? params.set('page', next.toString()) : params.delete('page')));

  const setFilters = (next: z.infer<typeof serverDatabaseBrowseFilterSchema>[]) =>
    setParams((params) => {
      if (next.length > 0) {
        params.set('filters', serializeFilters(next));
      } else {
        params.delete('filters');
      }

      params.delete('page');
    });

  const options = {
    schema: table.schema,
    table: table.name,
    orderBy,
    descending,
    offset: (page - 1) * ROWS_PER_PAGE,
    filters,
  };

  const {
    data: result,
    loading,
    error,
    invalidate,
  } = useResource({
    queryKey: [...keys.rows, options],
    queryFn: () => api.browseRows({ ...options, limit: ROWS_PER_PAGE }),
    keepPrevious: true,
  });

  const primaryKey = table.columns.filter((column) => column.primaryKey);
  const rowsEditable = canEdit && !table.view && primaryKey.length > 0;
  const editableColumns = new Set(
    rowsEditable ? table.columns.filter((column) => !column.generated).map((column) => column.name) : [],
  );
  const editedCells = Object.values(edits).reduce((total, row) => total + Object.keys(row).length, 0);
  const dirtyCount = editedCells + ghosts.length;

  const fallback: z.infer<typeof serverDatabaseQueryResultSchema> = {
    columns: table.columns.map((column) => ({
      name: column.name,
      typeName: column.typeName,
      binary: column.binary,
    })),
    rows: [],
    rowsAffected: 0,
    truncated: false,
  };

  const base = result?.columns.length ? result : fallback;
  const loaded = dirtyCount
    ? {
        ...base,
        rows: base.rows.map((row, rowIndex) =>
          row.map((value, valueIndex) => edits[rowIndex]?.[base.columns[valueIndex].name] ?? value),
        ),
      }
    : base;

  const { onSelectedStart, onSelected } = useSelectionArea<number>({
    identify: (rowIndex) => rowIndex.toString(),
    getSelected: () => [...selected],
    setSelected: (rows) => setSelected(new Set(rows)),
  });

  const reset = () => {
    setEdits({});
    setGhosts([]);
    setSelected(new Set());
  };

  useEffect(() => {
    reset();
  }, [page, orderBy, descending, filtersParam]);

  const keysFor = (rowIndex: number) =>
    primaryKey.map((column) => {
      const index = base.columns.findIndex((entry) => entry.name === column.name);
      const value = base.rows[rowIndex]?.[index];

      return { column: column.name, value: value && value.type !== 'null' ? value.value : null };
    });

  const runMutation = async (action: () => Promise<number>) => {
    setSaving(true);

    try {
      const affected = await action();
      addToast(t('pages.server.databases.explorer.rows.saved', { rows: tItem('row', affected) }), 'success');
      reset();
      invalidate();
    } catch (err) {
      addToast(httpErrorToHuman(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toPayload = (values: Record<string, z.infer<typeof serverDatabaseQueryValueSchema>>) =>
    Object.entries(values).map(([column, value]) => ({
      column,
      value: value.type === 'null' ? null : value.value,
    }));

  const doSave = () =>
    runMutation(async () => {
      let affected = 0;

      if (ghosts.length > 0) {
        affected += await api.insertRows({
          schema: table.schema,
          table: table.name,
          rows: ghosts.map((values) => ({ values: toPayload(values) })),
        });
      }

      if (editedCells > 0) {
        affected += await api.updateRows({
          schema: table.schema,
          table: table.name,
          rows: Object.entries(edits).map(([rowIndex, values]) => ({
            keys: keysFor(Number(rowIndex)),
            values: toPayload(values),
          })),
        });
      }

      return affected;
    });

  const doDelete = async () => {
    await runMutation(() =>
      api.deleteRows({
        schema: table.schema,
        table: table.name,
        rows: [...selected].map((rowIndex) => ({ keys: keysFor(rowIndex) })),
      }),
    );

    setOpenModal(null);
  };

  const hasPrevious = page > 1 && !loading;
  const hasNext = !loading && loaded.rows.length >= ROWS_PER_PAGE;

  useKeyboardShortcuts({
    shortcuts: [
      { id: 'table.firstPage', callback: () => page > 1 && setPage(1) },
      { id: 'table.previousPage', callback: () => hasPrevious && setPage(page - 1) },
      { id: 'table.nextPage', callback: () => hasNext && setPage(page + 1) },
    ],
  });

  const onSort = (column: string) => {
    setParams((params) => {
      params.set('sort', column);

      if (orderBy === column && !descending) {
        params.set('desc', '1');
      } else {
        params.delete('desc');
      }

      params.delete('page');
    });
  };

  return (
    <Stack gap='sm'>
      <Group justify='space-between'>
        <Group gap='sm'>
          <Text size='sm' fw={500} ff='monospace' className='max-w-64 truncate'>
            {tableIdentity(table)}
          </Text>
          <DatabaseTableFilters table={table} filters={filters} onChange={setFilters} />
        </Group>
        <Group gap='sm'>
          {rowsEditable && (
            <>
              {dirtyCount > 0 && (
                <>
                  <Button color='gray' disabled={saving} onClick={reset}>
                    {t('common.button.discard', {})}
                  </Button>
                  <Button color='blue' loading={saving} onClick={doSave}>
                    {t('pages.server.databases.explorer.button.save', { changes: tItem('change', dirtyCount) })}
                  </Button>
                </>
              )}
              <Button
                color='blue'
                onClick={() => setGhosts((prev) => [...prev, {}])}
                leftSection={<FontAwesomeIcon icon={faPlus} />}
              >
                {t('pages.server.databases.explorer.button.newRow', {})}
              </Button>
              {selected.size > 0 && (
                <Button
                  color='red'
                  loading={saving}
                  onClick={() => setOpenModal('deleteRows')}
                  leftSection={<FontAwesomeIcon icon={faTrash} />}
                >
                  {t('pages.server.databases.explorer.button.deleteRows', { rows: selected.size })}
                </Button>
              )}
            </>
          )}
          <Group gap='xs'>
            <Tooltip label={t('pages.server.databases.explorer.button.previous', {})}>
              <ActionIcon variant='default' size='input-sm' disabled={!hasPrevious} onClick={() => setPage(page - 1)}>
                <FontAwesomeIcon icon={faChevronLeft} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('pages.server.databases.explorer.button.next', {})}>
              <ActionIcon variant='default' size='input-sm' disabled={!hasNext} onClick={() => setPage(page + 1)}>
                <FontAwesomeIcon icon={faChevronRight} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Group>

      <DatabaseResultSet
        key={tableIdentity(table)}
        result={loaded}
        sort={{ orderBy, descending, onSort }}
        editing={
          rowsEditable
            ? {
                editableColumns,
                isDirty: (rowIndex, column) => edits[rowIndex]?.[column] !== undefined,
                onChange: (rowIndex, column, value) =>
                  setEdits((prev) => ({
                    ...prev,
                    [rowIndex]: { ...prev[rowIndex], [column]: value },
                  })),
                selected,
                onSelectRow: (rowIndex, isSelected) =>
                  setSelected((prev) => {
                    if (prev.has(rowIndex) === isSelected) return prev;

                    const next = new Set(prev);
                    if (isSelected) {
                      next.add(rowIndex);
                    } else {
                      next.delete(rowIndex);
                    }

                    return next;
                  }),
                onToggleAll: () =>
                  setSelected((prev) =>
                    prev.size === loaded.rows.length ? new Set() : new Set(loaded.rows.map((_, index) => index)),
                  ),
                onSelectedStart,
                onSelected,
                ghosts,
                ghostPlaceholder: t('pages.server.databases.explorer.rows.insert.default', {}),
                onGhostChange: (index, column, value) =>
                  setGhosts((prev) => prev.map((row, at) => (at === index ? { ...row, [column]: value } : row))),
                onGhostRemove: (index) => setGhosts((prev) => prev.filter((_, at) => at !== index)),
              }
            : undefined
        }
        loading={loading}
        error={error ? httpErrorToHuman(error) : null}
      />

      <Group justify='space-between'>
        <Text size='sm' c='dimmed'>
          {loaded.rows.length > 0
            ? t('pages.server.databases.explorer.rows.range', {
                start: options.offset + 1,
                end: options.offset + loaded.rows.length,
              })
            : ''}
        </Text>
        <Group>
          <Button color='gray' disabled={!hasPrevious} onClick={() => setPage(page - 1)}>
            {t('pages.server.databases.explorer.button.previous', {})}
          </Button>
          <Button color='gray' disabled={!hasNext} onClick={() => setPage(page + 1)}>
            {t('pages.server.databases.explorer.button.next', {})}
          </Button>
        </Group>
      </Group>

      <ConfirmationModal
        opened={openModal === 'deleteRows'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.databases.explorer.modal.deleteRows.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.server.databases.explorer.modal.deleteRows.content', {
          rows: tItem('row', selected.size),
          table: tableIdentity(table),
        }).md()}
      </ConfirmationModal>
    </Stack>
  );
}
