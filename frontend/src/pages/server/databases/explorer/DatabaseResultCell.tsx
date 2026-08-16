import { faBan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Code from '@/elements/Code.tsx';
import Group from '@/elements/Group.tsx';
import TextArea from '@/elements/input/TextArea.tsx';
import Kbd from '@/elements/Kbd.tsx';
import Popover from '@/elements/Popover.tsx';
import { TableData } from '@/elements/Table.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { serverDatabaseQueryValueSchema } from '@/lib/schemas/server/databases.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Value = z.infer<typeof serverDatabaseQueryValueSchema>;

const TEXT_PREVIEW_CHARS = 512;
const BINARY_PREVIEW_CHARS = 32;

function Rendered({ value }: { value: Value }) {
  const { t } = useTranslations();

  if (value.type === 'null') {
    return <Code c='dimmed'>{t('pages.server.databases.explorer.cell.null', {})}</Code>;
  }

  if (value.type === 'binary') {
    return (
      <Code>
        0x{value.value.slice(0, BINARY_PREVIEW_CHARS)}
        {value.value.length > BINARY_PREVIEW_CHARS ? '…' : ''}
      </Code>
    );
  }

  if (value.value === '') {
    return (
      <Text size='sm' c='dimmed' fs='italic'>
        {t('pages.server.databases.explorer.cell.empty', {})}
      </Text>
    );
  }

  return <span className='block truncate text-left'>{value.value.slice(0, TEXT_PREVIEW_CHARS)}</span>;
}

export default function DatabaseResultCell({
  value,
  placeholder,
  editable = false,
  dirty = false,
  editing = false,
  onEditingChange,
  onNavigate,
  onChange,
}: {
  value?: Value;
  placeholder?: string;
  editable?: boolean;
  dirty?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onNavigate?: (delta: 1 | -1) => void;
  onChange?: (value: Value) => void;
}) {
  const { t, tReact } = useTranslations();
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');

  const updateDraft = (next: string) => {
    draftRef.current = next;
    setDraft(next);
  };

  useEffect(() => {
    if (editing) {
      updateDraft(!value || value.type === 'null' ? '' : value.value);
    }
  }, [editing]);

  const commit = () => {
    onEditingChange?.(false);

    const next = draftRef.current;

    if (!value || value.type === 'null' ? next === '' : next === value.value) return;

    onChange?.(value?.type === 'binary' ? { type: 'binary', value: next } : { type: 'text', value: next });
  };

  const cell = (
    <TableData
      className={classNames(
        'max-w-md',
        editable && 'cursor-text',
        dirty && 'bg-(--mantine-color-yellow-light)',
        editing && 'bg-(--mantine-color-blue-light)',
      )}
      onClick={editable && !editing ? () => onEditingChange?.(true) : undefined}
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

  if (!editing) {
    return cell;
  }

  return (
    <Popover
      opened
      position='bottom-start'
      shadow='md'
      trapFocus={false}
      closeOnEscape={false}
      returnFocus={false}
      transitionProps={{ duration: 0 }}
      onDismiss={commit}
    >
      <Popover.Target>{cell}</Popover.Target>
      <Popover.Dropdown p='xs' className='w-96 max-w-[90vw]'>
        <Group gap={4} wrap='nowrap' align='flex-start'>
          <TextArea
            autoFocus
            autosize
            minRows={1}
            maxRows={10}
            className='flex-1'
            classNames={value?.type === 'binary' ? { input: 'font-mono' } : undefined}
            value={draft}
            onFocus={(e) => e.target.select()}
            onChange={(e) => updateDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
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
          />
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
      </Popover.Dropdown>
    </Popover>
  );
}
