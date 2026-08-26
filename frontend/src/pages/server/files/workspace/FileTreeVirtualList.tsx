import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useMergedRef } from '@mantine/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { ReactNode, Ref, RefObject, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import SelectionArea from '@/elements/SelectionArea.tsx';
import Spinner from '@/elements/Spinner.tsx';
import UnstyledButton from '@/elements/UnstyledButton.tsx';
import FileTreeRow from '@/pages/server/files/workspace/FileTreeRow.tsx';
import FileTreeScrollingRow from '@/pages/server/files/workspace/FileTreeScrollingRow.tsx';
import {
  FileTreeRow as FileTreeRowData,
  TreeDirectoryCapabilities,
  TreeSelectionItem,
} from '@/pages/server/files/workspace/fileTreeData.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileTreeVirtualListProps {
  rows: FileTreeRowData[];
  itemsByPath: ReadonlyMap<string, TreeSelectionItem>;
  activePath: string | null;
  selectedPaths: ReadonlySet<string>;
  draggedPaths: ReadonlySet<string>;
  rowHeight: number;
  moving: boolean;
  canUpdateFiles: boolean;
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

interface VirtualTreeRowContainerProps {
  index: number;
  height: number;
  measureElement: (node: HTMLDivElement | null) => void;
  selectionRef?: Ref<HTMLElement>;
  children: ReactNode;
}

function VirtualTreeRowContainer({
  index,
  height,
  measureElement,
  selectionRef,
  children,
}: VirtualTreeRowContainerProps) {
  const ref = useMergedRef<HTMLDivElement>(selectionRef as Ref<HTMLDivElement>, measureElement);

  return (
    <div ref={ref} data-index={index} className='absolute left-0 top-0 w-full will-change-transform' style={{ height }}>
      {children}
    </div>
  );
}

export default function FileTreeVirtualList({
  rows,
  itemsByPath,
  activePath,
  selectedPaths,
  draggedPaths,
  rowHeight,
  moving,
  canUpdateFiles,
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
  useEffect(() => {
    menuRequestRef.current = menuRequest;
  }, [menuRequest]);
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
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      syncScrollPosition({ x: event.currentTarget.scrollLeft, y: event.currentTarget.scrollTop });
    },
    [syncScrollPosition],
  );
  // This pane owns its scroll viewport. Keep scroll-only movement out of React, but commit range jumps immediately.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize: estimateRowSize,
    getItemKey: getRowKey,
    overscan: 6,
    paddingEnd: 8,
    directDomUpdates: true,
    isScrollingResetDelay: 80,
    useScrollendEvent: true,
    useFlushSync: true,
  });
  const virtualRows = useSyncExternalStore(
    () => () => undefined,
    () => virtualizer.getVirtualItems(),
  );
  const scrolling = virtualizer.isScrolling;

  return (
    <div ref={viewportRef} className='file-manager-tree-viewport min-h-0 flex-1 overflow-auto' onScroll={handleScroll}>
      <SelectionArea<TreeSelectionItem>
        onSelectedStart={onSelectedStart}
        onSelected={onSelected}
        deferSelection
        fireEvents={false}
        className='h-full select-none'
        disabled={moving}
      >
        <div
          ref={virtualizer.containerRef}
          role='tree'
          data-file-manager-tree-table
          className='relative min-w-(--file-manager-tree-min-content-width)'
        >
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];

            if (row.type !== 'entry') {
              const inset = 36 + row.depth * 16;

              return (
                <VirtualTreeRowContainer
                  key={row.key}
                  index={virtualRow.index}
                  height={virtualRow.size}
                  measureElement={virtualizer.measureElement}
                >
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
                </VirtualTreeRowContainer>
              );
            }

            const item = itemsByPath.get(row.path);
            if (!item) return null;

            const selected = selectedPaths.has(row.path);
            const active = row.path === activePath;
            const useMassMenu = !scrolling && !!massSelectionDirectory && selected;
            const parentCapabilities = scrolling ? null : getDirectoryCapabilities(row.parent);

            return (
              <SelectionArea.Selectable key={row.key} item={item}>
                {(innerRef: Ref<HTMLElement>) => (
                  <VirtualTreeRowContainer
                    index={virtualRow.index}
                    height={virtualRow.size}
                    measureElement={virtualizer.measureElement}
                    selectionRef={innerRef}
                  >
                    {scrolling ? (
                      <FileTreeScrollingRow
                        row={row}
                        rowHeight={rowHeight}
                        active={active}
                        selected={selected}
                        preferPhysicalSize={preferPhysicalSize}
                      />
                    ) : (
                      <FileTreeRow
                        item={item}
                        row={row}
                        rowHeight={rowHeight}
                        active={active}
                        selected={selected}
                        dragged={draggedPaths.has(row.path)}
                        moving={moving}
                        canUpdateFiles={canUpdateFiles}
                        parentWritable={parentCapabilities!.writable}
                        parentFast={parentCapabilities!.fast}
                        directoryWritable={isDirectoryWritable(row.path, row.parent, row.entry.virtual)}
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
                    )}
                  </VirtualTreeRowContainer>
                )}
              </SelectionArea.Selectable>
            );
          })}
        </div>
      </SelectionArea>
    </div>
  );
}
