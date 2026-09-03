import { faChevronDown, faChevronRight, faEllipsis } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { memo, useEffect, useMemo, useRef } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { isOpenableFile } from '@/lib/files/files.ts';
import { bytesToString } from '@/lib/format/size.ts';
import FileRowContextMenu from '@/pages/server/files/list/FileRowContextMenu.tsx';
import FileRowIcon from '@/pages/server/files/list/FileRowIcon.tsx';
import FileTreeName from '@/pages/server/files/tree/FileTreeName.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { FileTreeRow as FileTreeRowData, TreeSelectionItem } from './fileTreeData.ts';

type EntryRow = Extract<FileTreeRowData, { type: 'entry' }>;

interface FileTreeRowProps {
  item: TreeSelectionItem;
  row: EntryRow;
  rowHeight: number;
  active: boolean;
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
  onSelect: (item: TreeSelectionItem) => void;
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
  active,
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
  onSelect,
  onToggleSelection,
  onStartDrag,
  onDragEnd,
}: FileTreeRowProps) {
  const { t } = useTranslations();
  const store = useFileManagerApi();
  const anyActing = useFileManagerStore((state) => state.actingFiles.size > 0);
  const clickOnce = useFileManagerStore((state) => state.clickOnce);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );
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
  const canDrag =
    (canUpdateFiles && parentWritable && !moving && !anyActing) || (!row.entry.directory && openMode.openable);

  const handleClick = (event: React.MouseEvent) => {
    if (clickOnce) {
      onOpen(item);
      return;
    }

    clickCount.current += 1;
    if (clickTimer.current) return;

    if (event.ctrlKey || event.metaKey) onToggleSelection(item);
    else onSelect(item);

    clickTimer.current = setTimeout(() => {
      if (clickCount.current >= 2) onOpen(item);

      clickCount.current = 0;
      clickTimer.current = null;
    }, 250);
  };

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
        aria-expanded={row.expandable ? row.expanded : undefined}
        aria-current={active ? 'true' : undefined}
        aria-selected={selected}
        data-active-file={active || undefined}
        data-file-manager-tree-row
        data-file-tree-directory={row.entry.directory ? row.path : undefined}
        data-file-tree-drop-target={row.entry.directory ? row.path : row.parent}
        data-file-tree-drop-writable={String(row.entry.directory ? directoryWritable : parentWritable)}
        onClick={handleClick}
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
          'grid w-full select-none grid-cols-(--file-manager-tree-columns) items-center gap-x-2 text-left text-sm [contain:layout_paint] hover:bg-(--mantine-color-default-hover)! focus-visible:outline-2 focus-visible:outline-(--mantine-primary-color-filled)',
          clickOnce && openMode.openable && 'cursor-pointer',
          dragged && 'opacity-60',
        )}
        style={{
          height: rowHeight,
          backgroundColor: active
            ? 'var(--mantine-color-default-hover)'
            : selected
              ? 'var(--mantine-color-blue-light)'
              : undefined,
          boxShadow: active
            ? 'inset 3px 0 0 var(--mantine-primary-color-filled)'
            : selected
              ? 'inset 3px 0 0 var(--mantine-color-blue-5)'
              : undefined,
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
            onKeyDown={(event) => {
              // Only swallow the keys the row itself acts on; anything else has to reach the
              // window so file manager shortcuts still work while a checkbox holds focus.
              if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
            }}
          />

          {row.expandable ? (
            <span
              aria-hidden='true'
              // The chevron is the expand affordance itself, so it toggles on a single click even
              // when the row is waiting for a double one.
              onClick={(event) => {
                event.stopPropagation();
                onOpen(item);
              }}
              onMouseDown={(event) => event.stopPropagation()}
              className='shrink-0 cursor-pointer'
            >
              <FontAwesomeIcon
                icon={row.expanded ? faChevronDown : faChevronRight}
                className='w-2.5 text-xs text-(--mantine-color-dimmed)'
              />
            </span>
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
            <FileRowIcon
              file={row.entry}
              openable={openMode.openable}
              archive={row.expandable && !row.entry.directory}
              className='w-4 shrink-0'
            />
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
          <FontAwesomeIcon icon={faEllipsis} />
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
