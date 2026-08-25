import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { CSSProperties, Ref, RefObject, useCallback, useRef, useState } from 'react';
import ScrollArea from '@/elements/ScrollArea.tsx';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Spinner from '@/elements/Spinner.tsx';
import UnstyledButton from '@/elements/UnstyledButton.tsx';
import FileTreeRow from '@/pages/server/files/FileTreeRow.tsx';
import {
  FileTreeRow as FileTreeRowData,
  TreeDirectoryCapabilities,
  TreeSelectionItem,
} from '@/pages/server/files/fileTreeData.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileTreeVirtualListProps {
  rows: FileTreeRowData[];
  itemsByPath: ReadonlyMap<string, TreeSelectionItem>;
  selectedPaths: ReadonlySet<string>;
  draggedPaths: ReadonlySet<string>;
  rowHeight: number;
  moving: boolean;
  canUpdateFiles: boolean;
  clickOnce: boolean;
  preferPhysicalSize: boolean;
  massSelectionDirectory: string | null;
  openMassMenu: (x: number, y: number) => void;
  headerRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  getDirectoryCapabilities: (path: string) => TreeDirectoryCapabilities;
  isDirectoryWritable: (path: string, parent: string, virtual: boolean) => boolean;
  onSelectedStart: (event: React.MouseEvent | MouseEvent) => void;
  onSelected: (items: TreeSelectionItem[]) => void;
  onOpen: (item: TreeSelectionItem) => void;
  onToggleSelection: (item: TreeSelectionItem) => void;
  onStartDrag: (event: React.DragEvent, item: TreeSelectionItem) => void;
  onDragEnd: () => void;
  onLoadPage: (directory: string, page: number) => Promise<void>;
}

export default function FileTreeVirtualList({
  rows,
  itemsByPath,
  selectedPaths,
  draggedPaths,
  rowHeight,
  moving,
  canUpdateFiles,
  clickOnce,
  preferPhysicalSize,
  massSelectionDirectory,
  openMassMenu,
  headerRef,
  viewportRef,
  getDirectoryCapabilities,
  isDirectoryWritable,
  onSelectedStart,
  onSelected,
  onOpen,
  onToggleSelection,
  onStartDrag,
  onDragEnd,
  onLoadPage,
}: FileTreeVirtualListProps) {
  const { t } = useTranslations();
  const lastScrollLeftRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const [menuRequest, setMenuRequest] = useState<{ path: string; x: number; y: number } | null>(null);
  const menuRequestRef = useRef(menuRequest);
  menuRequestRef.current = menuRequest;
  const openRowContextMenu = useCallback((item: TreeSelectionItem, x: number, y: number) => {
    setMenuRequest({ path: item.path, x, y });
  }, []);
  const getScrollElement = useCallback(() => viewportRef.current, [viewportRef]);
  const estimateRowSize = useCallback(() => rowHeight, [rowHeight]);
  const getRowKey = useCallback((index: number) => rows[index]?.key ?? index, [rows]);
  const syncScrollPosition = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      if (y !== lastScrollTopRef.current) {
        lastScrollTopRef.current = y;
        if (menuRequestRef.current) {
          menuRequestRef.current = null;
          setMenuRequest(null);
        }
      }
      if (x === lastScrollLeftRef.current) return;

      lastScrollLeftRef.current = x;
      headerRef.current?.style.setProperty('transform', `translateX(${-x}px)`);
    },
    [headerRef],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize: estimateRowSize,
    getItemKey: getRowKey,
    overscan: 5,
  });

  return (
    <ScrollArea
      viewportRef={viewportRef}
      type='auto'
      scrollbarSize={8}
      className='min-h-0 flex-1'
      onScrollPositionChange={syncScrollPosition}
    >
      <SelectionArea<TreeSelectionItem>
        onSelectedStart={onSelectedStart}
        onSelected={onSelected}
        deferSelection
        fireEvents={false}
        className='h-full select-none'
        disabled={moving}
      >
        <div
          role='tree'
          data-file-manager-tree-table
          className='relative min-w-(--file-manager-tree-min-content-width)'
          style={{ height: virtualizer.getTotalSize() + 8 }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const virtualStyle: CSSProperties = {
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            };

            if (row.type !== 'entry') {
              const inset = 36 + row.depth * 16;

              return (
                <div key={row.key} className='absolute left-0 top-0 w-full' style={virtualStyle}>
                  {row.type === 'loading' ? (
                    <div className='flex items-center' style={{ height: rowHeight, paddingLeft: inset }}>
                      <Spinner size={14} />
                    </div>
                  ) : row.type === 'empty' || row.type === 'searchEmpty' ? (
                    <div
                      className='flex items-center text-xs text-(--mantine-color-dimmed)'
                      style={{ height: rowHeight, paddingLeft: inset }}
                    >
                      {t(
                        row.type === 'searchEmpty'
                          ? 'pages.server.files.tree.noSearchResults'
                          : 'pages.server.files.tree.empty',
                        {},
                      )}
                    </div>
                  ) : (
                    <div className='flex items-center' style={{ height: rowHeight, paddingLeft: inset }}>
                      <UnstyledButton
                        type='button'
                        disabled={row.loading}
                        title={row.type === 'error' ? row.message : undefined}
                        onClick={() => void onLoadPage(row.directory, row.page)}
                        className={classNames(
                          'inline-flex h-6 items-center gap-1.5 rounded px-2 text-xs font-medium hover:bg-(--mantine-color-default-hover) disabled:cursor-wait',
                          row.type === 'error' ? 'text-(--mantine-color-red-5)' : 'text-(--mantine-color-blue-5)',
                        )}
                      >
                        {row.loading ? (
                          <Spinner size={12} />
                        ) : row.type === 'loadMore' ? (
                          <>
                            <FontAwesomeIcon icon={faChevronDown} className='text-[0.625rem]' />
                            {t('pages.server.files.tree.loadMore', {})}
                          </>
                        ) : (
                          t('pages.server.files.tree.retry', {})
                        )}
                      </UnstyledButton>
                    </div>
                  )}
                </div>
              );
            }

            const item = itemsByPath.get(row.path);
            if (!item) return null;

            const useMassMenu = !!massSelectionDirectory && selectedPaths.has(row.path);
            const parentCapabilities = getDirectoryCapabilities(row.parent);

            return (
              <SelectionArea.Selectable key={row.key} item={item}>
                {(innerRef: Ref<HTMLElement>) => (
                  <div
                    ref={innerRef as Ref<HTMLDivElement>}
                    className='absolute left-0 top-0 w-full'
                    style={virtualStyle}
                  >
                    <FileTreeRow
                      item={item}
                      row={row}
                      rowHeight={rowHeight}
                      selected={selectedPaths.has(row.path)}
                      dragged={draggedPaths.has(row.path)}
                      moving={moving}
                      canUpdateFiles={canUpdateFiles}
                      parentWritable={parentCapabilities.writable}
                      parentFast={parentCapabilities.fast}
                      directoryWritable={isDirectoryWritable(row.path, row.parent, row.entry.virtual)}
                      clickOnce={clickOnce}
                      preferPhysicalSize={preferPhysicalSize}
                      useMassMenu={useMassMenu}
                      menuPosition={menuRequest?.path === row.path ? menuRequest : null}
                      openMassMenu={openMassMenu}
                      onOpenContextMenu={openRowContextMenu}
                      onOpen={onOpen}
                      onToggleSelection={onToggleSelection}
                      onStartDrag={onStartDrag}
                      onDragEnd={onDragEnd}
                    />
                  </div>
                )}
              </SelectionArea.Selectable>
            );
          })}
        </div>
      </SelectionArea>
    </ScrollArea>
  );
}
