import { Group, Title } from '@mantine/core';
import { type OnMount } from '@monaco-editor/react';
import { join } from 'pathe';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { createSearchParams, useNavigate, useParams, useSearchParams } from 'react-router';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/monaco.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { FileManagerProvider, useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import FileBreadcrumbs from './FileBreadcrumbs.tsx';
import FileEditorSettings from './FileEditorSettings.tsx';
import FileImageViewerSettings from './FileImageViewerSettings.tsx';
import FileNameModal from './modals/FileNameModal.tsx';

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
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const {
    editorMinimap,
    editorLineOverflow,
    imageViewerSmoothing,
    browsingWritableDirectory,
    browsingDirectory,
    setBrowsingDirectory,
  } = useFileManager();

  const { getParent } = useCurrentWindow();

  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [blobContent, setBlobContent] = useState(new Blob());

  const editorRef = useRef<Parameters<OnMount>[0]>(null);
  const contentRef = useRef(content);
  const blocker = useBlocker(dirty);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBrowsingDirectory(searchParams.get('directory') || '/');
    setFileName(searchParams.get('file') || '');
  }, [searchParams]);

  useEffect(() => {
    if (!browsingDirectory || !fileName) return;
    if (params.action === 'new') return;

    setLoading(true);
    getFileContent(server.uuid, join(browsingDirectory, fileName))
      .then((content) => {
        if (matchedFileEditorAction?.contentType === 'blob') {
          return content;
        }

        if (params.action === 'image') {
          return URL.createObjectURL(content);
        } else {
          return content.text();
        }
      })
      .then((content) => {
        startTransition(() => {
          if (typeof content === 'string') {
            setContent(content);
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

  if (!matchedFileEditorAction && !['new', 'edit', 'image'].includes(params.action!)) {
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
        : t('pages.server.files.titleEditorEditing', { file: fileName })
      : t('pages.server.files.titleEditorNew', {});

  return (
    <ServerContentContainer
      hideTitleComponent
      fullscreen
      title={title}
      registry={window.extensionContext.extensionRegistry.pages.server.files.editorContainer}
    >
      <div className='flex justify-between items-center lg:p-4 lg:pb-0 mx-5'>
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
          <div hidden={!browsingWritableDirectory || params.action === 'image'}>
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
        )}
      </div>

      <ConfirmationModal
        title={t('pages.server.files.modal.unsavedChanges.title', {})}
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset()}
        onConfirmed={() => blocker.proceed()}
        confirm={t('pages.server.files.modal.unsavedChanges.button.leave', {})}
      >
        {t('pages.server.files.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>

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
              ) : (
                <MonacoEditor
                  height='100%'
                  width='100%'
                  theme='vs-dark'
                  defaultValue={content}
                  path={fileName}
                  options={{
                    readOnly: !browsingWritableDirectory,
                    stickyScroll: { enabled: false },
                    minimap: { enabled: editorMinimap },
                    wordWrap: editorLineOverflow ? 'on' : 'off',
                    codeLens: false,
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    // @ts-expect-error this is valid
                    touchScrollEnabled: true,
                    fixedOverflowWidgets: true,
                  }}
                  onChange={(value) => setContent(value || '')}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    editor.onDidChangeModelContent(() => {
                      contentRef.current = editor.getValue();
                      setDirty(contentRef.current !== content);
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
