import { forwardRef, memo, useRef } from 'react';
import { z } from 'zod';
import { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { isEditableFile, isViewableArchive, isViewableImage } from '@/lib/files.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { type FileSortColumn } from '@/providers/contexts/fileManagerContext.ts';
import { bytesToString } from '@/lib/size.ts';
import FileRowContextMenu from '@/pages/server/files/FileRowContextMenu.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import FileMassContextMenu from './FileMassContextMenu.tsx';
import FileRowIcon from './FileRowIcon.tsx';

interface FileRowProps {
  file: z.infer<typeof serverDirectoryEntrySchema>;
  handleOpen: () => void;
  isSelected: boolean;
  isActing: boolean;
  multipleSelected: boolean;
  visibleColumns: FileSortColumn[];
}

const FileRow = forwardRef<HTMLTableRowElement, FileRowProps>(function FileRow(
  { file, handleOpen, isSelected, isActing, multipleSelected, visibleColumns },
  ref,
) {
  const canOpenActionBar = useServerCan(['files.read-content', 'files.archive', 'files.update', 'files.delete'], true);
  const { browsingFastDirectory, doSelectFiles, addSelectedFile, removeSelectedFile, clickOnce, preferPhysicalSize } =
    useFileManager();
  const canOpenFile = useServerCan('files.read-content');

  const toggleSelected = () => (isSelected ? removeSelectedFile(file) : addSelectedFile(file));

  const clickCount = useRef(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    clickCount.current += 1;

    if (clickTimer.current) return;

    if (e.shiftKey) {
      addSelectedFile(file);
    } else if (isSelected) {
      if (multipleSelected) {
        doSelectFiles([file]);
      } else {
        removeSelectedFile(file);
      }
    } else {
      doSelectFiles([file]);
    }

    clickTimer.current = setTimeout(() => {
      if (clickCount.current >= 2) {
        handleOpen();
      }

      clickCount.current = 0;
      clickTimer.current = null;
    }, 250);
  };

  // Determine background color based on state
  const getBgColor = () => {
    // if (isOver && isValidDropTarget) {
    //   return 'var(--mantine-color-green-light)';
    // }
    if (isActing) {
      return 'var(--mantine-color-orange-light)';
    }
    if (isSelected) {
      return 'var(--mantine-color-blue-light)';
    }
    return undefined;
  };

  return (
    <FileMassContextMenu>
      {({ openMassMenu }) => (
        <FileRowContextMenu file={file}>
          {({ items, openMenu }) => (
            <TableRow
              ref={ref}
              className={
                clickOnce &&
                canOpenFile &&
                (isEditableFile(file) ||
                  isViewableImage(file) ||
                  file.directory ||
                  (isViewableArchive(file) && browsingFastDirectory))
                  ? 'cursor-pointer select-none'
                  : 'select-none'
              }
              bg={getBgColor()}
              onContextMenu={(e) => {
                e.preventDefault();
                if (isSelected) {
                  openMassMenu(e.pageX, e.pageY);
                } else {
                  openMenu(e.clientX, e.clientY);
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                if (clickOnce) {
                  handleOpen();
                } else {
                  handleClick(e);
                }
              }}
            >
              {canOpenActionBar ? (
                <td className='pl-4 relative cursor-pointer w-10 text-center py-2'>
                  <Checkbox
                    id={file.name}
                    checked={isSelected}
                    classNames={{ input: 'cursor-pointer!' }}
                    onChange={toggleSelected}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
              ) : (
                <td className='w-0'></td>
              )}

              <TableData>
                <span className='flex items-center gap-4 leading-[100%]'>
                  <FileRowIcon className='text-gray-400' file={file} />
                  {file.name}
                </span>
              </TableData>

              {visibleColumns.includes('size') && (
                <TableData>
                  <span className='flex items-center gap-4 leading-[100%]'>
                    {bytesToString(preferPhysicalSize ? file.sizePhysical : file.size)}
                  </span>
                </TableData>
              )}

              {visibleColumns.includes('modified') && (
                <TableData className='hidden md:table-cell'>
                  <FormattedTimestamp timestamp={file.modified} />
                </TableData>
              )}

              {visibleColumns.includes('created') && (
                <TableData className='hidden md:table-cell'>
                  <FormattedTimestamp timestamp={file.created} />
                </TableData>
              )}

              {visibleColumns.includes('type') && (
                <TableData className='hidden md:table-cell'>
                  <span className='text-gray-400 text-xs uppercase'>
                    {file.directory ? 'Folder' : file.name.includes('.') ? file.name.split('.').pop() : '—'}
                  </span>
                </TableData>
              )}

              {visibleColumns.includes('mime') && (
                <TableData className='hidden md:table-cell'>
                  <span className='text-gray-400 text-xs'>{file.mime}</span>
                </TableData>
              )}

              {visibleColumns.includes('permissions') && (
                <TableData className='hidden md:table-cell'>
                  <span className='text-gray-400 text-xs font-mono'>{file.mode}</span>
                </TableData>
              )}

              <ContextMenuToggle items={items} openMenu={openMenu} />
            </TableRow>
          )}
        </FileRowContextMenu>
      )}
    </FileMassContextMenu>
  );
});

export default memo(FileRow);
