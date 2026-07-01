import classNames from 'classnames';
import { join } from 'pathe';
import { forwardRef, memo, useMemo, useRef } from 'react';
import { FileOpenMode } from 'shared/src/registries/pages/server/files.ts';
import { z } from 'zod';
import { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { isOpenableFile } from '@/lib/files.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { bytesToString } from '@/lib/size.ts';
import FileRowContextMenu from '@/pages/server/files/FileRowContextMenu.tsx';
import { useDraggedFileMove } from '@/pages/server/files/hooks/useDraggedFileMove.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
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
  const anyActing = useFileManagerStore((state) => state.actingFiles.size > 0);

  return (
    <td className='pl-4 relative cursor-pointer w-10 text-center py-2'>
      <Checkbox
        id={file.name}
        checked={isSelected}
        classNames={{ input: 'cursor-pointer!' }}
        disabled={anyActing}
        onChange={toggleSelected}
        onClick={(e) => e.stopPropagation()}
      />
    </td>
  );
}

interface FileRowProps {
  file: z.infer<typeof serverDirectoryEntrySchema>;
  handleOpen: (openMode: FileOpenMode) => void;
  openMassMenu: (x: number, y: number) => void;
  isSelected: boolean;
  isActing: boolean;
  clickOnce: boolean;
  preferPhysicalSize: boolean;
}

const FileRow = forwardRef<HTMLTableRowElement, FileRowProps>(function FileRow(
  { file, handleOpen, openMassMenu, isSelected, isActing, clickOnce, preferPhysicalSize },
  ref,
) {
  const { t } = useTranslations();
  const canOpenActionBar = useServerCan(['files.read-content', 'files.archive', 'files.update', 'files.delete'], true);
  const canOpenFile = useServerCan('files.read-content');
  const canUpdateFiles = useServerCan('files.update');
  const store = useFileManagerApi();
  const browsingDirectory = useFileManagerStore((state) => state.browsingDirectory);
  const browsingWritableDirectory = useFileManagerStore((state) => state.browsingWritableDirectory);
  const browsingFastDirectory = useFileManagerStore((state) => state.browsingFastDirectory);
  const anyActing = useFileManagerStore((state) => state.actingFiles.size > 0);
  const isDraggingSource = useFileManagerStore(
    (state) => state.draggingFiles.has(file) && state.draggingFilesSource === state.browsingDirectory,
  );

  const targetDirectory = file.directory ? join(browsingDirectory, file.name) : null;
  const { moving, isDropTarget, getDropHandlers } = useDraggedFileMove({ targetDirectory });
  const openMode = useMemo(() => isOpenableFile(file, store.getState()), [file, browsingFastDirectory]);

  const toggleSelected = () => {
    const state = store.getState();
    if (isSelected) {
      state.removeSelectedFile(file);
    } else {
      state.addSelectedFile(file);
    }
  };

  const clickCount = useRef(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  const canDragFile = canUpdateFiles && browsingWritableDirectory && !anyActing && !moving;
  const fileIsDropTarget = !!targetDirectory && isDropTarget(targetDirectory);

  const handleDragStart = (e: React.DragEvent<HTMLElement>) => {
    if (!canDragFile) {
      e.preventDefault();
      return;
    }

    const state = store.getState();
    const files = state.selectedFiles.has(file) ? state.selectedFiles.values() : [file];

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-calagopus-file-manager', 'move');
    e.dataTransfer.setData('text/plain', files.map((file) => file.name).join('\n'));
    state.doDragFiles(files);
  };

  const handleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    clickCount.current += 1;

    if (clickTimer.current) return;

    const state = store.getState();

    if (state.actingFiles.size === 0) {
      if (e.shiftKey) {
        state.selectFileRange(file);
      } else if (e.ctrlKey || e.metaKey) {
        state.toggleSelectedFile(file);
      } else if (isSelected) {
        if (state.selectedFiles.size > 1) {
          state.selectFile(file);
        } else {
          state.removeSelectedFile(file);
        }
      } else {
        state.selectFile(file);
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
                onDragEnd={() => store.getState().clearDraggingFiles()}
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
  );
});

export default memo(FileRow);
