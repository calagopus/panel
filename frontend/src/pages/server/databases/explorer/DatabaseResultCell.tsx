import { faBan, faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import { TableData } from '@/elements/data-display/Table.tsx';
import DatePicker from '@/elements/input/DatePicker.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import Select from '@/elements/input/Select.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import TimePicker from '@/elements/input/TimePicker.tsx';
import YearPicker from '@/elements/input/YearPicker.tsx';
import Group from '@/elements/layout/Group.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Code from '@/elements/typography/Code.tsx';
import Kbd from '@/elements/typography/Kbd.tsx';
import Text from '@/elements/typography/Text.tsx';
import { serverDatabaseQueryValueSchema, serverDatabaseSchemaColumnSchema } from '@/lib/schemas/server/databases.ts';
import { DatabaseExplorerContextType, useDatabaseExplorer } from '@/providers/contexts/databaseExplorerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Value = z.infer<typeof serverDatabaseQueryValueSchema>;
type Column = z.infer<typeof serverDatabaseSchemaColumnSchema>;
type PickerKind = 'date' | 'datetime' | 'time' | 'year';

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATETIME_PATTERN = /^(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])) (\d{2}:\d{2}:\d{2})(\.\d+)?(.*)$/;
const TIME_PATTERN = /^(\d{2}:\d{2}:\d{2})(\.\d+)?(.*)$/;
const YEAR_PATTERN = /^\d{4}$/;

const pickerKind = (column: Column): PickerKind | null => {
  const type = column.typeName.trim().toLowerCase();

  if (/^(datetime|timestamp)\b/.test(type)) return 'datetime';
  if (type === 'date') return 'date';
  if (/^time\b/.test(type)) return 'time';
  if (/^year\b/.test(type)) return 'year';

  return null;
};

const booleanValues = (column: Column, engine: DatabaseExplorerContextType['engine']): [string, string] | null => {
  const type = column.typeName.trim().toLowerCase();

  if (engine === 'postgres') return type === 'boolean' ? ['f', 't'] : null;
  if (engine === 'mysql') return type.startsWith('tinyint(1)') ? ['0', '1'] : null;

  return type.startsWith('bool') ? ['0', '1'] : null;
};

function ValuePicker({
  kind,
  value,
  onChange,
}: {
  kind: PickerKind;
  value: string;
  onChange: (value: string) => void;
}) {
  if (kind === 'year') {
    return (
      <YearPicker
        value={YEAR_PATTERN.test(value) ? `${value}-01-01` : null}
        defaultDate={YEAR_PATTERN.test(value) ? `${value}-01-01` : undefined}
        minDate='1901-01-01'
        maxDate='2155-12-31'
        onChange={(next) => next && onChange(next.slice(0, 4))}
      />
    );
  }

  if (kind === 'date') {
    return (
      <DatePicker
        value={DATE_PATTERN.test(value) ? value : null}
        defaultDate={DATE_PATTERN.test(value) ? value : undefined}
        onChange={(next) => next && onChange(next)}
      />
    );
  }

  if (kind === 'time') {
    const [, time = '', , suffix = ''] = TIME_PATTERN.exec(value) ?? [];

    return <TimePicker withSeconds value={time} onChange={(next) => next && onChange(`${next}${suffix}`)} />;
  }

  const [, date, time = '00:00:00', fraction = '', suffix = ''] = DATETIME_PATTERN.exec(value) ?? [];

  return (
    <Group gap='xs' align='flex-start' wrap='nowrap'>
      <DatePicker
        value={date ?? null}
        defaultDate={date}
        onChange={(next) => next && onChange(`${next} ${time}${fraction}${suffix}`)}
      />
      <TimePicker
        withSeconds
        disabled={!date}
        value={date ? time : ''}
        onChange={(next) => next && date && onChange(`${date} ${next}${suffix}`)}
      />
    </Group>
  );
}

const TEXT_PREVIEW_CHARS = 512;
const BINARY_PREVIEW_CHARS = 32;

function textPreview(text: string) {
  const lastCode = text.charCodeAt(TEXT_PREVIEW_CHARS - 1);
  const end = lastCode >= 0xd800 && lastCode <= 0xdbff ? TEXT_PREVIEW_CHARS - 1 : TEXT_PREVIEW_CHARS;

  return text.slice(0, end);
}

function Rendered({ value }: { value: Value }) {
  const { t } = useTranslations();

  if (value.type === 'null') {
    return <Code c='dimmed'>{t('pages.server.databases.explorer.cell.null', {})}</Code>;
  }

  if (value.type === 'binary') {
    return (
      <Code>
        0x{value.value.slice(0, BINARY_PREVIEW_CHARS)}
        {value.value.length > BINARY_PREVIEW_CHARS || value.truncated ? '…' : ''}
      </Code>
    );
  }

  if (value.value === '' && !value.truncated) {
    return (
      <Text size='sm' c='dimmed' fs='italic'>
        {t('pages.server.databases.explorer.cell.empty', {})}
      </Text>
    );
  }

  return (
    <span className='block truncate text-left'>
      {textPreview(value.value)}
      {value.truncated && '…'}
    </span>
  );
}

export default function DatabaseResultCell({
  value,
  column,
  placeholder,
  editable = false,
  dirty = false,
  editing = false,
  onEditingChange,
  onNavigate,
  onChange,
}: {
  value?: Value;
  column?: Column;
  placeholder?: string;
  editable?: boolean;
  dirty?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onNavigate?: (delta: 1 | -1) => void;
  onChange?: (value: Value) => void;
}) {
  const { t, tReact } = useTranslations();
  const { engine } = useDatabaseExplorer();
  const [draft, setDraft] = useState('');
  const [picking, setPicking] = useState(false);
  const draftRef = useRef('');

  const truncated = value?.type !== 'null' && value?.truncated === true;
  const canEdit = editable && !truncated;

  const updateDraft = (next: string) => {
    draftRef.current = next;
    setDraft(next);
  };

  useEffect(() => {
    if (editing) {
      updateDraft(!value || value.type === 'null' ? '' : value.value);
      setPicking(false);
    }
  }, [editing]);

  const commit = () => {
    onEditingChange?.(false);

    const next = draftRef.current;

    if (!value || value.type === 'null' ? next === '' : next === value.value) return;

    onChange?.(
      value?.type === 'binary'
        ? { type: 'binary', value: next, truncated: false }
        : { type: 'text', value: next, truncated: false },
    );
  };

  const cell = (
    <TableData
      className={classNames(
        'max-w-md',
        canEdit && 'cursor-text',
        dirty && 'bg-(--mantine-color-yellow-light)',
        editing && 'bg-(--mantine-color-blue-light)',
      )}
      onClick={canEdit && !editing ? () => onEditingChange?.(true) : undefined}
    >
      <div className='flex items-center min-h-7.5'>
        {value ? (
          <Rendered value={value} />
        ) : (
          <Text size='sm' c='dimmed' fs='italic'>
            {placeholder}
          </Text>
        )}
      </div>
    </TableData>
  );

  if (truncated) {
    return <Tooltip label={t('pages.server.databases.explorer.cell.truncated', {})}>{cell}</Tooltip>;
  }

  if (!editing) {
    return cell;
  }

  const choose = (next: string) => {
    updateDraft(next);
    commit();
  };

  const binary = value?.type === 'binary';
  const booleans = column && !binary ? booleanValues(column, engine) : null;
  const picker = column && !binary ? pickerKind(column) : null;
  let textual = false;
  let editor: ReactNode;

  if (column?.enumValues && !binary) {
    const options =
      draft !== '' && !column.enumValues.includes(draft) ? [...column.enumValues, draft] : column.enumValues;

    editor = (
      <Select
        autoFocus
        searchable
        defaultDropdownOpened
        className='flex-1'
        comboboxProps={{ withinPortal: false }}
        data={options.map((option) => ({
          value: option,
          label: option === '' ? t('pages.server.databases.explorer.cell.empty', {}) : option,
        }))}
        value={!value || value.type === 'null' ? null : draft}
        onChange={(next) => next !== null && choose(next)}
      />
    );
  } else if (column?.setValues && !binary) {
    editor = (
      <MultiSelect
        autoFocus
        defaultDropdownOpened
        className='flex-1'
        comboboxProps={{ withinPortal: false }}
        data={[...new Set([...column.setValues, ...draft.split(',').filter(Boolean)])]}
        value={draft.split(',').filter(Boolean)}
        onChange={(next) => updateDraft(next.join(','))}
      />
    );
  } else if (booleans && (!value || value.type === 'null' || booleans.includes(value.value))) {
    editor = (
      <SegmentedControl
        className='flex-1'
        data={[
          { value: booleans[0], label: t('pages.server.databases.explorer.cell.false', {}) },
          { value: booleans[1], label: t('pages.server.databases.explorer.cell.true', {}) },
        ]}
        value={draft}
        onChange={choose}
      />
    );
  } else {
    textual = true;
    editor = (
      <TextArea
        autoFocus
        autosize
        minRows={1}
        maxRows={10}
        className='flex-1'
        classNames={binary ? { input: 'font-mono' } : undefined}
        value={draft}
        onFocus={(e) => e.target.select()}
        onChange={(e) => updateDraft(e.target.value)}
      />
    );
  }

  return (
    <Popover
      opened
      position='bottom-start'
      shadow='md'
      width={384}
      trapFocus={false}
      closeOnEscape={false}
      returnFocus={false}
      transitionProps={{ duration: 0 }}
      onDismiss={commit}
    >
      <Popover.Target>{cell}</Popover.Target>
      <Popover.Dropdown p='xs' className='max-w-[90vw]'>
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.defaultPrevented && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              onEditingChange?.(false);
            } else if (e.key === 'Tab') {
              e.preventDefault();
              commit();
              onNavigate?.(e.shiftKey ? -1 : 1);
            }
          }}
        >
          <Group gap={4} wrap='nowrap' align='flex-start'>
            {editor}
            {picker && (
              <Tooltip label={t('pages.server.databases.explorer.cell.picker', {})}>
                <ActionIcon
                  variant={picking ? 'light' : 'subtle'}
                  color='gray'
                  size='input-sm'
                  onClick={() => setPicking(!picking)}
                >
                  <FontAwesomeIcon icon={faCalendarDays} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={t('pages.server.databases.explorer.cell.setNull', {})}>
              <ActionIcon
                variant='subtle'
                color='gray'
                size='input-sm'
                onClick={() => {
                  onEditingChange?.(false);
                  onChange?.({ type: 'null' });
                }}
              >
                <FontAwesomeIcon icon={faBan} />
              </ActionIcon>
            </Tooltip>
          </Group>
          {picker && picking && (
            <div className='mt-2'>
              <ValuePicker kind={picker} value={draft} onChange={updateDraft} />
            </div>
          )}
          {textual && (
            <Text size='xs' c='dimmed' mt={6}>
              {tReact('pages.server.databases.explorer.cell.editorHint', {
                enter: <Kbd size='xs'>Enter</Kbd>,
                shiftEnter: (
                  <>
                    <Kbd size='xs'>Shift</Kbd> + <Kbd size='xs'>Enter</Kbd>
                  </>
                ),
              })}
            </Text>
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
