import { faFilter, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import Button from '@/elements/buttons/Button.tsx';
import UnstyledButton from '@/elements/buttons/UnstyledButton.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import { databaseFilterOperatorLabelMapping, databaseFilterOperatorSymbolMapping } from '@/lib/enums.ts';
import {
  serverDatabaseBrowseFilterSchema,
  serverDatabaseFilterOperator,
  serverDatabaseSchemaTableSchema,
} from '@/lib/schemas/server/databases.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type BrowseFilter = z.infer<typeof serverDatabaseBrowseFilterSchema>;
type FilterOperator = z.infer<typeof serverDatabaseFilterOperator>;

const BINARY_OPERATORS: FilterOperator[] = ['eq', 'ne', 'is_null', 'not_null'];
const NULL_OPERATORS: FilterOperator[] = ['is_null', 'not_null'];

export const parseFilters = (raw: string | null): BrowseFilter[] => {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .flatMap((entry) => {
        const result = serverDatabaseBrowseFilterSchema.safeParse(
          Array.isArray(entry) && entry.length === 3 ? { column: entry[0], operator: entry[1], value: entry[2] } : null,
        );

        return result.success ? [result.data] : [];
      })
      .slice(0, 10);
  } catch {
    return [];
  }
};

export const serializeFilters = (filters: BrowseFilter[]): string =>
  JSON.stringify(filters.map((filter) => [filter.column, filter.operator, filter.value]));

function FilterForm({
  table,
  initial,
  onApply,
}: {
  table: z.infer<typeof serverDatabaseSchemaTableSchema>;
  initial?: BrowseFilter;
  onApply: (filter: BrowseFilter) => void;
}) {
  const { t } = useTranslations();
  const [column, setColumn] = useState(initial?.column ?? table.columns[0]?.name ?? '');
  const [operator, setOperator] = useState<FilterOperator>(initial?.operator ?? 'eq');
  const [value, setValue] = useState(initial?.value ?? '');

  const binary = table.columns.find((entry) => entry.name === column)?.binary ?? false;
  const operators = serverDatabaseFilterOperator.options.filter((entry) => !binary || BINARY_OPERATORS.includes(entry));
  const needsValue = !NULL_OPERATORS.includes(operator);

  const pickColumn = (name: string) => {
    setColumn(name);

    if ((table.columns.find((entry) => entry.name === name)?.binary ?? false) && !BINARY_OPERATORS.includes(operator)) {
      setOperator('eq');
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (column) {
          onApply({ column, operator, value: needsValue ? value : null });
        }
      }}
    >
      <Stack gap='xs' w={260}>
        <Select
          label={t('pages.server.databases.explorer.filter.column', {})}
          searchable
          comboboxProps={{ withinPortal: false }}
          data={table.columns.map((entry) => entry.name)}
          value={column}
          onChange={(next) => next && pickColumn(next)}
        />
        <Select
          label={t('pages.server.databases.explorer.filter.operator', {})}
          comboboxProps={{ withinPortal: false }}
          data={operators.map((entry) => ({
            value: entry,
            label: databaseFilterOperatorLabelMapping[entry](),
          }))}
          value={operator}
          onChange={(next) => next && setOperator(next as FilterOperator)}
        />
        {needsValue && (
          <TextInput
            label={t('pages.server.databases.explorer.filter.value', {})}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        )}
        <Button type='submit'>{t('pages.server.databases.explorer.filter.apply', {})}</Button>
      </Stack>
    </form>
  );
}

export default function DatabaseTableFilters({
  table,
  filters,
  onChange,
}: {
  table: z.infer<typeof serverDatabaseSchemaTableSchema>;
  filters: BrowseFilter[];
  onChange: (filters: BrowseFilter[]) => void;
}) {
  const { t } = useTranslations();
  const [open, setOpen] = useState<number | 'add' | null>(null);

  const chipLabel = (filter: BrowseFilter) => {
    const symbol = databaseFilterOperatorSymbolMapping[filter.operator];
    const operator = symbol ?? databaseFilterOperatorLabelMapping[filter.operator]().toLowerCase();

    return filter.value === null ? `${filter.column} ${operator}` : `${filter.column} ${operator} ${filter.value}`;
  };

  return (
    <>
      {filters.map((filter, index) => (
        <Popover
          key={`${index}-${chipLabel(filter)}`}
          opened={open === index}
          onDismiss={() => setOpen(null)}
          position='bottom-start'
          shadow='md'
        >
          <Popover.Target>
            <UnstyledButton
              onClick={() => setOpen(open === index ? null : index)}
              className='flex items-center gap-1.5 rounded-md border border-(--mantine-color-default-border) bg-(--mantine-color-default) px-2 py-1'
            >
              <span className='font-mono text-sm max-w-64 truncate'>{chipLabel(filter)}</span>
              <FontAwesomeIcon
                icon={faXmark}
                size='sm'
                className='text-(--mantine-color-dimmed) hover:text-(--mantine-color-text)'
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(null);
                  onChange(filters.filter((_, at) => at !== index));
                }}
              />
            </UnstyledButton>
          </Popover.Target>
          <Popover.Dropdown>
            <FilterForm
              table={table}
              initial={filter}
              onApply={(next) => {
                setOpen(null);
                onChange(filters.map((entry, at) => (at === index ? next : entry)));
              }}
            />
          </Popover.Dropdown>
        </Popover>
      ))}

      <Popover opened={open === 'add'} onDismiss={() => setOpen(null)} position='bottom-start' shadow='md'>
        <Popover.Target>
          <Button
            variant='default'
            leftSection={<FontAwesomeIcon icon={faFilter} />}
            onClick={() => setOpen(open === 'add' ? null : 'add')}
          >
            {t('pages.server.databases.explorer.filter.add', {})}
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <FilterForm
            table={table}
            onApply={(next) => {
              setOpen(null);
              onChange([...filters, next]);
            }}
          />
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
