import {
  faArrowRight,
  faCheck,
  faFolderOpen,
  faWindowRestore,
  faXmark,
  faXmarksLines,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { join } from 'pathe';
import { DragEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import UnstyledButton from '@/elements/buttons/UnstyledButton.tsx';
import ScrollArea from '@/elements/layout/ScrollArea.tsx';
import { useContextMenu } from '@/elements/overlays/ContextMenu.tsx';
import FileRowIcon from '@/pages/server/files/list/FileRowIcon.tsx';
import FileTreeName from '@/pages/server/files/tree/FileTreeName.tsx';
import {
  FILE_TREE_EDITOR_TAB_DRAG_TYPE,
  FileTreeEditorSelection,
  FileTreeEditorTabDragData,
  FileTreeTabCloseAction,
  FileTreeTabPosition,
  getFileTreeEditorTabDragData,
  getFileTreeEditorTabId,
  setFileTreeEditorTabDragData,
} from '@/pages/server/files/tree/fileTreeEditor.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileTreeEditorTabsProps {
  paneId: string;
  tabs: FileTreeEditorSelection[];
  activeTabId: string | null;
  previewTabId?: string;
  dirtyTabIds: ReadonlySet<string>;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string, action?: FileTreeTabCloseAction) => void;
  onMove: (drag: FileTreeEditorTabDragData, position: FileTreeTabPosition) => void;
  onReveal: (tabId: string) => void;
  onKeepOpen: (tabId: string) => void;
}

interface TabDragPreview {
  tabId: string;
  order: string;
  rects: { tabId: string; left: number; width: number }[];
}

export default function FileTreeEditorTabs({
  paneId,
  tabs,
  activeTabId,
  previewTabId,
  dirtyTabIds,
  onSelect,
  onClose,
  onMove,
  onReveal,
  onKeepOpen,
}: FileTreeEditorTabsProps) {
  const { t } = useTranslations();
  const { showMenu } = useContextMenu();
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);
  const [dropPosition, setDropPosition] = useState<FileTreeTabPosition | null>(null);
  const [dragPreview, setDragPreview] = useState<TabDragPreview | null>(null);
  const tabOrder = useMemo(() => JSON.stringify(tabs.map(getFileTreeEditorTabId)), [tabs]);
  const previewOffsets = useMemo(() => {
    if (!dragPreview || dragPreview.order !== tabOrder || !dropPosition) return null;
    const sourceIndex = dragPreview.rects.findIndex((tab) => tab.tabId === dragPreview.tabId);
    const anchorIndex = dragPreview.rects.findIndex((tab) => tab.tabId === dropPosition.tabId);
    if (sourceIndex === -1 || anchorIndex === -1) return null;
    const insertionIndex = anchorIndex + Number(dropPosition.after);
    const rects = [...dragPreview.rects];
    const [source] = rects.splice(sourceIndex, 1);
    rects.splice(insertionIndex - Number(sourceIndex < insertionIndex), 0, source);
    let left = dragPreview.rects[0].left;
    return new Map(
      rects.map((tab) => {
        const offset = left - tab.left;
        left += tab.width;
        return [tab.tabId, offset];
      }),
    );
  }, [dragPreview, dropPosition, tabOrder]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const tab = activeTabRef.current;
    if (!viewport || !tab || !activeTabId || !tabOrder) return;
    const reveal = () => {
      const bounds = viewport.getBoundingClientRect();
      const tabBounds = tab.getBoundingClientRect();
      if (!bounds.width) return;
      if (tabBounds.left < bounds.left) viewport.scrollLeft += tabBounds.left - bounds.left;
      else if (tabBounds.right > bounds.right) viewport.scrollLeft += tabBounds.right - bounds.right;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [activeTabId, tabOrder]);

  useEffect(() => {
    const clear = () => {
      setDropPosition(null);
      setDragPreview(null);
    };
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const getDropPosition = (event: DragEvent): FileTreeTabPosition => {
    const viewport = viewportRef.current;
    if (viewport && dragPreview?.order === tabOrder) {
      const x = event.clientX - viewport.getBoundingClientRect().left + viewport.scrollLeft;
      const candidates = dragPreview.rects.filter((tab) => tab.tabId !== dragPreview.tabId);
      const before = candidates.find((tab) => x < tab.left + tab.width / 2);
      return before
        ? { tabId: before.tabId, after: false }
        : { tabId: candidates.at(-1)?.tabId ?? dragPreview.tabId, after: true };
    }
    const element = (event.target as Element).closest<HTMLElement>('[data-file-manager-editor-tab]');
    return element?.dataset.tabId
      ? {
          tabId: element.dataset.tabId,
          after: event.clientX > element.getBoundingClientRect().left + element.offsetWidth / 2,
        }
      : { tabId: getFileTreeEditorTabId(tabs[tabs.length - 1]), after: true };
  };

  if (tabs.length === 0) return null;

  return (
    <ScrollArea
      type='auto'
      scrollbars='x'
      scrollbarSize={10}
      viewportRef={viewportRef}
      viewportProps={{ role: 'tablist', 'aria-label': t('pages.server.files.tree.editorTabsLabel', {}) }}
      classNames={{ content: 'flex! w-max min-w-full' }}
      data-file-manager-editor-tabs
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(FILE_TREE_EDITOR_TAB_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const position = getDropPosition(event);
        setDropPosition((current) =>
          current?.tabId === position.tabId && current.after === position.after ? current : position,
        );
        const viewport = viewportRef.current;
        if (viewport) {
          const bounds = viewport.getBoundingClientRect();
          if (event.clientX < bounds.left + 24) viewport.scrollLeft -= 12;
          else if (event.clientX > bounds.right - 24) viewport.scrollLeft += 12;
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropPosition(null);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes(FILE_TREE_EDITOR_TAB_DRAG_TYPE)) return;
        event.preventDefault();
        event.stopPropagation();
        setDropPosition(null);
        setDragPreview(null);
        const drag = getFileTreeEditorTabDragData(event.dataTransfer);
        if (drag) onMove(drag, getDropPosition(event));
      }}
      className='h-[calc(2.625rem+1px+var(--file-manager-editor-tab-gutter,0px))] min-w-0 shrink-0 border-b border-(--mantine-color-default-border)'
    >
      {tabs.map((tab, index) => {
        const tabId = getFileTreeEditorTabId(tab);
        const active = tabId === activeTabId;
        const dirty = dirtyTabIds.has(tabId);
        const path = join(tab.directory, tab.file.name);
        const dragging = dragPreview?.tabId === tabId;

        return (
          <div
            key={tabId}
            ref={active ? activeTabRef : undefined}
            data-file-manager-editor-tab
            data-tab-id={tabId}
            data-active={active || undefined}
            data-dirty={dirty || undefined}
            data-preview={tabId === previewTabId || undefined}
            data-dragging={dragging || undefined}
            data-drop-position={dropPosition?.tabId === tabId ? (dropPosition.after ? 'after' : 'before') : undefined}
            style={{
              transform: previewOffsets ? `translateX(${previewOffsets.get(tabId) ?? 0}px)` : undefined,
              opacity: dragging ? 0.3 : undefined,
              boxShadow:
                !previewOffsets && dropPosition?.tabId === tabId
                  ? `inset ${dropPosition.after ? '-2px' : '2px'} 0 var(--mantine-primary-color-filled)`
                  : undefined,
            }}
            draggable
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const hasSavedTabs = tabs.some(
                (tab) => tab.action !== 'new' && !dirtyTabIds.has(getFileTreeEditorTabId(tab)),
              );
              showMenu(event.clientX, event.clientY, [
                { type: 'action', icon: faXmark, label: t('common.button.close', {}), onClick: () => onClose(tabId) },
                {
                  type: 'action',
                  icon: faWindowRestore,
                  label: t('pages.server.files.tree.closeOtherTabs', {}),
                  disabled: tabs.length < 2,
                  onClick: () => onClose(tabId, 'others'),
                },
                {
                  type: 'action',
                  icon: faArrowRight,
                  label: t('pages.server.files.tree.closeTabsToRight', {}),
                  disabled: index === tabs.length - 1,
                  onClick: () => onClose(tabId, 'right'),
                },
                {
                  type: 'action',
                  icon: faCheck,
                  label: t('pages.server.files.tree.closeSavedTabs', {}),
                  disabled: !hasSavedTabs,
                  onClick: () => onClose(tabId, 'saved'),
                },
                {
                  type: 'action',
                  icon: faXmarksLines,
                  label: t('pages.server.files.tree.closeAllTabs', {}),
                  onClick: () => onClose(tabId, 'all'),
                },
                { type: 'divider' },
                {
                  type: 'action',
                  icon: faFolderOpen,
                  label: t('pages.server.files.tree.revealInTree', {}),
                  disabled: tab.action === 'new',
                  onClick: () => onReveal(tabId),
                },
              ]);
            }}
            onDragStart={(event) => {
              onKeepOpen(tabId);
              setFileTreeEditorTabDragData(event.dataTransfer, { tabId, paneId });
              const viewport = viewportRef.current;
              if (!viewport) return;
              const left = viewport.getBoundingClientRect().left - viewport.scrollLeft;
              const rects = Array.from(
                viewport.querySelectorAll<HTMLElement>('[data-file-manager-editor-tab]'),
                (element) => {
                  const rect = element.getBoundingClientRect();
                  return { tabId: element.dataset.tabId!, left: rect.left - left, width: rect.width };
                },
              );
              setDragPreview({ tabId, order: tabOrder, rects });
            }}
            onMouseDown={(event) => {
              if (event.button === 1) event.preventDefault();
            }}
            onAuxClick={(event) => {
              if (event.button !== 1) return;

              event.preventDefault();
              event.stopPropagation();
              onClose(tabId);
            }}
            className={classNames(
              'group flex h-[2.625rem] min-h-[2.625rem] min-w-0 max-w-56 shrink-0 cursor-grab items-center gap-2 overflow-hidden border-r border-b-2 border-(--mantine-color-default-border) active:cursor-grabbing',
              dragPreview && 'transition-transform duration-150 ease-out motion-reduce:transition-none',
              active
                ? 'border-b-(--mantine-primary-color-filled) bg-(--mantine-color-default-hover)'
                : 'border-b-transparent hover:bg-(--mantine-color-default-hover)',
            )}
          >
            <UnstyledButton
              role='tab'
              type='button'
              title={path}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(tabId)}
              onDoubleClick={() => onKeepOpen(tabId)}
              className='flex min-w-0 flex-1 items-center gap-2 py-2 pl-4! text-sm'
            >
              <FileRowIcon file={tab.file} className='w-4 shrink-0' />
              <FileTreeName name={tab.file.name} className={classNames('flex-1', tabId === previewTabId && 'italic')} />
              {dirty && (
                <span
                  aria-label={t('pages.server.files.tree.unsavedTab', { name: tab.file.name })}
                  className='h-2 w-2 shrink-0 rounded-full bg-(--mantine-primary-color-filled)'
                />
              )}
            </UnstyledButton>

            <ActionIcon
              type='button'
              size='xs'
              variant='subtle'
              color='gray'
              className='mr-1.5 shrink-0'
              aria-label={t('pages.server.files.tree.closeEditorTab', { name: tab.file.name })}
              onClick={() => onClose(tabId)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </ActionIcon>
          </div>
        );
      })}
    </ScrollArea>
  );
}
