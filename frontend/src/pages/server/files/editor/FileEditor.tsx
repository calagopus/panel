import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type OnMount } from '@monaco-editor/react';
import { join } from 'pathe';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { createSearchParams, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { FileEditorActionContext } from 'shared/src/registries/pages/server/files';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import { type PierreEditorHandle } from '@/elements/editors/PierreEditor.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import ScreenBlock from '@/elements/feedback/ScreenBlock.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { readFileDraft, removeFileDraft } from '@/lib/files/fileDrafts.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useContainerAutoHeight } from '@/plugins/viewport/useContainerAutoHeight.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { FileManagerProvider, useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import FileRevisionsDrawer from '../drawers/FileRevisionsDrawer.tsx';
import FileBreadcrumbs from '../FileBreadcrumbs.tsx';
import useFileCollab from '../hooks/useFileCollab.ts';
import useFileDraft from '../hooks/useFileDraft.ts';
import useFileDraftPersistence from '../hooks/useFileDraftPersistence.ts';
import FileEditorConflictDiffModal from '../modals/FileEditorConflictDiffModal.tsx';
import FileEditorDraftModal from '../modals/FileEditorDraftModal.tsx';
import FileNameModal from '../modals/FileNameModal.tsx';
import FileEditorContent from './FileEditorContent.tsx';
import FileEditorHeader from './FileEditorHeader.tsx';
import { findFileEditorAction, useFileEditorTitle } from './useFileEditorPresentation.ts';
import useFileEditorQuickActions from './useFileEditorQuickActions.tsx';

function FileEditorComponent() {
  const params = useParams<'action'>();

  const matchedFileEditorAction = findFileEditorAction(params.action);

  const { t } = useTranslations();
  const [searchParams, _] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const { setSavedContent, hasChanges, persistDraft } = useFileDraft(server.uuid);
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

  const [loading, setLoading] = useState(params.action !== 'new');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [handoffContent, setHandoffContent] = useState<string | undefined>(() =>
    typeof location.state?.editorContent === 'string' ? location.state.editorContent : undefined,
  );
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
  const draftPathRef = useRef<string | null>(null);
  const handoffTargetRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const objectUrlRef = useRef<string | null>(null);
  const collabActiveRef = useRef(false);
  const collabSavingRef = useRef(false);
  const collabSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const conflictModelsRef = useRef<{ dispose: () => void }[]>([]);
  const blocker = useBlocker(dirty, false, (tx) => {
    if (tx.location.pathname === location.pathname && tx.location.search === location.search) return false;
    if (handoffTargetRef.current === tx.location.pathname + tx.location.search) return false;
    if (!tx.location.pathname.includes('/files/diff')) return true;
    return new URLSearchParams(tx.location.search).has('previousRevision');
  });
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const contentWrapRef = useRef<HTMLDivElement>(null);
  const currentDraftPath = params.action === 'new' ? `new:${browsingDirectory}` : join(browsingDirectory, fileName);
  useFileDraftPersistence(server.uuid, currentDraftPath, dirty);

  const collab = useFileCollab({
    enabled: params.action === 'edit' && !!fileName && !!browsingDirectory && browsingPrimaryFilesystem && !loading,
    engine: editorEngine === 'pierre' ? 'pierre' : 'monaco',
    filePath: fileName && browsingDirectory ? join(browsingDirectory, fileName) : '',
    restoreContent: canUpdate && browsingWritableDirectory ? handoffContent : undefined,
    onRestoreContent: () => setHandoffContent(undefined),
    onActivated: (dirty) => {
      collabActiveRef.current = true;
      if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);

      if (collabSavingRef.current) {
        collabSavingRef.current = false;
        setSaving(false);
      }

      if (!dirty && hasEditor()) setSavedContent(getEditorValue());
      setDirty(dirty);
    },
    onSaved: () => {
      if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);
      setDirty(false);
      if (hasEditor()) setSavedContent(getEditorValue());
      removeFileDraft(server.uuid, currentDraftPath);

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
    if (params.action !== 'new') return;
    const draft = readFileDraft(server.uuid, currentDraftPath);
    setPendingDraft(draft ? { content: draft.content, hashMismatch: false } : null);
  }, [server.uuid, currentDraftPath, params.action]);

  useEffect(() => {
    if (location.state?.openRevisions) {
      setRevisionsOpen(true);
    }
    if (typeof location.state?.editorContent === 'string') {
      navigate(location.pathname + location.search, {
        replace: true,
        state: { ...location.state, editorContent: undefined },
      });
    }
  }, []);

  useEffect(() => {
    if (!browsingDirectory || !fileName) return;
    if (params.action === 'new') return;

    let cancelled = false;
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
        if (cancelled) return;
        startTransition(() => {
          if (typeof content === 'string') {
            const restored = handoffContent ?? content;
            contentRef.current = restored;
            setContent(restored);
            const hash = setSavedContent(content);
            setDirty(restored !== content);

            if (params.action === 'edit') {
              const draft = readFileDraft(server.uuid, currentDraftPath);
              if (handoffContent !== undefined) {
                if (restored !== content) persistDraft(currentDraftPath, restored);
              } else if (draft) {
                if (draft.content === content) removeFileDraft(server.uuid, currentDraftPath);
                else setPendingDraft({ content: draft.content, hashMismatch: draft.originalHash !== hash });
              }
            }
          } else {
            setBlobContent(content);
          }

          setLoading(false);
        });
      })
      .catch((msg) => {
        if (cancelled) return;
        addToast(httpErrorToHuman(msg), 'error');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileName, browsingDirectory]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    draftPathRef.current = params.action === 'new' || params.action === 'edit' ? currentDraftPath : null;
  }, [params.action, fileName, browsingDirectory]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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

  useContainerAutoHeight({
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
    handleContentChange(value);
    if (editorEngine === 'pierre') pierreEditorRef.current?.setValue(value);
    else editorRef.current?.setValue(value);
  };

  const handleContentChange = (value: string) => {
    contentRef.current = value;
    setContent(value);

    const changed = hasChanges(value);
    setDirty(collabActiveRef.current ? true : changed);

    if (draftPathRef.current) {
      const path = draftPathRef.current;
      persistDraft(path, value, { dirty: changed, preserve: pendingDraft !== null });
    }
  };

  const revertToDisk = async () => {
    const path = join(browsingDirectory, fileName);

    removeFileDraft(server.uuid, path);
    setPendingDraft(null);

    if (collabActiveRef.current && collab.reload()) {
      return;
    }

    if (!hasEditor()) return;

    await getFileContent(server.uuid, path)
      .then((content) => content.text())
      .then((text) => {
        if (draftPathRef.current !== path || !hasEditor()) return;

        setSavedContent(text);
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
    if (!hasEditor() || !browsingWritableDirectory || saving) return;

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

    const currentContent = getEditorValue();
    const savedPath = join(browsingDirectory, name ?? fileName);
    setSaving(true);

    saveFileContent(server.uuid, savedPath, currentContent)
      .then(() => {
        if (!mountedRef.current) return;
        startTransition(() => {
          setSaving(false);
          setNameModalOpen(false);
        });

        setSavedContent(currentContent);
        const stillDirty = persistDraft(savedPath, contentRef.current);
        setDirty(stillDirty);
        addToast(t('pages.server.files.toast.fileSaved', {}), 'success');

        if (name) {
          removeFileDraft(server.uuid, currentDraftPath);
          const target = `/server/${server.uuidShort}/files/edit?${createSearchParams({ directory: browsingDirectory, file: name })}`;
          handoffTargetRef.current = target;
          navigate(target, { state: stillDirty ? { editorContent: contentRef.current } : undefined });
        }
      })
      .catch((msg) => {
        if (!mountedRef.current) return;
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

  useFileEditorQuickActions({
    action: params.action,
    fileName,
    writable: browsingWritableDirectory,
    primary: browsingPrimaryFilesystem,
    saving,
    dirty,
    collaborationActive: collab.active,
    collaborationDeleted: !!collab.conflict?.deleted,
    onSave: () => saveFile(),
    onCreate: () => setNameModalOpen(true),
    onShowRevisions: () => setRevisionsOpen(true),
    onRevert: () => setRevertConfirm(true),
  });

  const title = useFileEditorTitle(params.action, fileName, matchedFileEditorAction?.title(fileName));

  const editorContext = useMemo<FileEditorActionContext>(
    () => ({
      surface: 'page',
      directory: browsingDirectory,
      file: fileName,
      path: join(browsingDirectory, fileName),
      params: Object.fromEntries(Array.from(searchParams).filter(([key]) => key !== 'directory' && key !== 'file')),
    }),
    [browsingDirectory, fileName, searchParams],
  );

  if (!matchedFileEditorAction && !['new', 'edit', 'image', 'audio'].includes(params.action!)) {
    return (
      <ServerContentContainer title={t('pages.server.files.editorNotFound.title', {})} hideTitleComponent>
        <ScreenBlock title='404' content={t('pages.server.files.editorNotFound.content', {})} />
      </ServerContentContainer>
    );
  }

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
          removeFileDraft(server.uuid, currentDraftPath);
          setPendingDraft(null);
        }}
        onRestore={(content) => {
          if (!collabActiveRef.current) setHandoffContent(content);
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
              readOnly={!browsingWritableDirectory || !(collab.active ? canUpdate : canCreate)}
              context={editorContext}
              handleContentChange={handleContentChange}
              handlePierreChangeEvent={collab.handlePierreChangeEvent}
              handlePierreSelectionChange={collab.handlePierreSelectionChange}
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
  const params = useParams<'action'>();
  const [searchParams] = useSearchParams();
  const serverUuid = useServerStore((state) => state.server.uuid);
  const documentKey = JSON.stringify([
    serverUuid,
    params.action,
    searchParams.get('directory'),
    searchParams.get('file'),
  ]);
  return (
    <FileManagerProvider key={documentKey}>
      <FileEditorComponent />
    </FileManagerProvider>
  );
}
