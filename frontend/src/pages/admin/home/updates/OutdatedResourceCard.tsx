import { ReactNode } from 'react';
import type { IconLike } from '@/elements/data-display/Icon.tsx';
import Table, { TableHeaderProps } from '@/elements/data-display/Table.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import StatusLine from '@/elements/feedback/StatusLine.tsx';
import { LazyString } from '@/lib/lazy.ts';

export interface OutdatedResourceTable {
  loading: boolean;
  error?: string | null;
  data: Pagination<unknown> | undefined;
  columns: LazyString[] | TableHeaderProps[];
  onPageSelect: (page: number) => void;
  onRetry?: () => void;
}

export interface OutdatedResourceStatus {
  upToDate: ReactNode;
  outdated: ReactNode;
}

export default function OutdatedResourceCard({
  title,
  icon,
  table,
  status,
  children,
}: {
  title: string;
  icon: IconLike;
  table: OutdatedResourceTable;
  status: OutdatedResourceStatus;
  children: ReactNode;
}) {
  const { loading, error, data, columns, onPageSelect, onRetry } = table;

  return (
    <TitleCard title={title} icon={icon}>
      {!data ? (
        error && !loading ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : (
          <Spinner.Centered />
        )
      ) : !data.total ? (
        <StatusLine status='ok'>{status.upToDate}</StatusLine>
      ) : (
        <>
          <StatusLine status='warning'>{status.outdated}</StatusLine>
          <div className='mt-4' />
          <Table columns={columns} loading={loading} error={error} pagination={data} onPageSelect={onPageSelect}>
            {children}
          </Table>
        </>
      )}
    </TitleCard>
  );
}
