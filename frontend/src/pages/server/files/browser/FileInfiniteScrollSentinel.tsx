import { useIntersection } from '@mantine/hooks';
import { useEffect } from 'react';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';

export default function FileInfiniteScrollSentinel({ colSpan }: { colSpan: number }) {
  const store = useFileManagerApi();
  const hasNextPage = useFileManagerStore((state) => state.hasNextPage);
  const isFetchingNextPage = useFileManagerStore((state) => state.isFetchingNextPage);
  const { ref, entry } = useIntersection<HTMLTableRowElement>({ threshold: 0, rootMargin: '600px' });

  useEffect(() => {
    if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
      store.getState().fetchNextPage();
    }
  }, [entry?.isIntersecting, hasNextPage, isFetchingNextPage, store]);

  if (!hasNextPage) return null;

  return (
    <TableRow ref={ref}>
      <TableData colSpan={colSpan} className='py-3'>
        <div className='flex items-center justify-center'>
          <Spinner size={20} />
        </div>
      </TableData>
    </TableRow>
  );
}
