import { ComponentProps, useEffect, useId, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { MonacoDiffEditor } from '@/elements/editors/MonacoEditor.tsx';
import { PierreDiffEditor } from '@/elements/editors/PierreEditor.tsx';
import { fileModelUri } from '@/lib/editor/fileModelUri.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

interface FileRevisionDiffEditorProps {
  original: string;
  modified: string;
  filePath: string;
  revisionId: number;
  previousRevisionId?: number;
  readOnly: boolean;
  onChange: (content: string) => void;
  onSave: () => void;
  onMount?: ComponentProps<typeof MonacoDiffEditor>['onMount'];
}

export default function FileRevisionDiffEditor({
  original,
  modified,
  filePath,
  revisionId,
  previousRevisionId,
  readOnly,
  onChange,
  onSave,
  onMount,
}: FileRevisionDiffEditorProps) {
  const { engine, fontSize, minimap, wordWrap } = useFileManager(
    useShallow((state) => ({
      engine: state.editorEngine,
      fontSize: state.editorFontSize,
      minimap: state.editorMinimap,
      wordWrap: state.editorLineOverflow,
    })),
  );
  const serverUuid = useServerStore((state) => state.server.uuid);
  const instanceId = useId();
  const callbacks = useRef({ readOnly, onChange, onSave });
  useEffect(() => {
    callbacks.current = { readOnly, onChange, onSave };
  });

  const originalModelPath = fileModelUri(
    serverUuid,
    filePath,
    `${instanceId}:revision:${previousRevisionId ?? revisionId}`,
  );
  const modifiedModelPath = fileModelUri(
    serverUuid,
    filePath,
    `${instanceId}:modified:${previousRevisionId === undefined ? 'current' : revisionId}`,
  );

  return engine === 'pierre' ? (
    <PierreDiffEditor
      height='100%'
      width='100%'
      originalPath={originalModelPath}
      originalValue={original}
      modifiedPath={modifiedModelPath}
      modifiedValue={modified}
      readOnly
      fontSize={fontSize}
      wordWrap={wordWrap}
    />
  ) : (
    <MonacoDiffEditor
      height='100%'
      width='100%'
      original={original}
      modified={modified}
      originalModelPath={originalModelPath}
      modifiedModelPath={modifiedModelPath}
      options={{
        readOnly,
        fontSize,
        stickyScroll: { enabled: false },
        minimap: { enabled: minimap },
        wordWrap: wordWrap ? 'on' : 'off',
        codeLens: false,
        scrollBeyondLastLine: false,
        smoothScrolling: false,
        inertialScroll: true,
        fixedOverflowWidgets: true,
      }}
      onMount={(editor, monaco) => {
        if (previousRevisionId === undefined) {
          const modifiedEditor = editor.getModifiedEditor();
          modifiedEditor.onDidChangeModelContent(() => {
            if (!callbacks.current.readOnly) callbacks.current.onChange(modifiedEditor.getValue());
          });
          modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (!callbacks.current.readOnly) callbacks.current.onSave();
          });
        }
        onMount?.(editor, monaco);
      }}
    />
  );
}
