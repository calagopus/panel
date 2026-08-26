import { faChevronDown, faChevronRight, faEllipsis } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { memo, useEffect, useMemo } from 'react';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { isOpenableFile } from '@/lib/files/files.ts';
import { bytesToString } from '@/lib/size.ts';
import FileRowContextMenu from '@/pages/server/files/browser/FileRowContextMenu.tsx';
import FileRowIcon from '@/pages/server/files/browser/FileRowIcon.tsx';
import FileTreeName from '@/pages/server/files/workspace/FileTreeName.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi } from '@/stores/fileManager.ts';
import { FileTreeRow as FileTreeRowData, TreeSelectionItem } from './fileTreeData.ts';

type EntryRow = Extract<FileTreeRowData, { type: 'entry' }>;

interface FileTreeRowProps {
  item: TreeSelectionItem;
  row: EntryRow;
  rowHeight: number;
  selected: boolean;
  dragged: boolean;
  moving: boolean;
  canUpdateFiles: boolean;
  parentWritable: boolean;
  parentFast: boolean;
  directoryWritable: boolean;
  preferPhysicalSize: boolean;
  useMassMenu: boolean;
  menuPosition: { x: number; y: number } | null;
  openMassMenu: (x: number, y: number) => void;
  onOpenContextMenu: (item: TreeSelectionItem, x: number, y: number) => void;
  onOpen: (item: TreeSelectionItem) => void;
  onToggleSelection: (item: TreeSelectionItem) => void;
  onStartDrag: (event: React.DragEvent, item: TreeSelectionItem) => void;
  onDragEnd: () => void;
}

function ContextMenuOpener({ x, y, openMenu }: { x: number; y: number; openMenu: (x: number, y: number) => void }) {
  useEffect(() => {
    openMenu(x, y);
  }, [x, y, openMenu]);

  return null;
}

function FileTreeRow({
  item,
  row,
  rowHeight,
  selected,
  dragged,
  moving,
  canUpdateFiles,
  parentWritable,
  parentFast,
  directoryWritable,
  preferPhysicalSize,
  useMassMenu,
  menuPosition,
  openMassMenu,
  onOpenContextMenu,
  onOpen,
  onToggleSelection,
  onStartDrag,
  onDragEnd,
}: FileTreeRowProps) {
  const { t } = useTranslations();
  const store = useFileManagerApi();
  const openMode = useMemo(
    () =>
      isOpenableFile(row.entry, {
        ...store.getState(),
        browsingDirectory: row.parent,
        browsingWritableDirectory: parentWritable,
        browsingFastDirectory: parentFast,
      }),
    [parentFast, parentWritable, row.entry, row.parent, store],
  );
  const canDrag = (canUpdateFiles && parentWritable && !moving) || (!row.entry.directory && openMode.openable);

  const prepareFileManager = () => {
    const state = store.getState();
    state.setBrowsingContext({ directory: row.parent, writable: parentWritable, fast: parentFast });
    if (!useMassMenu) state.doSelectFiles([]);
  };

  const openContextMenu = (x: number, y: number) => {
    prepareFileManager();
    if (useMassMenu) openMassMenu(x, y);
    else onOpenContextMenu(item, x, y);
  };

  return (
    <>
      <div
        role='treeitem'
        tabIndex={0}
        aria-level={row.depth + 1}
        aria-expanded={row.entry.directory ? row.expanded : undefined}
        aria-selected={selected}
        data-file-manager-tree-row
        data-file-tree-directory={row.entry.directory ? row.path : undefined}
        data-file-tree-drop-target={row.entry.directory ? row.path : row.parent}
        data-file-tree-drop-writable={String(row.entry.directory ? directoryWritable : parentWritable)}
        onClick={() => onOpen(item)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openContextMenu(event.clientX, event.clientY);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;

          event.preventDefault();
          onOpen(item);
        }}
        className={classNames(
          'grid w-full cursor-pointer grid-cols-(--file-manager-tree-columns) items-center gap-x-2 text-left text-sm [contain:layout_paint] hover:bg-(--mantine-color-default-hover)! focus-visible:outline-2 focus-visible:outline-(--mantine-primary-color-filled)',
          dragged && 'opacity-60',
        )}
        style={{
          height: rowHeight,
          backgroundColor: selected ? 'var(--mantine-color-blue-light)' : undefined,
          boxShadow: selected ? 'inset 3px 0 0 var(--mantine-color-blue-5)' : undefined,
        }}
      >
        <div
          data-file-manager-tree-name
          className='flex min-w-0 items-center gap-2'
          style={{ paddingLeft: 10 + row.depth * 16 }}
        >
          <Checkbox
            size='xs'
            checked={selected}
            disabled={moving}
            aria-label={t(selected ? 'pages.server.files.tree.deselectItem' : 'pages.server.files.tree.selectItem', {
              name: row.entry.name,
            })}
            classNames={{ input: 'cursor-pointer!' }}
            onChange={() => onToggleSelection(item)}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          />

          {row.entry.directory ? (
            <FontAwesomeIcon
              icon={row.expanded ? faChevronDown : faChevronRight}
              className='w-2.5 shrink-0 text-xs text-(--mantine-color-dimmed)'
            />
          ) : (
            <span className='w-2.5 shrink-0' />
          )}

          <span
            draggable={canDrag}
            title={canDrag ? t('pages.server.files.tooltip.dragToMove', {}) : row.entry.name}
            onMouseDown={(event) => event.stopPropagation()}
            onDragStart={(event) => onStartDrag(event, item)}
            onDragEnd={onDragEnd}
            className={classNames('flex min-w-0 items-center gap-2', canDrag && 'cursor-grab active:cursor-grabbing')}
          >
            <FileRowIcon file={row.entry} openable={openMode.openable} className='w-4 shrink-0' />
            <FileTreeName name={row.entry.name} directory={row.entry.directory} className='flex-1' />
          </span>
        </div>

        <span data-file-manager-tree-size className='truncate text-xs text-(--mantine-color-dimmed)'>
          {bytesToString(preferPhysicalSize ? row.entry.sizePhysical : row.entry.size)}
        </span>

        <span data-file-manager-tree-modified className='min-w-0 truncate text-xs text-(--mantine-color-dimmed)'>
          <FormattedTimestamp
            timestamp={row.entry.modified}
            autoUpdate={false}
            showNA
            withTooltip={false}
            className='truncate'
          />
        </span>

        <ActionIcon
          type='button'
          size='xs'
          variant='subtle'
          color='gray'
          title={t('pages.server.files.button.more', {})}
          aria-label={t('pages.server.files.button.more', {})}
          className='justify-self-center opacity-60 hover:opacity-100'
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            openContextMenu(rect.left, rect.bottom);
          }}
        >
          <FontAwesomeIcon icon={faEllipsis} fixedWidth />
        </ActionIcon>
      </div>

      {menuPosition && (
        <FileRowContextMenu
          file={row.entry}
          openMode={openMode}
          directory={row.parent}
          writableDirectory={parentWritable}
          surface='tree'
        >
          {({ openMenu }) => <ContextMenuOpener {...menuPosition} openMenu={openMenu} />}
        </FileRowContextMenu>
      )}
    </>
  );
}

export default memo(FileTreeRow);
