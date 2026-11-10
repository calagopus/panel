import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { ReactNode, Ref, RefObject, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import UnstyledButton from '@/elements/buttons/UnstyledButton.tsx';
import SelectionArea from '@/elements/dnd/SelectionArea.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { useElementVirtualizer } from '@/lib/elementVirtualizer.ts';
import { canPreviewFile, estimateFileSearchPreviewHeight } from '@/pages/server/files/list/FileSearchPreview.tsx';
import {
  FileTreeRow as FileTreeRowData,
  TreeDirectoryCapabilities,
  TreeSelectionItem,
} from '@/pages/server/files/tree/fileTreeData.ts';
import FileTreeRow from '@/pages/server/files/tree/FileTreeRow.tsx';
import FileTreeScrollingRow from '@/pages/server/files/tree/FileTreeScrollingRow.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerStore } from '@/stores/fileManager.ts';

interface FileTreeVirtualListProps {
  rows: FileTreeRowData[];
  itemsByPath: ReadonlyMap<string, TreeSelectionItem>;
  activePath: string | null;
  selectedPaths: ReadonlySet<string>;
  draggedPaths: ReadonlySet<string>;
  rowHeight: number;
  moving: boolean;
  canUpdateFiles: boolean;
  dragDisabled: boolean;
  preferPhysicalSize: boolean;
  massSelectionDirectory: string | null;
  openMassMenu: (x: number, y: number) => void;
  headerRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  scrollToRowRef: RefObject<((index: number) => void) | null>;
  getDirectoryCapabilities: (path: string) => TreeDirectoryCapabilities;
  isDirectoryWritable: (path: string, parent: string, virtual: boolean) => boolean;
  onSelectedStart: (event: React.MouseEvent | MouseEvent) => void;
  onSelected: (items: TreeSelectionItem[]) => void;
  onOpen: (item: TreeSelectionItem) => void;
  onSelect: (item: TreeSelectionItem) => void;
  onToggleSelection: (item: TreeSelectionItem) => void;
  onStartDrag: (event: React.DragEvent, item: TreeSelectionItem) => void;
  onDragEnd: () => void;
  onCreateFileIn?: (directory: string, writable: boolean) => void;
  onCreateDirectoryIn?: (directory: string, writable: boolean) => void;
  onLoadPage: (directory: string, page: number) => Promise<void>;
}

interface VirtualTreeRowContainerProps {
  index: number;
  measureElement: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}

function VirtualTreeRowContainer({ index, measureElement, children }: VirtualTreeRowContainerProps) {
  return (
    <div ref={measureElement} data-index={index} className='absolute left-0 top-0 w-full will-change-transform'>
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
  dragDisabled,
  preferPhysicalSize,
  massSelectionDirectory,
  openMassMenu,
  headerRef,
  viewportRef,
  scrollToRowRef,
  getDirectoryCapabilities,
  isDirectoryWritable,
  onSelectedStart,
  onSelected,
  onOpen,
  onSelect,
  onToggleSelection,
  onStartDrag,
  onDragEnd,
  onCreateFileIn,
  onCreateDirectoryIn,
  onLoadPage,
}: FileTreeVirtualListProps) {
  'use no memo'; // The virtualizer's return value cannot be memoized safely; opt this component out of the compiler.

  const { t } = useTranslations();
  const collapsedSearchPreviews = useFileManagerStore((state) => state.collapsedSearchPreviews);
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
  const estimateRowSize = useCallback(
    (index: number) => {
      const row = rows[index];
      return row?.type === 'entry' &&
        row.searchResult &&
        canPreviewFile(row.entry) &&
        !collapsedSearchPreviews.has(row.path)
        ? rowHeight + estimateFileSearchPreviewHeight(row.contentMatches) + 8
        : rowHeight;
    },
    [collapsedSearchPreviews, rowHeight, rows],
  );
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
  const virtualizer = useElementVirtualizer<HTMLDivElement>({
    count: rows.length,
    getScrollElement,
    estimateSize: estimateRowSize,
    getItemKey: getRowKey,
    overscan: 6,
    paddingEnd: 8,
    directDomUpdates: true,
    isScrollingResetDelay: 80,
    useFlushSync: true,
  });
  const virtualRows = useSyncExternalStore(
    () => () => undefined,
    () => virtualizer.getVirtualItems(),
  );
  const scrolling = virtualizer.isScrolling;

  useEffect(() => {
    scrollToRowRef.current = (index: number) => virtualizer.scrollToIndex(index, { align: 'auto' });

    return () => {
      scrollToRowRef.current = null;
    };
  }, [scrollToRowRef, virtualizer]);

  const setSizeContainer = useCallback((node: HTMLDivElement | null) => virtualizer.containerRef(node), [virtualizer]);

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
          ref={setSizeContainer}
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
            const hasSearchPreview = row.searchResult && canPreviewFile(row.entry);
            const renderScrollingRow = scrolling && !hasSearchPreview;
            const parentCapabilities = renderScrollingRow ? null : getDirectoryCapabilities(row.parent);

            return (
              <SelectionArea.Selectable key={row.key} item={item}>
                {(innerRef: Ref<HTMLElement>) => (
                  <VirtualTreeRowContainer index={virtualRow.index} measureElement={virtualizer.measureElement}>
                    {renderScrollingRow ? (
                      <FileTreeScrollingRow
                        row={row}
                        rowHeight={rowHeight}
                        selectionRef={innerRef}
                        active={active}
                        selected={selected}
                        preferPhysicalSize={preferPhysicalSize}
                      />
                    ) : (
                      <FileTreeRow
                        item={item}
                        previewExpanded={!collapsedSearchPreviews.has(row.path)}
                        row={row}
                        rowHeight={rowHeight}
                        selectionRef={innerRef}
                        active={active}
                        selected={selected}
                        dragged={draggedPaths.has(row.path)}
                        moving={moving}
                        canUpdateFiles={canUpdateFiles}
                        dragDisabled={dragDisabled}
                        parentWritable={parentCapabilities!.writable}
                        parentFast={parentCapabilities!.fast}
                        directoryWritable={isDirectoryWritable(row.path, row.parent, row.entry.virtual)}
                        preferPhysicalSize={preferPhysicalSize}
                        useMassMenu={useMassMenu}
                        menuPosition={menuRequest?.path === row.path ? menuRequest : null}
                        openMassMenu={openMassMenu}
                        onOpenContextMenu={openRowContextMenu}
                        onOpen={onOpen}
                        onSelect={onSelect}
                        onToggleSelection={onToggleSelection}
                        onStartDrag={onStartDrag}
                        onDragEnd={onDragEnd}
                        onCreateFileIn={onCreateFileIn}
                        onCreateDirectoryIn={onCreateDirectoryIn}
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
