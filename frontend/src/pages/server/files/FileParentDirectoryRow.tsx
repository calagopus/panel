import classNames from 'classnames';
import { join } from 'pathe';
import { useSearchParams } from 'react-router';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FileRowIcon from '@/pages/server/files/FileRowIcon.tsx';
import { useDraggedFileMove } from '@/pages/server/files/hooks/useDraggedFileMove.ts';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';

function FileParentDirectoryRow() {
  const [_, setSearchParams] = useSearchParams();
  const store = useFileManagerApi();
  const browsingDirectory = useFileManagerStore((state) => state.browsingDirectory);

  const parentDirectory = join(browsingDirectory, '..');
  const { isDropTarget, getDropHandlers } = useDraggedFileMove({ targetDirectory: parentDirectory });
  const parentIsDropTarget = isDropTarget(parentDirectory);

  const openParentDirectory = () => {
    store.getState().doSelectFiles([]);
    setSearchParams({ directory: parentDirectory });
  };

  return (
    <TableRow
      className='cursor-pointer select-none'
      bg={parentIsDropTarget ? 'var(--mantine-color-green-light)' : undefined}
      onClick={openParentDirectory}
      {...getDropHandlers(parentDirectory)}
    >
      <td className='pl-4 relative w-10 py-2'></td>

      <TableData className='w-full max-w-0'>
        <span className='flex items-center gap-4 min-w-0 py-0.5 leading-5' title='..'>
          <FileRowIcon className='shrink-0' directory />
          <span className={classNames('truncate', parentIsDropTarget && 'font-medium')}>..</span>
        </span>
      </TableData>

      <TableData></TableData>
      <TableData className='hidden md:table-cell'></TableData>
      <td className='w-0'></td>
    </TableRow>
  );
}

export default FileParentDirectoryRow;
