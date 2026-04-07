import { faCubesStacked } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  Center,
  Group,
  GroupProps,
  Pagination as MantinePagination,
  Stack,
  Table,
  TableTdProps,
  TableTrProps,
  Text,
} from '@mantine/core';
import { forwardRef, ReactNode, startTransition, useEffect } from 'react';
import Spinner from '@/elements/Spinner.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface TableHeaderProps {
  name?: string | (() => string);
  rightSection?: ReactNode;
  onClick?: () => void;
}

export const TableHeader = ({ name, rightSection, onClick }: TableHeaderProps) => {
  if (!name || (typeof name === 'function' && !name())) {
    return <Table.Th className='py-2' />;
  }

  return (
    <Table.Th className='font-normal!' onClick={onClick}>
      <div className='flex flex-row items-center gap-2'>
        <p>{typeof name === 'function' ? name() : name}</p> {rightSection}
      </div>
    </Table.Th>
  );
};

export const TableHead = ({ children }: { children: ReactNode }) => {
  return (
    <Table.Thead>
      <Table.Tr>{children}</Table.Tr>
    </Table.Thead>
  );
};

export const TableBody = ({ children }: { children: ReactNode }) => {
  return <Table.Tbody>{children}</Table.Tbody>;
};

export const TableRow = forwardRef<HTMLTableRowElement, TableTrProps>(({ className, children, ...rest }, ref) => {
  return (
    <Table.Tr ref={ref} className={className} {...rest}>
      {children}
    </Table.Tr>
  );
});

export const TableData = forwardRef<HTMLTableCellElement, TableTdProps>(({ className, children, ...rest }, ref) => {
  return (
    <Table.Td ref={ref} className={className} {...rest}>
      {children}
    </Table.Td>
  );
});

interface PaginationProps<T> {
  data: Pagination<T>;
  onPageSelect: (page: number) => void;
}

export function Pagination<T>({ data, onPageSelect, ...props }: PaginationProps<T> & GroupProps) {
  const { t } = useTranslations();

  const totalPages = data.total === 0 ? 0 : Math.ceil(data.total / data.perPage);

  const setPage = (page: number) => {
    if (page < 1 || page > totalPages) {
      return;
    }

    startTransition(() => {
      onPageSelect(page);
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (event.key === 'ArrowLeft' && !isInputFocused) {
        event.preventDefault();

        const page = event.shiftKey ? 1 : data.page - 1;
        setPage(page);
      }

      if (event.key === 'ArrowRight' && !isInputFocused) {
        event.preventDefault();

        const page = event.shiftKey ? totalPages : data.page + 1;
        setPage(page);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [data.page, totalPages]);

  const isFirstPage = data.page === 1;
  const isLastPage = data.page >= totalPages;

  const rangeStart = (data.page - 1) * data.perPage + 1;
  const rangeEnd = Math.min(data.page * data.perPage, data.total);

  return isFirstPage && isLastPage ? null : (
    <Group justify='space-between' hidden={rangeEnd === 0} {...props}>
      <p className='text-sm leading-5 text-gray-400'>
        {t('common.table.pagination.results', {
          start: rangeStart,
          end: rangeEnd,
          total: data.total,
        })}
      </p>
      <MantinePagination boundaries={1} value={data.page} total={totalPages} onChange={setPage} />
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

interface TableProps {
  columns: (string | (() => string))[] | TableHeaderProps[];
  loading?: boolean;
  pagination?: Pagination<unknown>;
  onPageSelect?: (page: number) => void;
  allowSelect?: boolean;
  children: ReactNode;
}

export default ({ columns, loading, pagination, onPageSelect, allowSelect = true, children }: TableProps) => {
  return (
    <Table.ScrollContainer
      minWidth={0}
      type='native'
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        border: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-body)',
      }}
    >
      {pagination && onPageSelect && pagination.total > pagination.perPage && (
        <Pagination data={pagination} m='xs' onPageSelect={onPageSelect} />
      )}

      <Table
        stickyHeader
        highlightOnHover={(pagination?.total ?? 0) > 0 && !loading}
        className={allowSelect ? undefined : 'select-none'}
      >
        <TableHead>
          {columns.map((column, index) => (
            <TableHeader
              key={`column-${index}`}
              {...(typeof column === 'string'
                ? { name: column }
                : typeof column === 'function'
                  ? { name: column() }
                  : column)}
            />
          ))}
        </TableHead>
        <Table.Tbody>
          {loading ? (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <Spinner.Centered />
              </Table.Td>
            </Table.Tr>
          ) : pagination?.total === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <NoItems />
              </Table.Td>
            </Table.Tr>
          ) : (
            children
          )}
        </Table.Tbody>
      </Table>

      {pagination && onPageSelect && <Pagination data={pagination} m='xs' onPageSelect={onPageSelect} />}
    </Table.ScrollContainer>
  );
};
