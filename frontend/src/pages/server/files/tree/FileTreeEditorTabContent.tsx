import {
  faArrowsRotate,
  faClockRotateLeft,
  faFloppyDisk,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AvatarGroup } from '@mantine/core';
import { AxiosError } from 'axios';
import { join } from 'pathe';
import { useEffect, useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Avatar from '@/elements/data-display/Avatar.tsx';
import MonacoEditor from '@/elements/editors/MonacoEditor.tsx';
import PierreEditor, { type PierreEditorHandle } from '@/elements/editors/PierreEditor.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Title from '@/elements/typography/Title.tsx';
import { fileModelUri } from '@/lib/editor/fileModelUri.ts';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/editor/monaco.ts';
import { readFileDraft, removeFileDraft } from '@/lib/files/fileDrafts.ts';
import FileRevisionsDrawer from '@/pages/server/files/drawers/FileRevisionsDrawer.tsx';
import FileEditorSettings from '@/pages/server/files/editor/FileEditorSettings.tsx';
import FileImageViewerSettings from '@/pages/server/files/editor/FileImageViewerSettings.tsx';
import { FileAudioPreview, FileImagePreview } from '@/pages/server/files/editor/FileMediaPreview.tsx';
import FileSqliteQuery from '@/pages/server/files/editor/FileSqliteQuery.tsx';
import { findFileEditorAction } from '@/pages/server/files/editor/useFileEditorPresentation.ts';
import useFileEditorQuickActions from '@/pages/server/files/editor/useFileEditorQuickActions.tsx';
import useEditorFontSizeZoom from '@/pages/server/files/hooks/useEditorFontSizeZoom.ts';
import useFileCollab from '@/pages/server/files/hooks/useFileCollab.ts';
import useFileDraft from '@/pages/server/files/hooks/useFileDraft.ts';
import useFileDraftPersistence from '@/pages/server/files/hooks/useFileDraftPersistence.ts';
import FileEditorConflictDiffModal from '@/pages/server/files/modals/FileEditorConflictDiffModal.tsx';
import FileEditorDraftModal from '@/pages/server/files/modals/FileEditorDraftModal.tsx';
import FileNameModal from '@/pages/server/files/modals/FileNameModal.tsx';
import { FileTreeEditorSelection, getFileTreeEditorDraftPath } from '@/pages/server/files/tree/fileTreeEditor.ts';
import FileTreeRevisionComparison, {
  type FileRevisionComparison,
} from '@/pages/server/files/tree/FileTreeRevisionComparison.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { trackActivity } from '@/stores/activity.ts';
import { useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

interface FileTreeEditorTabContentProps {
  tabId: string;
  paneId: string;
  paneIndex: number;
  paneCount: number;
  visible: boolean;
  active: boolean;
  selection: FileTreeEditorSelection;
  draftContent?: string;
  restoreContent?: string;
  onRestoreContent: (tabId: string) => void;
  onClose: (paneId: string, tabId: string) => void;
  onMissing: (tabId: string) => void;
  onDirtyChange: (tabId: string, dirty: boolean) => void;
  onDraftChange: (tabId: string, content: string | null) => void;
  onCreateFile: (tabId: string, name: string) => Promise<void>;
}

export default function FileTreeEditorTabContent({
  tabId,
  paneId,
  paneIndex,
  paneCount,
  visible,
  active,
  selection,
  draftContent,
  restoreContent,
  onRestoreContent,
  onClose,
  onMissing,
  onDirtyChange,
  onDraftChange,
  onCreateFile,
}: FileTreeEditorTabContentProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const { setSavedContent, hasChanges, persistDraft } = useFileDraft(server.uuid);
  const canCreate = useServerCan('files.create');
  const canReadContent = useServerCan('files.read-content');
  const canUpdate = useServerCan('files.update');
  const canQuerySqlite = useServerCan('files.query-raw');
  const { editorMinimap, editorLineOverflow, editorFontSize, editorEngine } = useFileManagerStore(
    useShallow((state) => ({
      editorMinimap: state.editorMinimap,
      editorLineOverflow: state.editorLineOverflow,
      editorFontSize: state.editorFontSize,
      editorEngine: state.editorEngine,
    })),
  );
  const [loading, setLoading] = useState(!['new', 'sqlite'].includes(selection.action));
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(draftContent !== undefined);
  const [revertConfirm, setRevertConfirm] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisionComparison, setRevisionComparison] = useState<FileRevisionComparison | null>(null);
  const [conflictDiffOpen, setConflictDiffOpen] = useState(false);
  const [conflictDiskContent, setConflictDiskContent] = useState<string | null>(null);
  const [conflictModifiedContent, setConflictModifiedContent] = useState('');
  const [content, setContent] = useState('');
  const [pendingDraft, setPendingDraft] = useState<{ content: string; hashMismatch: boolean } | null>(null);
  const [restoreOnConnect, setRestoreOnConnect] = useState<string | undefined>();
  const [blobContent, setBlobContent] = useState(new Blob());
  const contentRef = useRef('');
  const mountedRef = useRef(true);
  const instanceId = useId();
  const initialDraftContentRef = useRef(draftContent);
  const pierreEditorRef = useRef<PierreEditorHandle | null>(null);
  const focusEditorRef = useRef<(() => void) | null>(null);
  const wasVisibleRef = useRef(visible);
  const zoomRef = useEditorFontSizeZoom();
  const saveRef = useRef<() => void>(() => undefined);
  const onMissingRef = useRef(onMissing);
  const collabActiveRef = useRef(false);
  const collabSavingRef = useRef(false);
  const collabSaveTimerRef = useRef<number | null>(null);
  const conflictModelsRef = useRef<{ dispose: () => void }[]>([]);

  useEffect(() => {
    onMissingRef.current = onMissing;
  }, [onMissing]);

  const filePath = join(selection.directory, selection.file.name);
  const draftPath = getFileTreeEditorDraftPath(selection);
  const modelPath = fileModelUri(server.uuid, filePath, instanceId);
  useFileDraftPersistence(server.uuid, draftPath, dirty);
  const publishDraft = (value: string, changed: boolean) => {
    onDraftChange(tabId, changed ? value : null);
    persistDraft(draftPath, value, { dirty: changed, preserve: pendingDraft !== null });
  };
  const editorContext = {
    surface: 'inline' as const,
    directory: selection.directory,
    file: selection.file.name,
    path: filePath,
    params: selection.params,
    workspace: { paneId, paneIndex, paneCount, active },
  };
  const matchedAction = findFileEditorAction(selection.action);
  const editableText =
    selection.action === 'new' || selection.action === 'edit' || matchedAction?.contentType === 'string';
  const reportFileError = (error: unknown) => {
    if (error instanceof AxiosError && error.response?.status === 404) {
      onMissingRef.current(tabId);
    } else {
      addToast(httpErrorToHuman(error), 'error');
    }
  };
  const stopCollabSave = () => {
    if (collabSaveTimerRef.current) window.clearTimeout(collabSaveTimerRef.current);
    const wasSaving = collabSavingRef.current;
    collabSavingRef.current = false;
    setSaving(false);
    return wasSaving;
  };
  const compressed = !selection.file.editable && selection.file.innerEditable;
  const writable = selection.writable && !compressed;
  const collab = useFileCollab({
    enabled: selection.action === 'edit' && selection.primary && !compressed && !loading,
    engine: editorEngine,
    filePath,
    restoreContent:
      canUpdate && writable ? (restoreContent ?? initialDraftContentRef.current ?? restoreOnConnect) : undefined,
    onRestoreContent: () => {
      setRestoreOnConnect(undefined);
      onRestoreContent(tabId);
    },
    onActivated: (serverDirty) => {
      collabActiveRef.current = true;
      if (!serverDirty) setSavedContent(contentRef.current);
      setDirty(serverDirty);
      if (!pendingDraft) publishDraft(contentRef.current, serverDirty);
    },
    onSaved: () => {
      setSavedContent(contentRef.current);
      setDirty(false);
      publishDraft(contentRef.current, false);

      if (stopCollabSave()) {
        addToast(t('pages.server.files.toast.fileSaved', {}), 'success');
      }
    },
    onConflict: (conflict) => {
      if (!conflict || !collabSavingRef.current) return;
      stopCollabSave();
    },
    onError: (message) => {
      stopCollabSave();
      addToast(message, 'error');
    },
  });
  const contentWritable = writable && (collab.active ? canUpdate : canCreate);
  const canEdit = contentWritable && editableText;
  const canSave =
    canEdit &&
    revisionComparison?.previousRevisionId === undefined &&
    (!revisionComparison || editorEngine === 'monaco');

  useEffect(() => {
    collabActiveRef.current = collab.active;
  }, [collab.active]);

  useEffect(() => {
    onDirtyChange(tabId, dirty);
  }, [tabId, dirty, onDirtyChange]);

  useEffect(() => {
    if (visible && !wasVisibleRef.current && active) focusEditorRef.current?.();
    wasVisibleRef.current = visible;
  }, [visible, active]);

  useEffect(() => {
    const resetContent = (nextDirty: boolean) => {
      setDirty(nextDirty);
      contentRef.current = '';
      setContent('');
      setBlobContent(new Blob());
    };

    if (selection.action === 'sqlite') {
      resetContent(false);
      setLoading(false);
      return;
    }

    if (selection.action === 'new') {
      const draft = initialDraftContentRef.current ?? readFileDraft(server.uuid, draftPath)?.content ?? '';
      contentRef.current = draft;
      setContent(draft);
      setDirty(draft !== '');
      onDraftChange(tabId, draft || null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let nextMediaUrl: string | null = null;
    resetContent(initialDraftContentRef.current !== undefined);
    setLoading(true);

    trackActivity(getFileContent(server.uuid, filePath))
      .then(async (blob) => {
        if (matchedAction?.contentType === 'blob') return blob;
        if (selection.action === 'image' || selection.action === 'audio') {
          nextMediaUrl = URL.createObjectURL(blob);
          return nextMediaUrl;
        }
        return blob.text();
      })
      .then((loaded) => {
        if (cancelled) return;

        if (loaded instanceof Blob) {
          setBlobContent(loaded);
        } else if (selection.action === 'image' || selection.action === 'audio') {
          setContent(loaded);
        } else {
          const restoredContent = initialDraftContentRef.current ?? loaded;
          const hash = setSavedContent(loaded);
          contentRef.current = restoredContent;
          setContent(restoredContent);
          setDirty(restoredContent !== loaded);
          if (initialDraftContentRef.current === undefined) {
            const draft = readFileDraft(server.uuid, filePath);
            if (draft && draft.content !== loaded) {
              setPendingDraft({ content: draft.content, hashMismatch: draft.originalHash !== hash });
            } else if (draft) removeFileDraft(server.uuid, filePath);
          }
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const draft = initialDraftContentRef.current;
        if (error instanceof AxiosError && error.response?.status === 404 && draft !== undefined) {
          contentRef.current = draft;
          setContent(draft);
          setDirty(true);
          addToast(httpErrorToHuman(error), 'error');
        } else {
          reportFileError(error);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (nextMediaUrl) URL.revokeObjectURL(nextMediaUrl);
    };
  }, [server.uuid, filePath, selection.action, matchedAction?.contentType, addToast, tabId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (collabSaveTimerRef.current) window.clearTimeout(collabSaveTimerRef.current);
      conflictModelsRef.current.forEach((model) => model.dispose());
      conflictModelsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!collab.conflict) setConflictDiffOpen(false);
  }, [collab.conflict]);

  const updateContent = (value: string) => {
    const changed = collabActiveRef.current || hasChanges(value);
    contentRef.current = value;
    setContent(value);
    setDirty(changed);
    publishDraft(value, changed);
  };

  const replaceEditorContent = (value: string, changed: boolean) => {
    contentRef.current = value;
    setContent(value);
    pierreEditorRef.current?.setValue(value);
    setDirty(changed);
    publishDraft(value, changed);
  };

  const restoreRevision = (value: string) => {
    replaceEditorContent(value, true);
    setRevisionComparison(null);
  };

  const beginCollabSave = (force = false) => {
    const requested = force ? collab.save(true, collab.conflict?.hash) : collab.save();
    if (!requested) return false;

    collabSavingRef.current = true;
    setSaving(true);
    if (collabSaveTimerRef.current) window.clearTimeout(collabSaveTimerRef.current);
    collabSaveTimerRef.current = window.setTimeout(() => {
      if (!collabSavingRef.current) return;

      stopCollabSave();
      addToast(t('pages.server.files.toast.collabSaveTimeout', {}), 'error');
    }, 15_000);
    return true;
  };

  const save = async () => {
    if (!canSave || saving || loading) return;

    if (selection.action === 'new') {
      setNameModalOpen(true);
      return;
    }

    if (collabActiveRef.current && beginCollabSave()) return;

    setSaving(true);
    const submittedContent = contentRef.current;
    try {
      await saveFileContent(server.uuid, filePath, submittedContent);
      if (!mountedRef.current) return;
      setSavedContent(submittedContent);
      const stillDirty = hasChanges(contentRef.current);
      setDirty(stillDirty);
      publishDraft(contentRef.current, stillDirty);
      addToast(t('pages.server.files.toast.fileSaved', {}), 'success');
    } catch (error) {
      if (!mountedRef.current) return;
      reportFileError(error);
    }
    setSaving(false);
  };

  useEffect(() => {
    saveRef.current = () => void save();
  }, [save]);

  const openConflictDiff = () => {
    setConflictModifiedContent(contentRef.current);
    setConflictDiskContent(null);
    setConflictDiffOpen(true);

    getFileContent(server.uuid, filePath)
      .then((blob) => blob.text())
      .then((text) => setConflictDiskContent(text))
      .catch((error) => {
        setConflictDiffOpen(false);
        reportFileError(error);
      });
  };

  const revertToDisk = async () => {
    if (collabActiveRef.current && collab.reload()) return;

    setLoading(true);
    try {
      const loaded = await getFileContent(server.uuid, filePath).then((blob) => blob.text());
      setSavedContent(loaded);
      replaceEditorContent(loaded, false);
    } catch (error) {
      reportFileError(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!active || !canSave || editorEngine !== 'pierre') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveRef.current();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, canSave, editorEngine]);

  useFileEditorQuickActions({
    enabled: active,
    loading,
    saveEnabled: canSave,
    action: selection.action,
    fileName: selection.file.name,
    writable,
    primary: selection.primary,
    saving,
    dirty,
    collaborationActive: collab.active,
    collaborationDeleted: collab.conflict?.deleted ?? false,
    onSave: () => void save(),
    onCreate: () => void save(),
    onShowRevisions: () => setRevisionsOpen(true),
    onRevert: () => setRevertConfirm(true),
  });

  const title = matchedAction ? matchedAction.title(selection.file.name) : selection.file.name;
  const unknownAction = !matchedAction && !['new', 'edit', 'image', 'audio', 'sqlite'].includes(selection.action);
  const unavailableAction = unknownAction || (selection.action === 'sqlite' && !canQuerySqlite);
  const showRevertAction =
    (collab.active ? canUpdate : canReadContent) &&
    dirty &&
    selection.action === 'edit' &&
    writable &&
    !collab.conflict?.deleted;
  const showHistoryAction = canReadContent && selection.action === 'edit' && selection.primary && !compressed;

  return (
    <div className={`flex min-h-0 w-full min-w-0 flex-1 flex-col ${visible ? '' : 'hidden'}`}>
      <div
        data-file-manager-editor-header
        className='flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-(--mantine-color-default-border) px-3 py-2'
      >
        <Group wrap='nowrap' gap='xs' className='min-w-0 flex-1'>
          <Title order={3} className='truncate! text-base!'>
            {title}
          </Title>
          {matchedAction?.header.settings ? (
            <matchedAction.header.settings />
          ) : selection.action === 'edit' || selection.action === 'new' ? (
            <FileEditorSettings />
          ) : selection.action === 'image' ? (
            <FileImageViewerSettings />
          ) : null}
        </Group>

        <Group wrap='nowrap' gap='xs' className='shrink-0'>
          {collab.active && collab.participants.length > 1 && (
            <AvatarGroup data-file-manager-collaboration-participants>
              {collab.participants.map((participant) => (
                <Tooltip
                  key={participant.user}
                  label={t('pages.server.files.tooltip.collabEditing', { user: participant.name })}
                >
                  <Avatar size='sm' src={participant.avatar} name={participant.name} />
                </Tooltip>
              ))}
            </AvatarGroup>
          )}
          {matchedAction?.header.rightSection && <matchedAction.header.rightSection />}
          {showRevertAction && (
            <Tooltip label={t('pages.server.files.tooltip.revertToDisk', {})}>
              <ActionIcon
                size='md'
                variant='subtle'
                color='gray'
                aria-label={t('pages.server.files.tooltip.revertToDisk', {})}
                onClick={() => setRevertConfirm(true)}
              >
                <FontAwesomeIcon icon={faArrowsRotate} />
              </ActionIcon>
            </Tooltip>
          )}
          {showHistoryAction && (
            <Tooltip label={t('pages.server.files.tooltip.fileHistory', {})}>
              <ActionIcon
                size='md'
                variant='subtle'
                color='gray'
                aria-label={t('pages.server.files.tooltip.fileHistory', {})}
                disabled={loading}
                onClick={() => setRevisionsOpen(true)}
              >
                <FontAwesomeIcon icon={faClockRotateLeft} />
              </ActionIcon>
            </Tooltip>
          )}
          {canSave && (
            <Button
              size='compact-sm'
              loading={saving}
              disabled={!dirty && selection.action !== 'new'}
              leftSection={<FontAwesomeIcon icon={faFloppyDisk} />}
              onClick={() => void save()}
            >
              {t('common.button.save', {})}
            </Button>
          )}
          <Tooltip label={t('common.button.close', {})}>
            <ActionIcon
              variant='subtle'
              color='gray'
              aria-label={t('common.button.close', {})}
              onClick={() => onClose(paneId, tabId)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      <div ref={zoomRef} data-file-manager-editor-content className='flex min-h-0 w-full min-w-0 flex-1 flex-col'>
        {collab.active && collab.conflict && (
          <Alert
            color='yellow'
            m='sm'
            icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
            data-file-manager-collaboration-conflict
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
                {canUpdate && !collab.conflict.deleted && (
                  <Button size='xs' variant='default' onClick={() => setRevertConfirm(true)}>
                    <FontAwesomeIcon icon={faArrowsRotate} className='mr-2' />
                    {t('pages.server.files.button.loadDisk', {})}
                  </Button>
                )}
                {canUpdate && (
                  <Button
                    size='xs'
                    color='yellow'
                    loading={saving}
                    onClick={() => {
                      beginCollabSave(true);
                    }}
                  >
                    {t('pages.server.files.button.keepEditor', {})}
                  </Button>
                )}
              </Group>
            </Group>
          </Alert>
        )}

        {revisionComparison && (
          <FileTreeRevisionComparison
            key={`${revisionComparison.revisionId}:${revisionComparison.previousRevisionId ?? 'current'}`}
            {...revisionComparison}
            filePath={filePath}
            content={content}
            dirty={dirty}
            canSave={canSave && !loading}
            canRestore={contentWritable && !loading}
            onChange={updateContent}
            onSave={() => void save()}
            onBack={() => setRevisionComparison(null)}
            onRestore={restoreRevision}
          />
        )}
        <div className={`min-h-0 flex-1 ${revisionComparison ? 'hidden' : ''}`}>
          {loading ? (
            <div className='flex h-full items-center justify-center'>
              <Spinner size={48} />
            </div>
          ) : unavailableAction ? (
            <div className='p-4'>
              <Alert color='yellow'>{t('pages.server.files.tree.noEditorAvailable', {})}</Alert>
            </div>
          ) : selection.action === 'sqlite' ? (
            <div className='h-full overflow-auto p-3'>
              <FileSqliteQuery filePath={filePath} onMissing={() => onMissing(tabId)} />
            </div>
          ) : matchedAction?.contentType === 'string' ? (
            <matchedAction.content
              content={content}
              setContent={updateContent}
              dirty={dirty}
              setDirty={setDirty}
              readOnly={!contentWritable}
              context={editorContext}
            />
          ) : matchedAction?.contentType === 'blob' ? (
            <matchedAction.content
              content={blobContent}
              setContent={setBlobContent}
              dirty={dirty}
              setDirty={setDirty}
              readOnly={!contentWritable}
              context={editorContext}
            />
          ) : selection.action === 'image' && content ? (
            <FileImagePreview src={content} name={selection.file.name} />
          ) : selection.action === 'audio' && content ? (
            <FileAudioPreview src={content} />
          ) : editorEngine === 'pierre' ? (
            <PierreEditor
              key={filePath}
              height='100%'
              width='100%'
              path={modelPath}
              defaultValue={content}
              readOnly={!canEdit}
              wordWrap={editorLineOverflow}
              fontSize={editorFontSize}
              onChange={updateContent}
              onChangeEvent={collab.handlePierreChangeEvent}
              onSelectionChange={collab.handlePierreSelectionChange}
              onMount={(editor) => {
                pierreEditorRef.current = editor;
                focusEditorRef.current = () => editor.focus();
                collab.attachPierreEditor(editor);
              }}
            />
          ) : (
            <MonacoEditor
              key={filePath}
              height='100%'
              width='100%'
              path={modelPath}
              value={content}
              options={{
                readOnly: !canEdit,
                automaticLayout: true,
                stickyScroll: { enabled: false },
                minimap: { enabled: editorMinimap },
                wordWrap: editorLineOverflow ? 'on' : 'off',
                fontSize: editorFontSize,
                codeLens: false,
                scrollBeyondLastLine: false,
                smoothScrolling: false,
                fixedOverflowWidgets: true,
                dropIntoEditor: { enabled: false },
              }}
              onChange={(value) => updateContent(value ?? '')}
              onMount={(editor, monaco) => {
                focusEditorRef.current = () => editor.focus();
                collab.attachEditor(editor);
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
                registerTomlLanguage(monaco);
                registerHoconLanguage(monaco);
              }}
            />
          )}
        </div>
      </div>

      <FileEditorDraftModal
        pendingDraft={visible ? pendingDraft : null}
        onDiscard={() => {
          removeFileDraft(server.uuid, draftPath);
          setPendingDraft(null);
        }}
        onRestore={(value) => {
          if (!collabActiveRef.current) setRestoreOnConnect(value);
          replaceEditorContent(value, true);
          setPendingDraft(null);
        }}
      />

      <FileNameModal
        opened={nameModalOpen}
        onClose={() => setNameModalOpen(false)}
        onFileName={async (name) => {
          if (!canSave || saving) return;
          setSaving(true);
          await onCreateFile(tabId, name).finally(() => {
            if (mountedRef.current) setSaving(false);
          });
        }}
      />

      <FileEditorConflictDiffModal
        opened={conflictDiffOpen}
        onClose={() => setConflictDiffOpen(false)}
        conflictDiskContent={conflictDiskContent}
        conflictModifiedContent={conflictModifiedContent}
        fileName={selection.file.name}
        getEditorValue={() => contentRef.current}
        conflictModelsRef={conflictModelsRef}
        onKeepEditor={() => {
          setConflictDiffOpen(false);
          beginCollabSave(true);
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

      <FileRevisionsDrawer
        filePath={filePath}
        opened={revisionsOpen}
        onClose={() => setRevisionsOpen(false)}
        getContent={() => contentRef.current}
        onCompare={(revisionId, previousRevisionId) => setRevisionComparison({ revisionId, previousRevisionId })}
        onRestore={restoreRevision}
      />
    </div>
  );
}
