import type { Monaco, MonacoCodeEditor } from '@/lib/editor/monacoLoader.ts';

export function addEditorSaveAction(editor: MonacoCodeEditor, monaco: Monaco, label: string, run: () => void) {
  const action = editor.addAction({
    id: 'calagopus.files.save',
    label,
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: () => run(),
  });
  editor.onDidDispose(() => action.dispose());
}
