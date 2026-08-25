import classNames from 'classnames';
import { Fragment, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { FILE_TREE_EDITOR_DRAG_TYPE, FILE_TREE_EDITOR_TAB_DRAG_TYPE } from '@/pages/server/files/fileTreeEditor.ts';
import { FileTreeEditorPaneState } from '@/pages/server/files/fileTreeWorkspaceState.ts';

interface FileTreeEditorSplitProps {
  panes: FileTreeEditorPaneState[];
  activePaneId: string;
  dropLabel: string;
  resizeLabel: string;
  onActivatePane: (paneId: string) => void;
  onDrop: (paneId: string, dataTransfer: DataTransfer) => void;
  onResize: (leftPaneId: string, rightPaneId: string, leftSize: number, rightSize: number) => void;
  renderPane: (pane: FileTreeEditorPaneState, index: number) => ReactNode;
}

interface ResizeSession {
  leftPaneId: string;
  rightPaneId: string;
  leftElement: HTMLDivElement;
  rightElement: HTMLDivElement;
  startX: number;
  leftWidth: number;
  rightWidth: number;
  minimumWidth: number;
  combinedSize: number;
  nextLeftWidth: number;
  frame: number | null;
}

const acceptsEditorDrop = (dataTransfer: DataTransfer) => {
  const types = Array.from(dataTransfer.types);
  return types.includes(FILE_TREE_EDITOR_DRAG_TYPE) || types.includes(FILE_TREE_EDITOR_TAB_DRAG_TYPE);
};

export default function FileTreeEditorSplit({
  panes,
  activePaneId,
  dropLabel,
  resizeLabel,
  onActivatePane,
  onDrop,
  onResize,
  renderPane,
}: FileTreeEditorSplitProps) {
  const paneElements = useRef(new Map<string, HTMLDivElement>());
  const resizeSession = useRef<ResizeSession | null>(null);
  const [dropPaneId, setDropPaneId] = useState<string | null>(null);

  const finishResize = useCallback(() => {
    const session = resizeSession.current;
    if (!session) return;

    if (session.frame !== null) cancelAnimationFrame(session.frame);
    const combinedWidth = session.leftWidth + session.rightWidth;
    const leftRatio = session.nextLeftWidth / combinedWidth;
    onResize(
      session.leftPaneId,
      session.rightPaneId,
      session.combinedSize * leftRatio,
      session.combinedSize * (1 - leftRatio),
    );
    session.leftElement.style.removeProperty('flex');
    session.leftElement.style.removeProperty('width');
    session.rightElement.style.removeProperty('flex');
    session.rightElement.style.removeProperty('width');
    resizeSession.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onResize]);

  useEffect(() => finishResize, [finishResize]);

  const resize = (event: React.PointerEvent) => {
    const session = resizeSession.current;
    if (!session) return;

    const combinedWidth = session.leftWidth + session.rightWidth;
    session.nextLeftWidth = Math.min(
      combinedWidth - session.minimumWidth,
      Math.max(session.minimumWidth, session.leftWidth + event.clientX - session.startX),
    );
    if (session.frame !== null) return;

    session.frame = requestAnimationFrame(() => {
      session.frame = null;
      const rightWidth = combinedWidth - session.nextLeftWidth;
      session.leftElement.style.flex = `0 0 ${session.nextLeftWidth}px`;
      session.leftElement.style.width = `${session.nextLeftWidth}px`;
      session.rightElement.style.flex = `0 0 ${rightWidth}px`;
      session.rightElement.style.width = `${rightWidth}px`;
    });
  };

  const startResize = (
    event: React.PointerEvent,
    leftPane: FileTreeEditorPaneState,
    rightPane: FileTreeEditorPaneState,
  ) => {
    const leftElement = paneElements.current.get(leftPane.id);
    const rightElement = paneElements.current.get(rightPane.id);
    if (!leftElement || !rightElement) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const configuredMinimum = Number.parseFloat(getComputedStyle(leftElement).minWidth);
    const leftWidth = leftElement.getBoundingClientRect().width;
    const rightWidth = rightElement.getBoundingClientRect().width;
    const minimumWidth = Math.min(
      Number.isFinite(configuredMinimum) ? configuredMinimum : 320,
      (leftWidth + rightWidth) / 2,
    );

    resizeSession.current = {
      leftPaneId: leftPane.id,
      rightPaneId: rightPane.id,
      leftElement,
      rightElement,
      startX: event.clientX,
      leftWidth,
      rightWidth,
      minimumWidth,
      combinedSize: leftPane.size + rightPane.size,
      nextLeftWidth: leftWidth,
      frame: null,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const resizeWithKeyboard = (
    event: React.KeyboardEvent,
    leftPane: FileTreeEditorPaneState,
    rightPane: FileTreeEditorPaneState,
  ) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;

    event.preventDefault();
    const combined = leftPane.size + rightPane.size;
    const step = combined * 0.05;
    const minimum = combined * 0.15;
    const leftSize =
      event.key === 'Home'
        ? combined / 2
        : Math.min(combined - minimum, Math.max(minimum, leftPane.size + (event.key === 'ArrowLeft' ? -step : step)));
    onResize(leftPane.id, rightPane.id, leftSize, combined - leftSize);
  };

  const showDropTarget = (event: React.DragEvent, paneId: string) => {
    if (!acceptsEditorDrop(event.dataTransfer)) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setDropPaneId(paneId);
  };

  return (
    <div
      data-file-manager-editor-split
      data-pane-count={panes.length}
      className='file-manager-editor-panel flex min-w-0 overflow-x-auto overflow-y-hidden'
    >
      {panes.map((pane, index) => {
        const nextPane = panes[index + 1];
        const active = pane.id === activePaneId;

        return (
          <Fragment key={pane.id}>
            <div
              ref={(element) => {
                if (element) paneElements.current.set(pane.id, element);
                else paneElements.current.delete(pane.id);
              }}
              data-file-manager-editor-pane
              data-active={active || undefined}
              className={classNames(
                'file-manager-editor-pane relative flex min-w-(--file-manager-editor-pane-min-width) overflow-hidden',
                active && 'file-manager-editor-pane-active',
              )}
              style={panes.length === 1 ? { flex: '1 0 100%', width: '100%' } : { flex: `${pane.size} 1 0` }}
              onPointerDownCapture={() => onActivatePane(pane.id)}
              onFocusCapture={() => onActivatePane(pane.id)}
              onDragEnter={(event) => showDropTarget(event, pane.id)}
              onDragOver={(event) => showDropTarget(event, pane.id)}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                setDropPaneId((current) => (current === pane.id ? null : current));
              }}
              onDrop={(event) => {
                if (!acceptsEditorDrop(event.dataTransfer)) return;
                event.preventDefault();
                event.stopPropagation();
                setDropPaneId(null);
                onDrop(pane.id, event.dataTransfer);
              }}
            >
              {renderPane(pane, index)}
              {dropPaneId === pane.id && (
                <div
                  data-file-manager-editor-drop-overlay
                  className='pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded-md border-2 border-dashed border-(--mantine-primary-color-filled) bg-(--mantine-color-body)/85 p-4 text-center font-medium text-(--mantine-primary-color-light-color)'
                >
                  {dropLabel}
                </div>
              )}
            </div>

            {nextPane && (
              <div
                role='separator'
                tabIndex={0}
                aria-orientation='vertical'
                aria-label={resizeLabel}
                data-file-manager-editor-resize-handle
                className='file-manager-editor-resize-handle shrink-0 cursor-col-resize focus-visible:outline-none'
                onPointerDown={(event) => startResize(event, pane, nextPane)}
                onPointerMove={resize}
                onPointerUp={finishResize}
                onPointerCancel={finishResize}
                onKeyDown={(event) => resizeWithKeyboard(event, pane, nextPane)}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
