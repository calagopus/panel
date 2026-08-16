import { faChevronDown, faChevronUp, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { MouseEvent as ReactMouseEvent, ReactNode, Ref, useState } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Group from '@/elements/Group.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Stack from '@/elements/Stack.tsx';
import Table, { TableData, TableHeaderProps, TableRow } from '@/elements/Table.tsx';
import Text from '@/elements/Text.tsx';
import { serverDatabaseQueryResultSchema, serverDatabaseQueryValueSchema } from '@/lib/schemas/server/databases.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseResultCell from './DatabaseResultCell.tsx';

export interface DatabaseResultSort {
  orderBy: string | null;
  descending: boolean;
  onSort: (column: string) => void;
}

export interface DatabaseResultEditing {
  editableColumns: Set<string>;
  isDirty: (rowIndex: number, column: string) => boolean;
  onChange: (rowIndex: number, column: string, value: z.infer<typeof serverDatabaseQueryValueSchema>) => void;
  selected: Set<number>;
  onSelectRow: (rowIndex: number, selected: boolean) => void;
  onToggleAll: () => void;
  onSelectedStart: (event: ReactMouseEvent | MouseEvent) => void;
  onSelected: (rows: number[]) => void;
  ghosts: Record<string, z.infer<typeof serverDatabaseQueryValueSchema>>[];
  ghostPlaceholder: string;
  onGhostChange: (index: number, column: string, value: z.infer<typeof serverDatabaseQueryValueSchema>) => void;
  onGhostRemove: (index: number) => void;
}

interface CellPosition {
  ghost: boolean;
  rowIndex: number;
  column: string;
}

function SortIndicator({ active, descending }: { active: boolean; descending: boolean }) {
  return (
    <div className='inline-flex flex-col items-center self-center -mt-0.5'>
      <FontAwesomeIcon
        icon={faChevronUp}
        size='xs'
        className={classNames(
          '-mb-0.5',
          active && !descending ? 'text-(--mantine-color-text)' : 'text-(--mantine-color-dimmed)',
        )}
      />
      <FontAwesomeIcon
        icon={faChevronDown}
        size='xs'
        className={active && descending ? 'text-(--mantine-color-text)' : 'text-(--mantine-color-dimmed)'}
      />
    </div>
  );
}

export default function DatabaseResultSet({
  result,
  sort,
  editing,
  loading,
  error,
}: {
  result: z.infer<typeof serverDatabaseQueryResultSchema>;
  sort?: DatabaseResultSort;
  editing?: DatabaseResultEditing;
  loading?: boolean;
  error?: string | null;
}) {
  const { t, tItem } = useTranslations();
  const [active, setActive] = useState<CellPosition | null>(null);

  if (result.columns.length === 0) {
    return (
      <Text size='sm' c='dimmed'>
        {t('pages.server.databases.explorer.result.rowsAffected', { rows: tItem('row', result.rowsAffected) })}
      </Text>
    );
  }

  const isActive = (position: CellPosition) =>
    active !== null &&
    active.ghost === position.ghost &&
    active.rowIndex === position.rowIndex &&
    active.column === position.column;

  const navigate = (from: CellPosition, delta: 1 | -1) => {
    if (!editing) return;

    const editableOrder = result.columns
      .map((column) => column.name)
      .filter((name) => editing.editableColumns.has(name));
    const rowCount = editing.ghosts.length + result.rows.length;
    const rowPosition = from.ghost ? from.rowIndex : editing.ghosts.length + from.rowIndex;
    const flat = rowPosition * editableOrder.length + editableOrder.indexOf(from.column) + delta;

    if (flat < 0 || flat >= rowCount * editableOrder.length) {
      setActive(null);
      return;
    }

    const nextRow = Math.floor(flat / editableOrder.length);
    const column = editableOrder[flat % editableOrder.length];

    setActive(
      nextRow < editing.ghosts.length
        ? { ghost: true, rowIndex: nextRow, column }
        : { ghost: false, rowIndex: nextRow - editing.ghosts.length, column },
    );
  };

  const cellProps = (position: CellPosition) => ({
    editing: isActive(position),
    onEditingChange: (open: boolean) => setActive(open ? position : isActive(position) ? null : active),
    onNavigate: (delta: 1 | -1) => navigate(position, delta),
  });

  const columns: TableHeaderProps[] = result.columns.map((column) => ({
    name: column.name,
    rightSection: (
      <Group gap={6} wrap='nowrap'>
        <Text size='xs' c='dimmed'>
          {column.typeName}
        </Text>
        {sort && <SortIndicator active={sort.orderBy === column.name} descending={sort.descending} />}
      </Group>
    ),
    onClick: sort ? () => sort.onSort(column.name) : undefined,
  }));

  if (editing) {
    columns.unshift({
      rightSection: (
        <Checkbox
          checked={editing.selected.size > 0 && editing.selected.size === result.rows.length}
          indeterminate={editing.selected.size > 0 && editing.selected.size < result.rows.length}
          onChange={editing.onToggleAll}
        />
      ),
    });
  }

  const table = (
    <Stack gap='xs'>
      {result.truncated && (
        <Alert color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
          {t('pages.server.databases.explorer.result.truncated', {})}
        </Alert>
      )}

      <Table
        columns={columns}
        allowSelect={!editing}
        loading={loading}
        error={error}
        verticalSpacing={4}
        pagination={{
          total: result.rows.length + (editing?.ghosts.length ?? 0),
          perPage: result.rows.length + (editing?.ghosts.length ?? 0),
          page: 1,
          data: result.rows,
        }}
      >
        {editing?.ghosts.map((ghost, ghostIndex) => (
          <TableRow key={`ghost-${ghostIndex}`} bg='var(--mantine-color-green-light)'>
            <TableData>
              <ActionIcon variant='subtle' color='gray' size='sm' onClick={() => editing.onGhostRemove(ghostIndex)}>
                <FontAwesomeIcon icon={faXmark} />
              </ActionIcon>
            </TableData>
            {result.columns.map((column) => (
              <DatabaseResultCell
                key={`ghost-${ghostIndex}-${column.name}`}
                value={ghost[column.name]}
                placeholder={editing.ghostPlaceholder}
                editable={editing.editableColumns.has(column.name)}
                onChange={(next) => editing.onGhostChange(ghostIndex, column.name, next)}
                {...cellProps({ ghost: true, rowIndex: ghostIndex, column: column.name })}
              />
            ))}
          </TableRow>
        ))}

        {result.rows.map((row, rowIndex) => (
          <Row
            key={`row-${rowIndex}`}
            rowIndex={rowIndex}
            selectable={!!editing}
            selected={editing?.selected.has(rowIndex)}
          >
            {editing && (
              <TableData>
                <Checkbox
                  checked={editing.selected.has(rowIndex)}
                  onChange={(event) => editing.onSelectRow(rowIndex, event.currentTarget.checked)}
                />
              </TableData>
            )}
            {row.map((value, valueIndex) => {
              const column = result.columns[valueIndex].name;

              return (
                <DatabaseResultCell
                  key={`value-${valueIndex}`}
                  value={value}
                  editable={editing?.editableColumns.has(column)}
                  dirty={editing?.isDirty(rowIndex, column)}
                  onChange={(next) => editing?.onChange(rowIndex, column, next)}
                  {...cellProps({ ghost: false, rowIndex, column })}
                />
              );
            })}
          </Row>
        ))}
      </Table>
    </Stack>
  );

  if (!editing) {
    return table;
  }

  return (
    <SelectionArea onSelectedStart={editing.onSelectedStart} onSelected={editing.onSelected}>
      {table}
    </SelectionArea>
  );
}

function Row({
  rowIndex,
  selectable,
  selected,
  children,
}: {
  rowIndex: number;
  selectable: boolean;
  selected?: boolean;
  children: ReactNode;
}) {
  const bg = selected ? 'var(--mantine-color-blue-light)' : undefined;

  if (!selectable) {
    return <TableRow>{children}</TableRow>;
  }

  return (
    <SelectionArea.Selectable item={rowIndex}>
      {(ref) => (
        <TableRow ref={ref as Ref<HTMLTableRowElement>} bg={bg}>
          {children}
        </TableRow>
      )}
    </SelectionArea.Selectable>
  );
}
