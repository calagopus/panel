import { faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode } from 'react';
import Table, { TableHeaderProps } from '@/elements/data-display/Table.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { LazyString } from '@/lib/lazy.ts';

export interface OutdatedResourceTable {
  loading: boolean;
  error?: string | null;
  data: Pagination<unknown> | undefined;
  columns: LazyString[] | TableHeaderProps[];
  onPageSelect: (page: number) => void;
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
  icon: ReactNode;
  table: OutdatedResourceTable;
  status: OutdatedResourceStatus;
  children: ReactNode;
}) {
  const { loading, error, data, columns, onPageSelect } = table;

  return (
    <TitleCard title={title} icon={icon}>
      {loading || !data ? (
        <Spinner.Centered />
      ) : !data.total ? (
        <>
          <FontAwesomeIcon icon={faCheck} /> {status.upToDate}
        </>
      ) : (
        <>
          <FontAwesomeIcon icon={faExclamationTriangle} /> {status.outdated}
          <div className='mt-4' />
          <Table columns={columns} loading={loading} error={error} pagination={data} onPageSelect={onPageSelect}>
            {children}
          </Table>
        </>
      )}
    </TitleCard>
  );
}
