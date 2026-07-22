import { useComputedColorScheme } from '@mantine/core';
import { DiffEditor, Editor, loader } from '@monaco-editor/react';
import { ComponentProps, MouseEvent as ReactMouseEvent, useCallback, useRef, useState } from 'react';
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

  const handleContextMenu = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;

    e.preventDefault();
    flushSync(() => setItems(getMenuActions(editor).map((action) => actionToItem(editor, action))));
    openMenuRef.current?.(e.clientX, e.clientY);
  }, []);

  return { attach, items, openMenuRef, handleContextMenu };
}

export default function MonacoEditor(props: ComponentProps<typeof Editor>) {
  const computedColorScheme = useComputedColorScheme('dark');
  const { attach, items, openMenuRef, handleContextMenu } = useMonacoContextMenu();

  return (
    <ContextMenu items={items}>
      {({ openMenu }) => {
        openMenuRef.current = openMenu;

        return (
          <div style={{ display: 'contents' }} onContextMenu={handleContextMenu}>
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
  const { attach, items, openMenuRef, handleContextMenu } = useMonacoContextMenu();

  return (
    <ContextMenu items={items}>
      {({ openMenu }) => {
        openMenuRef.current = openMenu;

        return (
          <div style={{ display: 'contents' }} onContextMenu={handleContextMenu}>
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
