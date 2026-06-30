import classNames from 'classnames';
import { join } from 'pathe';
import { forwardRef, memo, RefObject, useMemo, useRef } from 'react';
import { FileOpenMode } from 'shared/src/registries/pages/server/files.ts';
import { z } from 'zod';
import { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { isOpenableFile } from '@/lib/files.ts';
import { ObjectSet } from '@/lib/objectSet.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { bytesToString } from '@/lib/size.ts';
import FileRowContextMenu from '@/pages/server/files/FileRowContextMenu.tsx';
import { useDraggedFileMove } from '@/pages/server/files/hooks/useDraggedFileMove.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { getFileManager, useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import FileMassContextMenu from './FileMassContextMenu.tsx';
import FileRowIcon from './FileRowIcon.tsx';

function FileRowCheckbox({
  file,
  isSelected,
  toggleSelected,
}: {
  file: z.infer<typeof serverDirectoryEntrySchema>;
  isSelected: boolean;
  toggleSelected: () => void;
}) {
  const { actingFiles } = useFileManager();

  return (
    <td className='pl-4 relative cursor-pointer w-10 text-center py-2'>
      <Checkbox
        id={file.name}
        checked={isSelected}
        classNames={{ input: 'cursor-pointer!' }}
        disabled={actingFiles.size > 0}
        onChange={toggleSelected}
        onClick={(e) => e.stopPropagation()}
      />
    </td>
  );
}

interface FileRowProps {
  file: z.infer<typeof serverDirectoryEntrySchema>;
  handleOpen: (openMode: FileOpenMode) => void;
  isSelected: boolean;
  isActing: boolean;
  multipleSelectedRef: RefObject<boolean>;
  actingFilesRef: RefObject<ObjectSet<z.infer<typeof serverDirectoryEntrySchema>, 'name'>>;
  clickOnce: boolean;
  preferPhysicalSize: boolean;
}

const FileRow = forwardRef<HTMLTableRowElement, FileRowProps>(function FileRow(
  { file, handleOpen, isSelected, isActing, multipleSelectedRef, actingFilesRef, clickOnce, preferPhysicalSize },
  ref,
) {
  const { t } = useTranslations();
  const canOpenActionBar = useServerCan(['files.read-content', 'files.archive', 'files.update', 'files.delete'], true);
  const canOpenFile = useServerCan('files.read-content');
  const canUpdateFiles = useServerCan('files.update');
  const { moving, isDropTarget, getDropHandlers } = useDraggedFileMove();
  const openMode = useMemo(() => isOpenableFile(file, getFileManager()), [file]);
  const {
    actingFiles,
    selectedFiles,
    browsingDirectory,
    browsingWritableDirectory,
    draggingFiles,
    draggingFilesSource,
    doDragFiles,
    clearDraggingFiles,
    selectFile,
    toggleSelectedFile,
    selectFileRange,
    addSelectedFile,
    removeSelectedFile,
  } = useFileManager();

  const toggleSelected = () => (isSelected ? removeSelectedFile(file) : addSelectedFile(file));

  const clickCount = useRef(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  const targetDirectory = file.directory ? join(browsingDirectory, file.name) : null;
  const canDragFile = canUpdateFiles && browsingWritableDirectory && actingFiles.size === 0 && !moving;
  const fileIsDropTarget = !!targetDirectory && isDropTarget(targetDirectory);
  const isDraggingSource = draggingFiles.has(file) && draggingFilesSource === browsingDirectory;

  const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
    if (!canDragFile) {
      e.preventDefault();
      return;
    }

    const files = selectedFiles.has(file) ? selectedFiles.values() : [file];

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-calagopus-file-manager', 'move');
    e.dataTransfer.setData('text/plain', files.map((file) => file.name).join('\n'));
    doDragFiles(files);
  };

  const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    clickCount.current += 1;

    if (clickTimer.current) return;

    if (actingFilesRef.current.size === 0) {
      if (e.shiftKey) {
        selectFileRange(file);
      } else if (e.ctrlKey || e.metaKey) {
        toggleSelectedFile(file);
      } else if (isSelected) {
        if (multipleSelectedRef.current) {
          selectFile(file);
        } else {
          removeSelectedFile(file);
        }
      } else {
        selectFile(file);
      }
    }

    clickTimer.current = setTimeout(() => {
      if (clickCount.current >= 2 && canOpenFile) {
        handleOpen(openMode);
      }

      clickCount.current = 0;
      clickTimer.current = null;
    }, 250);
  };

  const getBgColor = () => {
    if (fileIsDropTarget) {
      return 'var(--mantine-color-green-light)';
    }
    if (isDraggingSource) {
      return 'var(--mantine-color-blue-light)';
    }
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
        <FileRowContextMenu file={file} openMode={openMode}>
          {({ items, openMenu }) => (
            <TableRow
              ref={ref}
              className={classNames(
                'group',
                isDraggingSource && 'opacity-60',
                clickOnce && canOpenFile && openMode.openable ? 'cursor-pointer select-none' : 'select-none',
              )}
              bg={getBgColor()}
              {...(targetDirectory ? getDropHandlers(targetDirectory) : {})}
              onContextMenu={(e) => {
                e.preventDefault();
                if (isSelected) {
                  openMassMenu(e.clientX, e.clientY);
                } else {
                  openMenu(e.clientX, e.clientY);
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                if (clickOnce && canOpenFile) {
                  handleOpen(openMode);
                } else {
                  handleClick(e);
                }
              }}
            >
              {canOpenActionBar ? (
                <FileRowCheckbox file={file} isSelected={isSelected || isActing} toggleSelected={toggleSelected} />
              ) : (
                <td className='w-0'></td>
              )}

              <TableData className='w-full max-w-0'>
                <Tooltip label={t('pages.server.files.tooltip.dragToMove', {})} disabled={!canDragFile}>
                  <span
                    draggable={canDragFile}
                    className={classNames(
                      'flex w-fit max-w-full min-w-0 items-center gap-4 rounded-sm py-0.5 leading-5',
                      canDragFile && 'cursor-grab active:cursor-grabbing',
                    )}
                    title={file.name}
                    onMouseDown={(e) => {
                      if (canDragFile) e.stopPropagation();
                    }}
                    onDragStart={handleDragStart}
                    onDragEnd={clearDraggingFiles}
                  >
                    <FileRowIcon className='shrink-0 text-(--mantine-color-dimmed)' file={file} />
                    <span className='truncate'>{file.name}</span>
                  </span>
                </Tooltip>
              </TableData>

              <TableData>
                <span className='flex items-center gap-4 min-w-fit text-nowrap'>
                  {bytesToString(preferPhysicalSize ? file.sizePhysical : file.size)}
                </span>
              </TableData>

              <TableData className='hidden md:table-cell min-w-fit text-nowrap'>
                <FormattedTimestamp timestamp={file.modified} showNA />
              </TableData>

              <ContextMenuToggle items={items} openMenu={openMenu} />
            </TableRow>
          )}
        </FileRowContextMenu>
      )}
    </FileMassContextMenu>
  );
});

export default memo(FileRow);
