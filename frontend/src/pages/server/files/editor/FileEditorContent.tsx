import { useMergedRef } from '@mantine/hooks';
import { RefObject, useId } from 'react';
import { FileEditorActionContext } from 'shared/src/registries/pages/server/files';
import { useShallow } from 'zustand/react/shallow';
import MonacoEditor from '@/elements/editors/MonacoEditor.tsx';
import PierreEditor, {
  type PierreEditorHandle,
  type PierreFileChangeEvent,
  type PierreLocalSelection,
} from '@/elements/editors/PierreEditor.tsx';
import { fileModelUri } from '@/lib/editor/fileModelUri.ts';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/editor/monaco.ts';
import { type OnMount } from '@/lib/editor/monacoLoader.ts';
import useEditorFontSizeZoom from '@/pages/server/files/hooks/useEditorFontSizeZoom.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { addEditorSaveAction } from './addEditorSaveAction.ts';
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
  readOnly: boolean;
  context?: FileEditorActionContext;
  handleContentChange: (value: string) => void;
  handlePierreChangeEvent: (event: PierreFileChangeEvent) => void;
  handlePierreSelectionChange: (selection: PierreLocalSelection | null) => void;
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
  readOnly,
  context,
  handleContentChange,
  handlePierreChangeEvent,
  handlePierreSelectionChange,
  attachPierreEditor,
  attachEditor,
  editorRef,
  pierreEditorRef,
  saveShortcutRef,
}: FileEditorContentProps) {
  const { t } = useTranslations();
  const instanceId = useId();
  const serverUuid = useServerStore((state) => state.server.uuid);
  const modelPath = fileModelUri(serverUuid, context?.path ?? fileName, instanceId);
  const { editorEngine, editorLineOverflow, editorFontSize, editorMinimap } = useFileManager(
    useShallow((state) => ({
      editorEngine: state.editorEngine,
      editorLineOverflow: state.editorLineOverflow,
      editorFontSize: state.editorFontSize,
      editorMinimap: state.editorMinimap,
    })),
  );
  const mergedContainerRef = useMergedRef(containerRef, useEditorFontSizeZoom());

  return (
    <div ref={mergedContainerRef} className='flex max-w-full w-full z-1 absolute'>
      {matchedFileEditorAction?.contentType === 'string' ? (
        <matchedFileEditorAction.content
          content={content}
          setContent={setContent}
          dirty={dirty}
          setDirty={setDirty}
          readOnly={readOnly}
          context={context}
        />
      ) : matchedFileEditorAction?.contentType === 'blob' ? (
        <matchedFileEditorAction.content
          content={blobContent}
          setContent={setBlobContent}
          dirty={dirty}
          setDirty={setDirty}
          readOnly={readOnly}
          context={context}
        />
      ) : action === 'image' ? (
        <FileImagePreview src={content} name={fileName} />
      ) : action === 'audio' ? (
        <FileAudioPreview src={content} />
      ) : editorEngine === 'pierre' ? (
        <PierreEditor
          height='100%'
          width='100%'
          path={modelPath}
          defaultValue={content}
          readOnly={readOnly}
          wordWrap={editorLineOverflow}
          fontSize={editorFontSize}
          onChange={handleContentChange}
          onChangeEvent={handlePierreChangeEvent}
          onSelectionChange={handlePierreSelectionChange}
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
          path={modelPath}
          options={{
            readOnly,
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
            addEditorSaveAction(editor, monaco, t('common.button.save', {}), () => saveShortcutRef.current());
            registerTomlLanguage(monaco);
            registerHoconLanguage(monaco);
          }}
        />
      )}
    </div>
  );
}
