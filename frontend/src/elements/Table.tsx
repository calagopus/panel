import { faCubesStacked, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  Center,
  Group,
  GroupProps,
  Pagination as MantinePagination,
  Table as MantineTable,
  Stack,
  TableTdProps,
  TableTrProps,
  Text,
} from '@mantine/core';
import classNames from 'classnames';
import { forwardRef, ReactNode, useEffect, useState } from 'react';
import Spinner from '@/elements/Spinner.tsx';
import { type LazyString, resolveString } from '@/lib/lazy.ts';
import { matchesShortcut } from '@/plugins/useKeyboardShortcuts.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface TableHeaderProps {
  name?: LazyString;
  rightSection?: ReactNode;
  onClick?: () => void;
}

export const TableHeader = ({ name, rightSection, onClick }: TableHeaderProps) => {
  const resolvedName = resolveString(name);
  if (!resolvedName) {
    return <MantineTable.Th className='py-2' />;
  }

  return (
    <MantineTable.Th className='font-normal!' onClick={onClick}>
      <div className='flex flex-row items-center gap-2'>
        <p>{resolvedName}</p> {rightSection}
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
    <MantineTable.Td ref={ref} className={className} {...rest}>
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
  columns: LazyString[] | TableHeaderProps[];
  loading?: boolean;
  error?: string | null;
  pagination?: Pagination<unknown>;
  onPageSelect?: (page: number) => void;
  allowSelect?: boolean;
  children: ReactNode;
}

export default function Table({
  columns,
  loading,
  error,
  pagination,
  onPageSelect,
  allowSelect = true,
  children,
}: TableProps) {
  return (
    <MantineTable.ScrollContainer
      minWidth={0}
      type='native'
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        border: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-default)',
      }}
    >
      {!error && pagination && onPageSelect && pagination.total > pagination.perPage && (
        <Pagination data={pagination} m='xs' onPageSelect={onPageSelect} withShortcuts={false} />
      )}

      <div style={{ position: 'relative' }}>
        <MantineTable
          stickyHeader
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
          <MantineTable.Tbody>
            {loading ? (
              <MantineTable.Tr>
                <MantineTable.Td colSpan={columns.length}>
                  <Spinner.Centered />
                </MantineTable.Td>
              </MantineTable.Tr>
            ) : error ? (
              <MantineTable.Tr>
                <MantineTable.Td colSpan={columns.length}>
                  <ErrorItems error={error} />
                </MantineTable.Td>
              </MantineTable.Tr>
            ) : pagination?.total === 0 && !loading ? (
              <MantineTable.Tr>
                <MantineTable.Td colSpan={columns.length}>
                  <NoItems />
                </MantineTable.Td>
              </MantineTable.Tr>
            ) : (
              children
            )}
          </MantineTable.Tbody>
        </MantineTable>

        {loading && (
          <div className='absolute inset-0 z-20 flex items-center justify-center pointer-events-none'>
            <Spinner />
          </div>
        )}
      </div>

      {!error && pagination && onPageSelect && <Pagination data={pagination} m='xs' onPageSelect={onPageSelect} />}
    </MantineTable.ScrollContainer>
  );
}
