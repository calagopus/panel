import { faClockRotateLeft, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Audio } from '@gfazioli/mantine-audio';
import { type OnMount } from '@monaco-editor/react';
import { join } from 'pathe';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { createSearchParams, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import Select from '@/elements/input/Select.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Title from '@/elements/Title.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/monaco.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { FileManagerProvider, useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import FileRevisionsDrawer from './drawers/FileRevisionsDrawer.tsx';
import FileBreadcrumbs from './FileBreadcrumbs.tsx';
import FileConnectButton from './FileConnectButton.tsx';
import FileEditorSettings from './FileEditorSettings.tsx';
import FileImageViewerSettings from './FileImageViewerSettings.tsx';
import FileNameModal from './modals/FileNameModal.tsx';

interface FileDraft {
  content: string;
  originalHash: string;
  savedAt: number;
}

const DRAFT_KEY_PREFIX = 'panel:file-draft:';
const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function hashContent(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

function draftKey(serverUuid: string, filePath: string): string {
  return `${DRAFT_KEY_PREFIX}${serverUuid}:${filePath}`;
}

function purgeExpiredDrafts(): void {
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(DRAFT_KEY_PREFIX)) continue;
    try {
      const draft: FileDraft = JSON.parse(localStorage.getItem(key)!);
      if (now - draft.savedAt > DRAFT_TTL_MS) localStorage.removeItem(key);
    } catch {
      localStorage.removeItem(key);
    }
  }
}

function FileEditorComponent() {
  const params = useParams<'action'>();

  const matchedFileEditorAction = useMemo(() => {
    if (!params.action) return null;

    return (
      window.extensionContext.extensionRegistry.pages.server.files.fileEditorActions.find(
        (action) => action.name === params.action,
      ) || null
    );
  }, [params.action]);

  const { t } = useTranslations();
  const [searchParams, _] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const {
    editorMinimap,
    editorLineOverflow,
    imageViewerSmoothing,
    audioPlayerVolume,
    audioPlayerPlaybackRate,
    setAudioPlayerVolume,
    setAudioPlayerPlaybackRate,
    browsingPrimaryFilesystem,
    browsingWritableDirectory,
    browsingDirectory,
    setBrowsingDirectory,
  } = useFileManager();

  const { getParent } = useCurrentWindow();

  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [blobContent, setBlobContent] = useState(new Blob());
  const [pendingDraft, setPendingDraft] = useState<{ content: string; hashMismatch: boolean } | null>(null);

  const editorRef = useRef<Parameters<OnMount>[0]>(null);
  const contentRef = useRef(content);
  const savedContentRef = useRef('');
  const originalHashRef = useRef('');
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const draftPathRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const blocker = useBlocker(dirty, false, (tx) => {
    if (!tx.location.pathname.includes('/files/diff')) return true;
    return new URLSearchParams(tx.location.search).has('previousRevision');
  });
  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBrowsingDirectory(searchParams.get('directory') || '/');
    setFileName(searchParams.get('file') || '');
  }, [searchParams]);

  useEffect(() => {
    purgeExpiredDrafts();
  }, []);

  useEffect(() => {
    if (location.state?.openRevisions) {
      setRevisionsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!browsingDirectory || !fileName) return;
    if (params.action === 'new') return;

    setLoading(true);
    getFileContent(server.uuid, join(browsingDirectory, fileName))
      .then((content) => {
        if (matchedFileEditorAction?.contentType === 'blob') {
          return content;
        }

        if (params.action === 'image' || params.action === 'audio') {
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = URL.createObjectURL(content);
          return objectUrlRef.current;
        } else {
          return content.text();
        }
      })
      .then((content) => {
        startTransition(() => {
          if (typeof content === 'string') {
            setContent(content);
            savedContentRef.current = content;

            if (params.action === 'edit') {
              const hash = hashContent(content);
              originalHashRef.current = hash;
              const key = draftKey(server.uuid, join(browsingDirectory, fileName));
              const stored = localStorage.getItem(key);
              if (stored) {
                try {
                  const draft: FileDraft = JSON.parse(stored);
                  setPendingDraft({ content: draft.content, hashMismatch: draft.originalHash !== hash });
                } catch {
                  localStorage.removeItem(key);
                }
              }
            }
          } else {
            setBlobContent(content);
          }

          setLoading(false);
        });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
        setLoading(false);
      });
  }, [fileName]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    draftPathRef.current =
      params.action === 'edit' && fileName && browsingDirectory ? join(browsingDirectory, fileName) : null;
  }, [params.action, fileName, browsingDirectory]);

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el || loading) return;

    const updateHeight = () => {
      const virtualWindowEl = getParent();
      const elRect = el.getBoundingClientRect();

      let bottomEdge;
      if (virtualWindowEl) {
        bottomEdge = virtualWindowEl.getBoundingClientRect().bottom;
      } else {
        bottomEdge = window.innerHeight;
      }

      const newHeight = Math.max(0, bottomEdge - elRect.top);
      el.style.height = `${newHeight}px`;

      if (editorRef.current?.layout) {
        editorRef.current.layout();
      }
    };

    const observer = new ResizeObserver(() => updateHeight());

    const virtualWindowEl = getParent();
    if (virtualWindowEl) {
      observer.observe(virtualWindowEl);
    } else {
      observer.observe(document.body);
    }

    updateHeight();

    return () => observer.disconnect();
  }, [loading, getParent, params.action, fileName]);

  const saveFile = (name?: string) => {
    setDirty(false);

    if (!editorRef.current || !browsingWritableDirectory) return;

    const currentContent = editorRef.current.getValue();
    setSaving(true);

    saveFileContent(server.uuid, join(browsingDirectory, name ?? fileName), currentContent)
      .then(() => {
        startTransition(() => {
          setSaving(false);
          setNameModalOpen(false);
        });

        savedContentRef.current = currentContent;
        originalHashRef.current = hashContent(currentContent);
        if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        localStorage.removeItem(draftKey(server.uuid, join(browsingDirectory, name ?? fileName)));
        addToast(t('pages.server.files.toast.fileSaved', {}), 'success');

        if (name) {
          navigate(
            `/server/${server.uuidShort}/files/edit?${createSearchParams({
              directory: browsingDirectory,
              file: name,
            })}`,
          );
        }
      })
      .catch((msg) => {
        setSaving(false);
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  if (!matchedFileEditorAction && !['new', 'edit', 'image', 'audio'].includes(params.action!)) {
    return (
      <ServerContentContainer title='Not found' hideTitleComponent>
        <ScreenBlock title='404' content='Editor not found' />
      </ServerContentContainer>
    );
  }

  const title = matchedFileEditorAction
    ? matchedFileEditorAction.title(fileName)
    : fileName
      ? params.action === 'image'
        ? t('pages.server.files.titleEditorViewing', { file: fileName })
        : params.action === 'audio'
          ? t('pages.server.files.titleEditorPlaying', { file: fileName })
          : t('pages.server.files.titleEditorEditing', { file: fileName })
      : t('pages.server.files.titleEditorNew', {});

  return (
    <ServerContentContainer
      hideTitleComponent
      fullscreen
      title={title}
      registry={window.extensionContext.extensionRegistry.pages.server.files.editorContainer}
    >
      <div className='flex justify-between items-center lg:pt-6 px-4 lg:px-6 lg:pb-0'>
        <Group>
          <Title>{title}</Title>

          {matchedFileEditorAction?.header.settings ? (
            <matchedFileEditorAction.header.settings />
          ) : params.action === 'new' || params.action === 'edit' ? (
            <FileEditorSettings />
          ) : params.action === 'image' ? (
            <FileImageViewerSettings />
          ) : null}
        </Group>
        {matchedFileEditorAction?.header.rightSection ? (
          <matchedFileEditorAction.header.rightSection />
        ) : (
          <Group>
            <ServerCan action='files.read-content'>
              {params.action === 'edit' && fileName && browsingPrimaryFilesystem && (
                <Tooltip label={t('pages.server.files.tooltip.fileHistory', {})}>
                  <ActionIcon
                    size='sm'
                    variant='subtle'
                    color='gray'
                    onClick={() => setRevisionsOpen(true)}
                    className='mr-2'
                  >
                    <FontAwesomeIcon icon={faClockRotateLeft} />
                  </ActionIcon>
                </Tooltip>
              )}
            </ServerCan>
            <FileConnectButton file={fileName ? join(browsingDirectory, fileName) : undefined} />
            <div hidden={!browsingWritableDirectory || params.action === 'image' || params.action === 'audio'}>
              {params.action === 'edit' ? (
                <ServerCan action='files.update'>
                  <Button loading={saving} onClick={() => saveFile()}>
                    {t('common.button.save', {})}
                  </Button>
                </ServerCan>
              ) : (
                <ServerCan action='files.create'>
                  <Button loading={saving} onClick={() => setNameModalOpen(true)}>
                    {t('common.button.create', {})}
                  </Button>
                </ServerCan>
              )}
            </div>
          </Group>
        )}
      </div>

      <Modal
        title={t('pages.server.files.modal.draftRestore.title', {})}
        opened={pendingDraft !== null}
        onClose={() => {
          localStorage.removeItem(draftKey(server.uuid, join(browsingDirectory, fileName)));
          setPendingDraft(null);
        }}
      >
        <p>{t('pages.server.files.modal.draftRestore.content', {})}</p>

        {pendingDraft?.hashMismatch && (
          <Alert mt='sm' color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
            {t('pages.server.files.modal.draftRestore.contentHashMismatch', {})}
          </Alert>
        )}

        <ModalFooter>
          <Button
            onClick={() => {
              if (pendingDraft) {
                editorRef.current?.setValue(pendingDraft.content);
                setDirty(true);
              }
              setPendingDraft(null);
            }}
          >
            {t('common.button.restore', {})}
          </Button>
          <Button
            variant='default'
            onClick={() => {
              localStorage.removeItem(draftKey(server.uuid, join(browsingDirectory, fileName)));
              setPendingDraft(null);
            }}
          >
            {t('common.button.discard', {})}
          </Button>
        </ModalFooter>
      </Modal>

      <ConfirmationModal
        title={t('pages.server.files.modal.unsavedChanges.title', {})}
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset()}
        onConfirmed={() => {
          localStorage.removeItem(draftKey(server.uuid, join(browsingDirectory, fileName)));
          blocker.proceed();
        }}
        confirm={t('common.button.leavePage', {})}
        zIndex={300}
      >
        {t('pages.server.files.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>

      <FileRevisionsDrawer
        filePath={join(browsingDirectory, fileName)}
        opened={revisionsOpen}
        onClose={() => setRevisionsOpen(false)}
        getContent={() => editorRef.current?.getValue()}
        onRestore={(newContent) => {
          editorRef.current?.setValue(newContent);
          setDirty(true);
        }}
      />

      {loading ? (
        <div className='w-full h-screen flex items-center justify-center'>
          <Spinner size={75} />
        </div>
      ) : (
        <div className='flex flex-col relative'>
          <FileNameModal
            onFileName={(name: string) => saveFile(name)}
            opened={nameModalOpen}
            onClose={() => setNameModalOpen(false)}
          />

          <div className='flex justify-between w-full py-4'>
            <FileBreadcrumbs inFileEditor path={join(decodeURIComponent(browsingDirectory), fileName)} />
          </div>
          <div className='relative'>
            <div ref={editorContainerRef} className='flex max-w-full w-full z-1 absolute'>
              {matchedFileEditorAction?.contentType === 'string' ? (
                <matchedFileEditorAction.content
                  content={content}
                  setContent={setContent}
                  dirty={dirty}
                  setDirty={setDirty}
                />
              ) : matchedFileEditorAction?.contentType === 'blob' ? (
                <matchedFileEditorAction.content
                  content={blobContent}
                  setContent={setBlobContent}
                  dirty={dirty}
                  setDirty={setDirty}
                />
              ) : params.action === 'image' ? (
                <div className='h-full w-full flex flex-row justify-center'>
                  <TransformWrapper minScale={0.5}>
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
              ) : params.action === 'audio' ? (
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
                      <Audio.SkipButton seconds={-15} label={t('pages.server.files.tooltip.back', { seconds: 15 })} />
                      <Audio.PlayButton
                        playLabel={t('pages.server.files.tooltip.play', {})}
                        pauseLabel={t('pages.server.files.tooltip.pause', {})}
                      />
                      <Audio.SkipButton seconds={15} label={t('pages.server.files.tooltip.forward', { seconds: 15 })} />
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
                    codeLens: false,
                    scrollBeyondLastLine: false,
                    smoothScrolling: false,
                    // @ts-expect-error this is valid
                    touchScrollEnabled: true,
                    fixedOverflowWidgets: true,
                  }}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    editor.onDidChangeModelContent(() => {
                      const value = editor.getValue();
                      contentRef.current = value;
                      const isDirty = value !== savedContentRef.current;
                      setDirty(isDirty);

                      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
                      if (isDirty && draftPathRef.current) {
                        const path = draftPathRef.current;
                        draftTimerRef.current = setTimeout(() => {
                          const draft: FileDraft = {
                            content: value,
                            originalHash: originalHashRef.current,
                            savedAt: Date.now(),
                          };
                          localStorage.setItem(draftKey(server.uuid, path), JSON.stringify(draft));
                        }, 1000);
                      }
                    });
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                      if (params.action === 'new') {
                        setNameModalOpen(true);
                      } else {
                        saveFile();
                      }
                    });
                    registerTomlLanguage(monaco);
                    registerHoconLanguage(monaco);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </ServerContentContainer>
  );
}

export default function FileEditor() {
  return (
    <FileManagerProvider>
      <FileEditorComponent />
    </FileManagerProvider>
  );
}
