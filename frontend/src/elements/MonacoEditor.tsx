import { useComputedColorScheme } from '@mantine/core';
import { DiffEditor, Editor, loader } from '@monaco-editor/react';
import {
  ComponentProps,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import ContextMenu, { ContextMenuItem } from '@/elements/ContextMenu.tsx';

type ICodeEditor = import('monaco-editor').editor.ICodeEditor;

loader.config({
  paths: {
    vs: '/monaco',
  },
});

const SEPARATOR_ID = 'vs.actions.separator';

function runAction(editor: ICodeEditor, action: MonacoMenuAction) {
  setTimeout(() => {
    editor.focus();
    action.run();
  }, 0);
}

interface MonacoMenuAction {
  id: string;
  label: string;
  enabled?: boolean;
  run: () => unknown;
  actions?: MonacoMenuAction[];
}

function getMenuActions(editor: ICodeEditor): MonacoMenuAction[] {
  const model = editor.getModel();
  if (!model) return [];

  const controller = editor.getContribution('editor.contrib.contextmenu') as unknown as {
    _getMenuActions?: (model: unknown, menuId: unknown) => MonacoMenuAction[];
  } | null;
  const menuId = (editor as unknown as { contextMenuId?: unknown }).contextMenuId;

  return controller?._getMenuActions?.(model, menuId) ?? [];
}

function actionToItem(editor: ICodeEditor, action: MonacoMenuAction): ContextMenuItem {
  if (action.id === SEPARATOR_ID) {
    return { type: 'divider' };
  }

  if (action.actions?.length) {
    return {
      type: 'action',
      label: action.label,
      color: 'gray',
      items: action.actions.map((subAction) =>
        subAction.id === SEPARATOR_ID
          ? { type: 'divider' as const }
          : {
              type: 'action' as const,
              label: subAction.label,
              disabled: subAction.enabled === false,
              color: 'gray' as const,
              onClick: () => runAction(editor, subAction),
            },
      ),
    };
  }

  return {
    type: 'action',
    label: action.label,
    disabled: action.enabled === false,
    color: 'gray',
    onClick: () => runAction(editor, action),
  };
}

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;

function useMonacoContextMenu() {
  const editorRef = useRef<ICodeEditor | null>(null);
  const openMenuRef = useRef<((x: number, y: number) => void) | null>(null);
  const [items, setItems] = useState<ContextMenuItem[]>([]);

  const attach = useCallback((editor: ICodeEditor) => {
    editorRef.current ??= editor;
    editor.onContextMenu(() => {
      editorRef.current = editor;
    });
  }, []);

  const openAt = useCallback((x: number, y: number) => {
    const editor = editorRef.current;
    if (!editor) return false;

    flushSync(() => setItems(getMenuActions(editor).map((action) => actionToItem(editor, action))));
    openMenuRef.current?.(x, y);
    return true;
  }, []);

  const lastLongPressAtRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!editorRef.current) return;

      e.preventDefault();
      if (e.timeStamp - lastLongPressAtRef.current < 700) return;

      if (longPressTimerRef.current) {
        cancelLongPress();
        longPressFiredRef.current = true;
      }

      openAt(e.clientX, e.clientY);
    },
    [openAt, cancelLongPress],
  );

  useEffect(() => cancelLongPress, [cancelLongPress]);

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      cancelLongPress();
      longPressFiredRef.current = false;
      if (e.touches.length > 1) return;

      const { clientX, clientY } = e.touches[0];
      touchStartPosRef.current = { x: clientX, y: clientY };
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        longPressFiredRef.current = openAt(clientX, clientY);
        lastLongPressAtRef.current = performance.now();
      }, LONG_PRESS_MS);
    },
    [cancelLongPress, openAt],
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!longPressTimerRef.current) return;

      const { clientX, clientY } = e.touches[0];
      if (
        Math.abs(clientX - touchStartPosRef.current.x) > LONG_PRESS_MOVE_TOLERANCE ||
        Math.abs(clientY - touchStartPosRef.current.y) > LONG_PRESS_MOVE_TOLERANCE
      ) {
        cancelLongPress();
      }
    },
    [cancelLongPress],
  );

  const handleTouchEnd = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      cancelLongPress();
      if (longPressFiredRef.current) {
        longPressFiredRef.current = false;
        e.preventDefault();
      }
    },
    [cancelLongPress],
  );

  const containerProps = {
    onContextMenu: handleContextMenu,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: cancelLongPress,
  };

  return { attach, items, openMenuRef, containerProps };
}

export default function MonacoEditor(props: ComponentProps<typeof Editor>) {
  const computedColorScheme = useComputedColorScheme('dark');
  const { attach, items, openMenuRef, containerProps } = useMonacoContextMenu();

  return (
    <ContextMenu items={items}>
      {({ openMenu }) => {
        openMenuRef.current = openMenu;

        return (
          <div style={{ display: 'contents' }} {...containerProps}>
            <Editor
              {...props}
              theme={computedColorScheme === 'dark' ? 'vs-dark' : 'light'}
              options={{ ...props.options, contextmenu: false }}
              onMount={(e, m) => {
                attach(e);

                for (const handler of window.extensionContext.extensionRegistry.elements.monacoEditor.onMountHandlers) {
                  handler(e, m);
                }

                props.onMount?.(e, m);
              }}
            />
          </div>
        );
      }}
    </ContextMenu>
  );
}

export function MonacoDiffEditor(props: ComponentProps<typeof DiffEditor>) {
  const computedColorScheme = useComputedColorScheme('dark');
  const { attach, items, openMenuRef, containerProps } = useMonacoContextMenu();

  return (
    <ContextMenu items={items}>
      {({ openMenu }) => {
        openMenuRef.current = openMenu;

        return (
          <div style={{ display: 'contents' }} {...containerProps}>
            <DiffEditor
              {...props}
              theme={computedColorScheme === 'dark' ? 'vs-dark' : 'light'}
              options={{ ...props.options, contextmenu: false }}
              onMount={(e, m) => {
                attach(e.getModifiedEditor());
                attach(e.getOriginalEditor());

                for (const handler of window.extensionContext.extensionRegistry.elements.monacoEditor
                  .diffOnMountHandlers) {
                  handler(e, m);
                }

                props.onMount?.(e, m);
              }}
            />
          </div>
        );
      }}
    </ContextMenu>
  );
}
