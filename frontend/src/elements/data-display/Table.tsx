import { faCubesStacked, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  Center,
  Group,
  GroupProps,
  Pagination as MantinePagination,
  MantineSpacing,
  Table as MantineTable,
  Stack,
  TableTdProps,
  TableTrProps,
  Text,
} from '@mantine/core';
import classNames from 'classnames';
import { forwardRef, ReactNode, useEffect, useState } from 'react';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { type LazyString, resolveString } from '@/lib/lazy.ts';
import { matchesShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { getTranslations, useTranslations } from '@/providers/TranslationProvider.tsx';

export interface TableHeaderProps {
  name?: LazyString;
  hint?: LazyString;
  content?: ReactNode;
  className?: string;
  rightSection?: ReactNode;
  onClick?: () => void;
}

export const TableHeader = ({ name, hint, content, className, rightSection, onClick }: TableHeaderProps) => {
  if (content !== undefined) {
    return (
      <MantineTable.Th className={classNames('py-2', className)} onClick={onClick}>
        {content}
      </MantineTable.Th>
    );
  }

  const resolvedName = resolveString(name);
  if (!resolvedName) {
    return <MantineTable.Th className={classNames('py-2', className)} />;
  }

  const resolvedHint = resolveString(hint);

  return (
    <MantineTable.Th className={classNames('font-normal! text-nowrap', className)} onClick={onClick}>
      <div className='flex flex-row items-center gap-2'>
        {resolvedHint ? (
          <div className='flex flex-col'>
            <span>{resolvedName}</span>
            <span className='text-xs text-(--mantine-color-dimmed)'>{resolvedHint}</span>
          </div>
        ) : (
          <span>{resolvedName}</span>
        )}{' '}
        {rightSection}
      </div>
    </MantineTable.Th>
  );
};

export const TableHead = ({ children }: { children: ReactNode }) => {
  return (
    <MantineTable.Thead>
      <MantineTable.Tr>{children}</MantineTable.Tr>
    </MantineTable.Thead>
  );
};

export const TableBody = ({ children }: { children: ReactNode }) => {
  return <MantineTable.Tbody>{children}</MantineTable.Tbody>;
};

export const TableRow = forwardRef<HTMLTableRowElement, TableTrProps>(({ className, children, ...rest }, ref) => {
  return (
    <MantineTable.Tr ref={ref} className={className} {...rest}>
      {children}
    </MantineTable.Tr>
  );
});

export const TableData = forwardRef<HTMLTableCellElement, TableTdProps>(({ className, children, ...rest }, ref) => {
  return (
    <MantineTable.Td ref={ref} className={classNames('text-nowrap', className)} {...rest}>
      {children}
    </MantineTable.Td>
  );
});

interface PaginationProps<T> {
  data: Pagination<T>;
  onPageSelect: (page: number) => void;
}

export function Pagination<T>({
  data,
  onPageSelect,
  withShortcuts = true,
  ...props
}: PaginationProps<T> & { withShortcuts?: boolean } & GroupProps) {
  const { t } = useTranslations();

  const [pendingPage, setPendingPage] = useState<number | null>(null);

  const totalPages = data.total === 0 ? 0 : Math.ceil(data.total / data.perPage);
  const currentPage = pendingPage ?? data.page;

  useEffect(() => {
    setPendingPage(null);
  }, [data.page]);

  const setPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    setPendingPage(page);
    onPageSelect(page);
  };

  useEffect(() => {
    if (!withShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (isInputFocused) return;

      if (matchesShortcut(event, 'table.firstPage')) {
        event.preventDefault();
        setPage(1);
      } else if (matchesShortcut(event, 'table.previousPage')) {
        event.preventDefault();
        setPage(currentPage - 1);
      } else if (matchesShortcut(event, 'table.lastPage')) {
        event.preventDefault();
        setPage(totalPages);
      } else if (matchesShortcut(event, 'table.nextPage')) {
        event.preventDefault();
        setPage(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPage, totalPages, withShortcuts]);

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage >= totalPages;

  const rangeStart = (currentPage - 1) * data.perPage + 1;
  const rangeEnd = Math.min(currentPage * data.perPage, data.total);

  return isFirstPage && isLastPage ? null : (
    <Group justify='space-between' hidden={rangeEnd === 0} {...props}>
      <p className='text-sm leading-5 text-(--mantine-color-dimmed)'>
        {t('common.table.pagination.results', {
          start: rangeStart,
          end: rangeEnd,
          total: data.total,
        })}
      </p>
      <MantinePagination boundaries={1} value={currentPage} total={totalPages} onChange={setPage} />
    </Group>
  );
}

export const NoItems = () => {
  const { t } = useTranslations();

  return (
    <Center py='lg'>
      <Stack align='center' c='dimmed'>
        <FontAwesomeIcon icon={faCubesStacked} size='3x' className='-mb-2' />
        <Text>{t('common.table.pagination.empty', {})}</Text>
      </Stack>
    </Center>
  );
};

export const ErrorItems = ({ error }: { error: string }) => {
  const { t } = useTranslations();

  return (
    <Center py='lg'>
      <Stack align='center' c='red' gap='xs'>
        <FontAwesomeIcon icon={faTriangleExclamation} size='3x' className='-mb-2' />
        <Text fw={500}>{t('common.alert.error', {})}</Text>
        <Text c='dimmed' size='sm'>
          {error}
        </Text>
      </Stack>
    </Center>
  );
};

interface TableProps {
  columns: (LazyString | TableHeaderProps)[];
  loading?: boolean;
  error?: string | null;
  pagination?: Pagination<unknown>;
  onPageSelect?: (page: number) => void;
  allowSelect?: boolean;
  flush?: boolean;
  empty?: ReactNode;
  verticalSpacing?: MantineSpacing;
  children: ReactNode;
}

export default function Table({
  columns,
  loading,
  error,
  pagination,
  onPageSelect,
  allowSelect = true,
  flush = false,
  empty,
  verticalSpacing,
  children,
}: TableProps) {
  return (
    <div
      style={
        flush
          ? undefined
          : {
              borderRadius: 'var(--mantine-radius-md)',
              border: '1px solid var(--mantine-color-default-border)',
              background: 'var(--mantine-color-default)',
              overflow: 'hidden',
            }
      }
    >
      {!error && pagination && onPageSelect && pagination.total > pagination.perPage && (
        <Pagination data={pagination} m='xs' onPageSelect={onPageSelect} withShortcuts={false} />
      )}

      <MantineTable.ScrollContainer minWidth={0} type='native'>
        <div style={{ position: 'relative', ...(loading ? { minHeight: '10rem' } : {}) }}>
          <MantineTable
            stickyHeader
            verticalSpacing={verticalSpacing}
            highlightOnHover={(pagination?.total ?? 0) > 0 && !loading}
            className={classNames(
              allowSelect ? undefined : 'select-none',
              loading && 'opacity-50 pointer-events-none transition-opacity',
            )}
          >
            <TableHead>
              {columns.map((column, index) => (
                <TableHeader key={`column-${index}`} {...(typeof column === 'object' ? column : { name: column })} />
              ))}
            </TableHead>
            <MantineTable.Tbody>{!error && !(pagination?.total === 0 && !loading) && children}</MantineTable.Tbody>
          </MantineTable>

          {loading && (
            <div className='absolute inset-0 z-20 flex items-center justify-center pointer-events-none'>
              <Spinner />
            </div>
          )}
        </div>
      </MantineTable.ScrollContainer>

      {error ? (
        <div className='p-2.5'>
          <ErrorItems error={error} />
        </div>
      ) : (
        pagination?.total === 0 && !loading && <div className='p-2.5'>{empty ?? <NoItems />}</div>
      )}

      {!error && pagination && onPageSelect && <Pagination data={pagination} m='xs' onPageSelect={onPageSelect} />}
    </div>
  );
}

interface TableSelectionHeaderProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}

export const tableSelectionHeader = ({
  checked,
  indeterminate,
  onChange,
}: TableSelectionHeaderProps): TableHeaderProps => {
  const { t } = getTranslations();

  return {
    className: 'pl-4 w-10 text-center',
    content: (
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={t('common.button.selectAll', {})}
        classNames={{ input: 'cursor-pointer!' }}
      />
    ),
  };
};

interface TableSelectionCellProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

export const TableSelectionCell = ({ id, checked, disabled, onChange }: TableSelectionCellProps) => {
  const { t } = useTranslations();

  return (
    <TableData className='pl-4 relative cursor-pointer w-10 text-center'>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        aria-label={t('common.table.selectRow', {})}
        classNames={{ input: 'cursor-pointer!' }}
      />
    </TableData>
  );
};
