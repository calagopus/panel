import {
  faArrowsRotate,
  faClockRotateLeft,
  faFileCirclePlus,
  faFloppyDisk,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type OnMount } from '@monaco-editor/react';
import { join } from 'pathe';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { createSearchParams, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { type PierreEditorHandle } from '@/elements/PierreEditor.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { draftKey, FileDraft, hashContent, purgeExpiredDrafts } from '@/lib/files/fileDrafts.ts';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useQuickActions } from '@/plugins/useQuickActions.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { FileManagerProvider, useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import FileRevisionsDrawer from '../drawers/FileRevisionsDrawer.tsx';
import FileBreadcrumbs from '../FileBreadcrumbs.tsx';
import { useEditorContainerAutoHeight } from '../hooks/useEditorContainerAutoHeight.ts';
import useFileCollab from '../hooks/useFileCollab.ts';
import FileEditorConflictDiffModal from '../modals/FileEditorConflictDiffModal.tsx';
import FileEditorDraftModal from '../modals/FileEditorDraftModal.tsx';
import FileNameModal from '../modals/FileNameModal.tsx';
import FileEditorContent from './FileEditorContent.tsx';
import FileEditorHeader from './FileEditorHeader.tsx';

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
    editorEngine,
    browsingPrimaryFilesystem,
    browsingWritableDirectory,
    browsingDirectory,
    setBrowsingDirectory,
  } = useFileManager(
    useShallow((state) => ({
      editorEngine: state.editorEngine,
      browsingPrimaryFilesystem: state.browsingPrimaryFilesystem,
      browsingWritableDirectory: state.browsingWritableDirectory,
      browsingDirectory: state.browsingDirectory,
      setBrowsingDirectory: state.setBrowsingDirectory,
    })),
  );

  const { getParent } = useCurrentWindow();

  const canCreate = useServerCan('files.create');
  const canUpdate = useServerCan('files.update');
  const canReadContent = useServerCan('files.read-content');

  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [blobContent, setBlobContent] = useState(new Blob());
  const [pendingDraft, setPendingDraft] = useState<{
    content: string;
    hashMismatch: boolean;
  } | null>(null);
  const [conflictDiffOpen, setConflictDiffOpen] = useState(false);
  const [revertConfirm, setRevertConfirm] = useState(false);
  const [conflictDiskContent, setConflictDiskContent] = useState<string | null>(null);
  const [conflictModifiedContent, setConflictModifiedContent] = useState('');

  const editorRef = useRef<Parameters<OnMount>[0]>(null);
  const pierreEditorRef = useRef<PierreEditorHandle | null>(null);
  const contentRef = useRef(content);
  const savedContentRef = useRef('');
  const originalHashRef = useRef('');
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const draftPathRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const collabActiveRef = useRef(false);
  const collabSavingRef = useRef(false);
  const collabSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const conflictModelsRef = useRef<{ dispose: () => void }[]>([]);
  const blocker = useBlocker(dirty, false, (tx) => {
    if (!tx.location.pathname.includes('/files/diff')) return true;
    return new URLSearchParams(tx.location.search).has('previousRevision');
  });
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const contentWrapRef = useRef<HTMLDivElement>(null);

  const collab = useFileCollab({
    enabled: params.action === 'edit' && !!fileName && !!browsingDirectory && browsingPrimaryFilesystem && !loading,
    engine: editorEngine === 'pierre' ? 'pierre' : 'monaco',
    filePath: fileName && browsingDirectory ? join(browsingDirectory, fileName) : '',
    onActivated: (dirty) => {
      collabActiveRef.current = true;
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);

      if (collabSavingRef.current) {
        collabSavingRef.current = false;
        setSaving(false);
      }

      if (dirty) {
        setPendingDraft(null);
      } else {
        savedContentRef.current = hasEditor() ? getEditorValue() : savedContentRef.current;
        originalHashRef.current = hashContent(savedContentRef.current);
      }
      setDirty(dirty);
    },
    onSaved: () => {
      if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      setDirty(false);
      savedContentRef.current = hasEditor() ? getEditorValue() : savedContentRef.current;
      originalHashRef.current = hashContent(savedContentRef.current);
      localStorage.removeItem(draftKey(server.uuid, join(browsingDirectory, fileName)));

      if (collabSavingRef.current) {
        collabSavingRef.current = false;
        setSaving(false);
        addToast(t('pages.server.files.toast.fileSaved', {}), 'success');
      }
    },
    onConflict: (conflict) => {
      if (conflict && collabSavingRef.current) {
        if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);
        collabSavingRef.current = false;
        setSaving(false);
      }
    },
    onError: (message) => {
      if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);

      if (collabSavingRef.current) {
        collabSavingRef.current = false;
        setSaving(false);
      }

      addToast(message, 'error');
    },
  });

  useEffect(() => {
    collabActiveRef.current = collab.active;
  }, [collab.active]);

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
                  if (draft.content === content) {
                    localStorage.removeItem(key);
                  } else {
                    setPendingDraft({
                      content: draft.content,
                      hashMismatch: draft.originalHash !== hash,
                    });
                  }
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
  }, [fileName, browsingDirectory]);

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
      if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      conflictModelsRef.current.forEach((model) => model.dispose());
      conflictModelsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!collab.conflict) {
      setConflictDiffOpen(false);
    }
  }, [collab.conflict]);

  useEditorContainerAutoHeight({
    containerRef: editorContainerRef,
    loading,
    getParent,
    layout: () => editorRef.current?.layout?.(),
    extraObserveRef: contentWrapRef,
    useVisualViewportInset: true,
    deps: [loading, getParent, params.action, fileName],
  });

  const saveShortcutRef = useRef(() => void 0);

  // PierreEditor has no built-in save keybinding (unlike Monaco's editor.addCommand),
  // so bind it at the window level while it's the active engine on an editable action.
  useEffect(() => {
    if (editorEngine !== 'pierre' || (params.action !== 'new' && params.action !== 'edit')) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveShortcutRef.current();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorEngine, params.action]);

  const forceCollabSave = () => {
    if (!collab.conflict) return;

    if (collab.save(true, collab.conflict.hash)) {
      collabSavingRef.current = true;
      setSaving(true);

      if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);
      collabSaveTimerRef.current = setTimeout(() => {
        if (collabSavingRef.current) {
          collabSavingRef.current = false;
          setSaving(false);
          addToast(t('pages.server.files.toast.collabSaveTimeout', {}), 'error');
        }
      }, 15000);
    }
  };

  const hasEditor = () => (editorEngine === 'pierre' ? !!pierreEditorRef.current : !!editorRef.current);
  const getEditorValue = (): string =>
    (editorEngine === 'pierre' ? pierreEditorRef.current?.getValue() : editorRef.current?.getValue()) ?? '';
  const setEditorValue = (value: string) => {
    if (editorEngine === 'pierre') pierreEditorRef.current?.setValue(value);
    else editorRef.current?.setValue(value);
  };

  const handleContentChange = (value: string) => {
    contentRef.current = value;

    const changed = value !== savedContentRef.current;
    setDirty(collabActiveRef.current ? true : changed);

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    if (changed && draftPathRef.current) {
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
  };

  const revertToDisk = async () => {
    const path = join(browsingDirectory, fileName);

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    localStorage.removeItem(draftKey(server.uuid, path));
    setPendingDraft(null);

    if (collabActiveRef.current && collab.reload()) {
      return;
    }

    if (!hasEditor()) return;

    await getFileContent(server.uuid, path)
      .then((content) => content.text())
      .then((text) => {
        if (draftPathRef.current !== path || !hasEditor()) return;

        savedContentRef.current = text;
        originalHashRef.current = hashContent(text);
        setEditorValue(text);
        setDirty(false);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'));
  };

  const openConflictDiff = () => {
    setConflictModifiedContent(getEditorValue());
    setConflictDiskContent(null);
    setConflictDiffOpen(true);

    getFileContent(server.uuid, join(browsingDirectory, fileName))
      .then((content) => content.text())
      .then((text) => setConflictDiskContent(text))
      .catch((msg) => {
        setConflictDiffOpen(false);
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  const saveFile = (name?: string) => {
    if (!hasEditor() || !browsingWritableDirectory) return;

    if (!name && collabActiveRef.current) {
      if (collab.save()) {
        collabSavingRef.current = true;
        setSaving(true);

        if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);
        collabSaveTimerRef.current = setTimeout(() => {
          if (collabSavingRef.current) {
            collabSavingRef.current = false;
            setSaving(false);
            addToast(t('pages.server.files.toast.collabSaveTimeout', {}), 'error');
          }
        }, 15000);

        return;
      }

      collabActiveRef.current = false;
    }

    setDirty(false);

    const currentContent = getEditorValue();
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

  useEffect(() => {
    saveShortcutRef.current = () => {
      if (params.action === 'new') {
        if (canCreate) setNameModalOpen(true);
      } else if (collab.active ? canUpdate : canCreate) {
        saveFile();
      }
    };
  });

  useQuickActions([
    {
      id: 'files.editor.save',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.quickAction.saveFile', {}),
      icon: <FontAwesomeIcon icon={faFloppyDisk} />,
      permission: collab.active ? 'files.update' : 'files.create',
      isVisible: () => params.action === 'edit' && !!fileName && browsingWritableDirectory && !saving,
      perform: () => saveFile(),
    },
    {
      id: 'files.editor.create',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.quickAction.createFile', {}),
      icon: <FontAwesomeIcon icon={faFileCirclePlus} />,
      permission: 'files.create',
      isVisible: () => params.action === 'new' && browsingWritableDirectory && !saving,
      perform: () => setNameModalOpen(true),
    },
    {
      id: 'files.editor.revisions',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.tooltip.fileHistory', {}),
      keywords: ['revisions', 'versions'],
      icon: <FontAwesomeIcon icon={faClockRotateLeft} />,
      permission: 'files.read-content',
      isVisible: () => params.action === 'edit' && !!fileName && browsingPrimaryFilesystem,
      perform: () => setRevisionsOpen(true),
    },
    {
      id: 'files.editor.revertToDisk',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.server.files.tooltip.revertToDisk', {}),
      keywords: ['revert', 'discard'],
      icon: <FontAwesomeIcon icon={faArrowsRotate} />,
      permission: collab.active ? 'files.update' : 'files.read-content',
      isVisible: () =>
        dirty && params.action === 'edit' && !!fileName && browsingWritableDirectory && !collab.conflict?.deleted,
      perform: () => setRevertConfirm(true),
    },
  ]);

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

  const showRevertAction =
    (collab.active ? canUpdate : canReadContent) &&
    dirty &&
    params.action === 'edit' &&
    !!fileName &&
    browsingWritableDirectory &&
    !collab.conflict?.deleted;
  const showHistoryAction = canReadContent && params.action === 'edit' && !!fileName && browsingPrimaryFilesystem;

  return (
    <ServerContentContainer
      hideTitleComponent
      fullscreen
      title={title}
      registry={window.extensionContext.extensionRegistry.pages.server.files.editorContainer}
    >
      <FileEditorHeader
        title={title}
        matchedFileEditorAction={matchedFileEditorAction}
        action={params.action!}
        collabActive={collab.active}
        collabParticipants={collab.participants}
        showRevertAction={showRevertAction}
        showHistoryAction={showHistoryAction}
        onRevertClick={() => setRevertConfirm(true)}
        onHistoryClick={() => setRevisionsOpen(true)}
        fileName={fileName}
        saving={saving}
        onSave={() => saveFile()}
        onCreateClick={() => setNameModalOpen(true)}
      />

      <FileEditorDraftModal
        pendingDraft={pendingDraft}
        onDiscard={() => {
          localStorage.removeItem(draftKey(server.uuid, join(browsingDirectory, fileName)));
          setPendingDraft(null);
        }}
        onRestore={(content) => {
          setEditorValue(content);
          setDirty(true);
          setPendingDraft(null);
        }}
      />

      <FileEditorConflictDiffModal
        opened={conflictDiffOpen}
        onClose={() => setConflictDiffOpen(false)}
        conflictDiskContent={conflictDiskContent}
        conflictModifiedContent={conflictModifiedContent}
        fileName={fileName}
        getEditorValue={getEditorValue}
        conflictModelsRef={conflictModelsRef}
        onKeepEditor={() => {
          setConflictDiffOpen(false);
          forceCollabSave();
        }}
        onLoadDisk={() => {
          setConflictDiffOpen(false);
          setRevertConfirm(true);
        }}
      />

      <ConfirmationModal
        title={t('pages.server.files.modal.revertToDisk.title', {})}
        opened={revertConfirm}
        onClose={() => setRevertConfirm(false)}
        onConfirmed={async () => {
          await revertToDisk();
          setRevertConfirm(false);
        }}
        confirm={t('pages.server.files.button.loadDisk', {})}
      >
        {collab.participants.length > 1
          ? t('pages.server.files.modal.revertToDisk.contentMultiple', {
              participants: collab.participants.length,
            })
          : t('pages.server.files.modal.revertToDisk.content', {})}
      </ConfirmationModal>

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
        getContent={() => getEditorValue()}
        onRestore={(newContent) => {
          setEditorValue(newContent);
          setDirty(true);
        }}
      />

      {loading ? (
        <div className='w-full h-screen flex items-center justify-center'>
          <Spinner size={75} />
        </div>
      ) : (
        <div ref={contentWrapRef} className='flex flex-col relative'>
          <FileNameModal
            onFileName={(name: string) => saveFile(name)}
            opened={nameModalOpen}
            onClose={() => setNameModalOpen(false)}
          />

          <div className='flex justify-between w-full py-2 lg:py-4'>
            <FileBreadcrumbs inFileEditor path={join(browsingDirectory, fileName)} />
          </div>
          {collab.active && collab.conflict && (
            <Alert
              mb='sm'
              color='yellow'
              className='mx-4 lg:mx-6'
              icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
            >
              <Group justify='space-between'>
                <span>
                  {collab.conflict.deleted
                    ? t('pages.server.files.alert.collabConflictDeleted', {})
                    : t('pages.server.files.alert.collabConflictChanged', {})}
                </span>
                <Group gap='xs'>
                  {!collab.conflict.deleted && (
                    <Button size='xs' variant='default' onClick={openConflictDiff}>
                      {t('pages.server.files.button.viewDiff', {})}
                    </Button>
                  )}
                  <ServerCan action='files.update'>
                    {!collab.conflict.deleted && (
                      <Button size='xs' variant='default' onClick={() => setRevertConfirm(true)}>
                        {t('pages.server.files.button.loadDisk', {})}
                      </Button>
                    )}
                    <Button size='xs' color='yellow' loading={saving} onClick={forceCollabSave}>
                      {t('pages.server.files.button.keepEditor', {})}
                    </Button>
                  </ServerCan>
                </Group>
              </Group>
            </Alert>
          )}
          <div className='relative'>
            <FileEditorContent
              containerRef={editorContainerRef}
              matchedFileEditorAction={matchedFileEditorAction}
              action={params.action!}
              content={content}
              setContent={setContent}
              dirty={dirty}
              setDirty={setDirty}
              blobContent={blobContent}
              setBlobContent={setBlobContent}
              fileName={fileName}
              handleContentChange={handleContentChange}
              handlePierreChangeEvent={collab.handlePierreChangeEvent}
              attachPierreEditor={collab.attachPierreEditor}
              attachEditor={collab.attachEditor}
              editorRef={editorRef}
              pierreEditorRef={pierreEditorRef}
              saveShortcutRef={saveShortcutRef}
            />
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
