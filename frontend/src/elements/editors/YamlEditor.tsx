import { ComponentProps, useEffect, useRef } from 'react';
import MonacoEditor from '@/elements/editors/MonacoEditor.tsx';

const DEFAULT_OPTIONS: ComponentProps<typeof MonacoEditor>['options'] = {
  stickyScroll: { enabled: false },
  minimap: { enabled: false },
  codeLens: false,
  scrollBeyondLastLine: false,
  smoothScrolling: false,
  inertialScroll: true,
};

type YamlEditorProps = Omit<ComponentProps<typeof MonacoEditor>, 'language'> & {
  onSave?: () => void;
};

export default function YamlEditor({ onSave, onMount, options, ...props }: YamlEditorProps) {
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  });

  return (
    <MonacoEditor
      language='yaml'
      options={{ ...DEFAULT_OPTIONS, ...options }}
      onMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveRef.current?.());
        onMount?.(editor, monaco);
      }}
      {...props}
    />
  );
}
