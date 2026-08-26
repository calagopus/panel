import { type OnMount } from '@monaco-editor/react';
import { type EditorChangeEvent } from '@pierre/diffs/edit';
import { RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import PierreEditor, { type PierreEditorHandle } from '@/elements/PierreEditor.tsx';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/monaco.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { FileAudioPreview, FileImagePreview } from './FileMediaPreview.tsx';

type FileEditorAction = (typeof window.extensionContext.extensionRegistry.pages.server.files.fileEditorActions)[number];

interface FileEditorContentProps {
  containerRef: RefObject<HTMLDivElement | null>;
  matchedFileEditorAction: FileEditorAction | null;
  action: string;
  content: string;
  setContent: (content: string) => void;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  blobContent: Blob;
  setBlobContent: (content: Blob) => void;
  fileName: string;
  handleContentChange: (value: string) => void;
  handlePierreChangeEvent: (event: EditorChangeEvent<undefined>) => void;
  attachPierreEditor: (editor: PierreEditorHandle) => void;
  attachEditor: (editor: Parameters<OnMount>[0]) => void;
  editorRef: RefObject<Parameters<OnMount>[0] | null>;
  pierreEditorRef: RefObject<PierreEditorHandle | null>;
  saveShortcutRef: RefObject<() => void>;
}

export default function FileEditorContent({
  containerRef,
  matchedFileEditorAction,
  action,
  content,
  setContent,
  dirty,
  setDirty,
  blobContent,
  setBlobContent,
  fileName,
  handleContentChange,
  handlePierreChangeEvent,
  attachPierreEditor,
  attachEditor,
  editorRef,
  pierreEditorRef,
  saveShortcutRef,
}: FileEditorContentProps) {
  const { editorEngine, editorLineOverflow, editorFontSize, editorMinimap, browsingWritableDirectory } = useFileManager(
    useShallow((state) => ({
      editorEngine: state.editorEngine,
      editorLineOverflow: state.editorLineOverflow,
      editorFontSize: state.editorFontSize,
      editorMinimap: state.editorMinimap,
      browsingWritableDirectory: state.browsingWritableDirectory,
    })),
  );

  return (
    <div ref={containerRef} className='flex max-w-full w-full z-1 absolute'>
      {matchedFileEditorAction?.contentType === 'string' ? (
        <matchedFileEditorAction.content content={content} setContent={setContent} dirty={dirty} setDirty={setDirty} />
      ) : matchedFileEditorAction?.contentType === 'blob' ? (
        <matchedFileEditorAction.content
          content={blobContent}
          setContent={setBlobContent}
          dirty={dirty}
          setDirty={setDirty}
        />
      ) : action === 'image' ? (
        <FileImagePreview src={content} name={fileName} />
      ) : action === 'audio' ? (
        <FileAudioPreview src={content} />
      ) : editorEngine === 'pierre' ? (
        <PierreEditor
          height='100%'
          width='100%'
          path={fileName}
          defaultValue={content}
          readOnly={!browsingWritableDirectory}
          wordWrap={editorLineOverflow}
          fontSize={editorFontSize}
          onChange={handleContentChange}
          onChangeEvent={handlePierreChangeEvent}
          onMount={(editor) => {
            pierreEditorRef.current = editor;
            attachPierreEditor(editor);
          }}
        />
      ) : (
        <MonacoEditor
          height='100%'
          width='100%'
          defaultValue={content}
          path={fileName}
          options={{
            readOnly: !browsingWritableDirectory,
            stickyScroll: { enabled: false },
            minimap: { enabled: editorMinimap },
            wordWrap: editorLineOverflow ? 'on' : 'off',
            fontSize: editorFontSize,
            codeLens: false,
            scrollBeyondLastLine: false,
            smoothScrolling: false,
            inertialScroll: true,
            fixedOverflowWidgets: true,
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            attachEditor(editor);
            editor.onDidChangeModelContent(() => {
              handleContentChange(editor.getValue());
            });
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
              saveShortcutRef.current();
            });
            registerTomlLanguage(monaco);
            registerHoconLanguage(monaco);
          }}
        />
      )}
    </div>
  );
}
