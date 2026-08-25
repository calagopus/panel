import { faArrowsRotate, faClockRotateLeft, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AvatarGroup } from '@mantine/core';
import { type OnMount } from '@monaco-editor/react';
import { join } from 'pathe';
import { startTransition, useEffect, useRef, useState } from 'react';
import { createSearchParams, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Avatar from '@/elements/Avatar.tsx';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Group from '@/elements/Group.tsx';
import MonacoEditor, { MonacoDiffEditor } from '@/elements/MonacoEditor.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import PierreEditor, { PierreDiffEditor, type PierreEditorHandle } from '@/elements/PierreEditor.tsx';
import ScreenBlock from '@/elements/ScreenBlock.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Title from '@/elements/Title.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/monaco.ts';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { visualViewportBottomInset } from '@/plugins/useVisualViewport.ts';
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
import { FileAudioPreview, FileImagePreview } from './FileMediaPreview.tsx';
import { FileDraft, fileDraftKey, hashFileContent, purgeExpiredFileDrafts } from './fileEditorDrafts.ts';
import useFileCollab from './hooks/useFileCollab.ts';
import FileNameModal from './modals/FileNameModal.tsx';
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
  const {
    editorMinimap,
    editorLineOverflow,
    editorFontSize,
    editorEngine,
    browsingPrimaryFilesystem,
    browsingWritableDirectory,
    browsingDirectory,
    setBrowsingDirectory,
  } = useFileManager(
    useShallow((state) => ({
      editorMinimap: state.editorMinimap,
      editorLineOverflow: state.editorLineOverflow,
      editorFontSize: state.editorFontSize,
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
        originalHashRef.current = hashFileContent(savedContentRef.current);
      }
      setDirty(dirty);
    },
    onSaved: () => {
      if (collabSaveTimerRef.current) clearTimeout(collabSaveTimerRef.current);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      setDirty(false);
      savedContentRef.current = hasEditor() ? getEditorValue() : savedContentRef.current;
      originalHashRef.current = hashFileContent(savedContentRef.current);
      localStorage.removeItem(fileDraftKey(server.uuid, join(browsingDirectory, fileName)));

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
    purgeExpiredFileDrafts();
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
              const hash = hashFileContent(content);
              originalHashRef.current = hash;
              const key = fileDraftKey(server.uuid, join(browsingDirectory, fileName));
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

  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el || loading) return;

    const updateHeight = () => {
      const virtualWindowEl = getParent();
      const elRect = el.getBoundingClientRect();

      const visibleBottom = window.innerHeight - visualViewportBottomInset();

      let bottomEdge;
      if (virtualWindowEl) {
        bottomEdge = Math.min(virtualWindowEl.getBoundingClientRect().bottom, visibleBottom);
      } else {
        bottomEdge = visibleBottom;
      }

      const newHeight = Math.max(0, bottomEdge - elRect.top);
      el.style.height = `${newHeight}px`;

      if (editorRef.current?.layout) {
        editorRef.current.layout();
      }
    };

    const observer = new ResizeObserver(() => updateHeight());

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', updateHeight);
    viewport?.addEventListener('scroll', updateHeight);

    const virtualWindowEl = getParent();
    if (virtualWindowEl) {
      observer.observe(virtualWindowEl);
    } else {
      observer.observe(document.body);
    }

    if (contentWrapRef.current) {
      observer.observe(contentWrapRef.current);
    }

    updateHeight();

    return () => {
      observer.disconnect();
      viewport?.removeEventListener('resize', updateHeight);
      viewport?.removeEventListener('scroll', updateHeight);
    };
  }, [loading, getParent, params.action, fileName]);

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
        localStorage.setItem(fileDraftKey(server.uuid, path), JSON.stringify(draft));
      }, 1000);
    }
  };

  const revertToDisk = async () => {
    const path = join(browsingDirectory, fileName);

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    localStorage.removeItem(fileDraftKey(server.uuid, path));
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
        originalHashRef.current = hashFileContent(text);
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
        originalHashRef.current = hashFileContent(currentContent);
        if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        localStorage.removeItem(fileDraftKey(server.uuid, join(browsingDirectory, name ?? fileName)));
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
      <div className='flex justify-between items-center gap-2 lg:pt-6 px-4 lg:px-6 lg:pb-0'>
        <Group wrap='nowrap' gap='xs' className='min-w-0 flex-1'>
          <Title className='truncate! min-w-0 text-lg! sm:text-[2.125rem]!'>{title}</Title>

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
          <Group wrap='nowrap' gap='xs' className='shrink-0'>
            {collab.active && collab.participants.length > 1 && (
              <AvatarGroup>
                {collab.participants.map((participant) => (
                  <Tooltip
                    key={participant.user}
                    label={t('pages.server.files.tooltip.collabEditing', {
                      user: participant.name,
                    })}
                  >
                    <Avatar size='sm' src={participant.avatar} name={participant.name} />
                  </Tooltip>
                ))}
              </AvatarGroup>
            )}

            {showRevertAction && (
              <div className='hidden sm:block'>
                <Tooltip label={t('pages.server.files.tooltip.revertToDisk', {})}>
                  <ActionIcon size='md' variant='subtle' color='gray' onClick={() => setRevertConfirm(true)}>
                    <FontAwesomeIcon icon={faArrowsRotate} />
                  </ActionIcon>
                </Tooltip>
              </div>
            )}
            {showHistoryAction && (
              <div className='hidden sm:block'>
                <Tooltip label={t('pages.server.files.tooltip.fileHistory', {})}>
                  <ActionIcon size='md' variant='subtle' color='gray' onClick={() => setRevisionsOpen(true)}>
                    <FontAwesomeIcon icon={faClockRotateLeft} />
                  </ActionIcon>
                </Tooltip>
              </div>
            )}

            <div className='hidden sm:block'>
              <FileConnectButton file={fileName ? join(browsingDirectory, fileName) : undefined} />
            </div>
            <div hidden={!browsingWritableDirectory || params.action === 'image' || params.action === 'audio'}>
              {params.action === 'edit' ? (
                <ServerCan action={collab.active ? 'files.update' : 'files.create'}>
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
          localStorage.removeItem(fileDraftKey(server.uuid, join(browsingDirectory, fileName)));
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
                setEditorValue(pendingDraft.content);
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
              localStorage.removeItem(fileDraftKey(server.uuid, join(browsingDirectory, fileName)));
              setPendingDraft(null);
            }}
          >
            {t('common.button.discard', {})}
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        title={t('pages.server.files.modal.collabConflictDiff.title', {})}
        opened={conflictDiffOpen}
        onClose={() => setConflictDiffOpen(false)}
        size='90%'
      >
        {conflictDiskContent === null ? (
          <div className='w-full h-[70vh] flex items-center justify-center'>
            <Spinner />
          </div>
        ) : (
          <div className='h-[70vh] flex'>
            {editorEngine === 'pierre' ? (
              <PierreDiffEditor
                height='100%'
                width='100%'
                originalPath={`${fileName} (Disk)`}
                originalValue={conflictDiskContent ?? ''}
                modifiedPath={`${fileName} (Editor)`}
                modifiedValue={conflictModifiedContent}
                readOnly
                wordWrap={editorLineOverflow}
              />
            ) : (
              <MonacoDiffEditor
                height='100%'
                width='100%'
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  codeLens: false,
                  scrollBeyondLastLine: false,
                  originalEditable: false,
                }}
                onMount={(diffEditor, monaco) => {
                  conflictModelsRef.current.forEach((model) => model.dispose());

                  const originalModel = monaco.editor.createModel(conflictDiskContent, undefined);
                  const modifiedModel = monaco.editor.createModel(getEditorValue(), undefined);
                  conflictModelsRef.current = [originalModel, modifiedModel];

                  diffEditor.setModel({
                    original: originalModel,
                    modified: modifiedModel,
                  });
                }}
              />
            )}
          </div>
        )}

        <ModalFooter>
          <ServerCan action='files.update'>
            <Button
              color='yellow'
              onClick={() => {
                setConflictDiffOpen(false);
                forceCollabSave();
              }}
            >
              {t('pages.server.files.button.keepEditor', {})}
            </Button>
            <Button
              variant='default'
              onClick={() => {
                setConflictDiffOpen(false);
                setRevertConfirm(true);
              }}
            >
              {t('pages.server.files.button.loadDisk', {})}
            </Button>
          </ServerCan>
        </ModalFooter>
      </Modal>

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
          localStorage.removeItem(fileDraftKey(server.uuid, join(browsingDirectory, fileName)));
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
                <FileImagePreview src={content} name={fileName} />
              ) : params.action === 'audio' ? (
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
                  onChangeEvent={collab.handlePierreChangeEvent}
                  onMount={(editor) => {
                    pierreEditorRef.current = editor;
                    collab.attachPierreEditor(editor);
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
                    collab.attachEditor(editor);
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
