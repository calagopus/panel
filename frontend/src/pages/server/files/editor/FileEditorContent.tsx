import { Audio } from '@gfazioli/mantine-audio';
import { type OnMount } from '@monaco-editor/react';
import { type EditorChangeEvent } from '@pierre/diffs/edit';
import { RefObject } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { useShallow } from 'zustand/react/shallow';
import Select from '@/elements/input/Select.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import PierreEditor, { type PierreEditorHandle } from '@/elements/PierreEditor.tsx';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/monaco.ts';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

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
  const { t } = useTranslations();
  const { addToast } = useToast();
  const {
    imageViewerSmoothing,
    audioPlayerVolume,
    setAudioPlayerVolume,
    audioPlayerPlaybackRate,
    setAudioPlayerPlaybackRate,
    editorEngine,
    editorLineOverflow,
    editorFontSize,
    editorMinimap,
    browsingWritableDirectory,
  } = useFileManager(
    useShallow((state) => ({
      imageViewerSmoothing: state.imageViewerSmoothing,
      audioPlayerVolume: state.audioPlayerVolume,
      setAudioPlayerVolume: state.setAudioPlayerVolume,
      audioPlayerPlaybackRate: state.audioPlayerPlaybackRate,
      setAudioPlayerPlaybackRate: state.setAudioPlayerPlaybackRate,
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
        <div className='h-full w-full flex flex-row justify-center'>
          <TransformWrapper minScale={0.5} centerOnInit>
            <TransformComponent wrapperClass='w-[calc(100%-4rem)]! h-7/8! rounded-md'>
              <img
                src={content}
                alt={fileName}
                style={{
                  imageRendering: imageViewerSmoothing ? undefined : 'pixelated',
                }}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
      ) : action === 'audio' ? (
        <div className='h-full w-full flex flex-row justify-center items-center'>
          <Audio
            size='xl'
            w='50%'
            src={content}
            volume={audioPlayerVolume}
            onVolumeChange={(volume) => setAudioPlayerVolume(volume)}
            playbackRate={audioPlayerPlaybackRate}
            onError={(err) => (err ? addToast(err.message, 'error') : null)}
          >
            <Audio.Waveform height={120} mirrorGap={2} />
            <Audio.Controls>
              <Audio.SkipButton
                seconds={-15}
                label={t('pages.server.files.tooltip.back', {
                  seconds: 15,
                })}
              />
              <Audio.PlayButton
                playLabel={t('pages.server.files.tooltip.play', {})}
                pauseLabel={t('pages.server.files.tooltip.pause', {})}
              />
              <Audio.SkipButton
                seconds={15}
                label={t('pages.server.files.tooltip.forward', {
                  seconds: 15,
                })}
              />
              <Audio.Timeline />
              <Audio.TimeDisplay />
              <Audio.MuteButton
                muteLabel={t('pages.server.files.tooltip.mute', {})}
                unmuteLabel={t('pages.server.files.tooltip.unmute', {})}
              />
              <Audio.VolumeSlider />
              <Select
                value={audioPlayerPlaybackRate.toString()}
                onChange={(value) => setAudioPlayerPlaybackRate(Number(value))}
                data={[
                  { value: '0.5', label: '0.5x' },
                  { value: '0.75', label: '0.75x' },
                  { value: '1', label: '1x' },
                  { value: '1.25', label: '1.25x' },
                  { value: '1.5', label: '1.5x' },
                  { value: '2', label: '2x' },
                ]}
                style={{ width: 80 }}
              />
            </Audio.Controls>
          </Audio>
        </div>
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
