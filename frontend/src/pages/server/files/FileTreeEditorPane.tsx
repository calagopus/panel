import {
  faArrowsRotate,
  faClockRotateLeft,
  faFileCode,
  faFloppyDisk,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AvatarGroup } from '@mantine/core';
import { AxiosError } from 'axios';
import { join } from 'pathe';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Alert from '@/elements/Alert.tsx';
import Avatar from '@/elements/Avatar.tsx';
import Button from '@/elements/Button.tsx';
import Card from '@/elements/Card.tsx';
import Group from '@/elements/Group.tsx';
import MonacoEditor from '@/elements/MonacoEditor.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import PierreEditor, { type PierreEditorHandle } from '@/elements/PierreEditor.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Text from '@/elements/Text.tsx';
import Title from '@/elements/Title.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { registerHoconLanguage, registerTomlLanguage } from '@/lib/monaco.ts';
import FileRevisionsDrawer from '@/pages/server/files/drawers/FileRevisionsDrawer.tsx';
import FileEditorSettings from '@/pages/server/files/FileEditorSettings.tsx';
import FileImageViewerSettings from '@/pages/server/files/FileImageViewerSettings.tsx';
import { FileAudioPreview, FileImagePreview } from '@/pages/server/files/FileMediaPreview.tsx';
import FileSqliteQuery from '@/pages/server/files/FileSqliteQuery.tsx';
import FileTreeEditorTabs from '@/pages/server/files/FileTreeEditorTabs.tsx';
import { FileTreeEditorSelection } from '@/pages/server/files/fileTreeEditor.ts';
import useFileCollab from '@/pages/server/files/hooks/useFileCollab.ts';
import { findFileEditorAction } from '@/pages/server/files/useFileEditorPresentation.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

interface FileTreeEditorPaneProps {
  paneId: string;
  paneIndex: number;
  paneCount: number;
  active: boolean;
  tabs: FileTreeEditorSelection[];
  activeTabId: string | null;
  dirtyTabIds: ReadonlySet<string>;
  selection: FileTreeEditorSelection | null;
  draftContent?: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onClose: () => void;
  onMissing: (tabId: string) => void;
  onDirtyChange: (tabId: string, dirty: boolean) => void;
  onDraftChange: (tabId: string, content: string | null) => void;
}

export default function FileTreeEditorPane({
  paneId,
  paneIndex,
  paneCount,
  active,
  tabs,
  activeTabId,
  dirtyTabIds,
  selection,
  draftContent,
  onSelectTab,
  onCloseTab,
  onClose,
  onMissing,
  onDirtyChange,
  onDraftChange,
}: FileTreeEditorPaneProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(draftContent !== undefined);
  const [revertConfirm, setRevertConfirm] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [blobContent, setBlobContent] = useState(new Blob());
  const contentRef = useRef('');
  const savedContentRef = useRef('');
  const initialDraftContentRef = useRef(draftContent);
  const pierreEditorRef = useRef<PierreEditorHandle | null>(null);
  const saveRef = useRef<() => void>(() => undefined);
  const onMissingRef = useRef(onMissing);
  const collabActiveRef = useRef(false);
  const collabSavingRef = useRef(false);
  const collabSaveTimerRef = useRef<number | null>(null);
  onMissingRef.current = onMissing;

  const filePath = selection ? join(selection.directory, selection.file.name) : '';
  const editorContext = selection
    ? {
        surface: 'inline' as const,
        directory: selection.directory,
        file: selection.file.name,
        path: filePath,
        params: selection.params,
        workspace: { paneId, paneIndex, paneCount, active },
      }
    : undefined;
  const matchedAction = findFileEditorAction(selection?.action);
  const editableText = selection?.action === 'edit' || matchedAction?.contentType === 'string';
  const reportFileError = (error: unknown) => {
    if (error instanceof AxiosError && error.response?.status === 404) {
      if (activeTabId) onMissingRef.current(activeTabId);
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
  const collab = useFileCollab({
    enabled: selection?.action === 'edit' && selection.primary && !loading,
    engine: editorEngine,
    filePath,
    onActivated: (serverDirty) => {
      collabActiveRef.current = true;
      if (!serverDirty) savedContentRef.current = contentRef.current;
      setDirty(serverDirty);
      if (activeTabId) onDraftChange(activeTabId, serverDirty ? contentRef.current : null);
    },
    onSaved: () => {
      savedContentRef.current = contentRef.current;
      setDirty(false);
      if (activeTabId) onDraftChange(activeTabId, null);

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
  const canSave = !!selection && editableText && selection.writable && (collab.active ? canUpdate : canCreate);

  useEffect(() => {
    collabActiveRef.current = collab.active;
  }, [collab.active]);

  useEffect(() => {
    if (activeTabId) onDirtyChange(activeTabId, dirty);
  }, [activeTabId, dirty, onDirtyChange]);

  useEffect(() => {
    const resetContent = (nextDirty: boolean) => {
      setDirty(nextDirty);
      contentRef.current = '';
      setContent('');
      setBlobContent(new Blob());
    };

    if (!selection || selection.action === 'sqlite') {
      resetContent(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let nextMediaUrl: string | null = null;
    resetContent(initialDraftContentRef.current !== undefined);
    setLoading(true);

    getFileContent(server.uuid, filePath)
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
          savedContentRef.current = loaded;
          contentRef.current = restoredContent;
          setContent(restoredContent);
          setDirty(restoredContent !== loaded);
        }
      })
      .catch((error) => {
        if (!cancelled) reportFileError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (nextMediaUrl) URL.revokeObjectURL(nextMediaUrl);
    };
  }, [server.uuid, filePath, selection?.action, matchedAction?.contentType, addToast, activeTabId]);

  useEffect(
    () => () => {
      if (collabSaveTimerRef.current) window.clearTimeout(collabSaveTimerRef.current);
    },
    [],
  );

  const updateContent = (value: string) => {
    const changed = collabActiveRef.current ? true : value !== savedContentRef.current;
    contentRef.current = value;
    setContent(value);
    setDirty(changed);
    if (activeTabId) onDraftChange(activeTabId, changed ? value : null);
  };

  const replaceEditorContent = (value: string, changed: boolean) => {
    contentRef.current = value;
    setContent(value);
    pierreEditorRef.current?.setValue(value);
    setDirty(changed);
    if (activeTabId) onDraftChange(activeTabId, changed ? value : null);
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
    if (!canSave) return;

    if (collabActiveRef.current && beginCollabSave()) return;

    setSaving(true);
    try {
      await saveFileContent(server.uuid, filePath, contentRef.current);
      savedContentRef.current = contentRef.current;
      setDirty(false);
      if (activeTabId) onDraftChange(activeTabId, null);
      addToast(t('pages.server.files.toast.fileSaved', {}), 'success');
    } catch (error) {
      reportFileError(error);
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = () => void save();

  const revertToDisk = async () => {
    if (!selection) return;
    if (collabActiveRef.current && collab.reload()) return;

    setLoading(true);
    try {
      const loaded = await getFileContent(server.uuid, filePath).then((blob) => blob.text());
      savedContentRef.current = loaded;
      replaceEditorContent(loaded, false);
    } catch (error) {
      reportFileError(error);
    } finally {
      setLoading(false);
    }
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

  const editorTabs = (
    <FileTreeEditorTabs
      paneId={paneId}
      tabs={tabs}
      activeTabId={activeTabId}
      dirtyTabIds={dirtyTabIds}
      onSelect={onSelectTab}
      onClose={onCloseTab}
    />
  );

  if (!selection) {
    return (
      <Card p={0} data-file-manager-editor className='flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden'>
        {editorTabs}
        <div data-file-manager-editor-empty className='flex min-h-0 flex-1 items-center justify-center'>
          <div className='flex max-w-sm flex-col items-center gap-3 text-center text-(--mantine-color-dimmed)'>
            <FontAwesomeIcon icon={faFileCode} size='2x' />
            <Text>{t('pages.server.files.tree.selectFileToOpen', {})}</Text>
          </div>
        </div>
      </Card>
    );
  }

  const title = matchedAction ? matchedAction.title(selection.file.name) : selection.file.name;
  const unknownAction = !matchedAction && !['edit', 'image', 'audio', 'sqlite'].includes(selection.action);
  const unavailableAction = unknownAction || (selection.action === 'sqlite' && !canQuerySqlite);
  const showRevertAction =
    (collab.active ? canUpdate : canReadContent) &&
    dirty &&
    selection.action === 'edit' &&
    selection.writable &&
    !collab.conflict?.deleted;
  const showHistoryAction = canReadContent && selection.action === 'edit' && selection.primary;

  return (
    <Card p={0} data-file-manager-editor className='flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden'>
      {editorTabs}

      <div
        data-file-manager-editor-header
        className='flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-(--mantine-color-default-border) px-3'
      >
        <Group wrap='nowrap' gap='xs' className='min-w-0'>
          <Title order={3} className='truncate! text-base!'>
            {title}
          </Title>
          {matchedAction?.header.settings ? (
            <matchedAction.header.settings />
          ) : selection.action === 'edit' ? (
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
              <ActionIcon size='md' variant='subtle' color='gray' onClick={() => setRevertConfirm(true)}>
                <FontAwesomeIcon icon={faArrowsRotate} />
              </ActionIcon>
            </Tooltip>
          )}
          {showHistoryAction && (
            <Tooltip label={t('pages.server.files.tooltip.fileHistory', {})}>
              <ActionIcon size='md' variant='subtle' color='gray' onClick={() => setRevisionsOpen(true)}>
                <FontAwesomeIcon icon={faClockRotateLeft} />
              </ActionIcon>
            </Tooltip>
          )}
          {canSave && (
            <Button
              size='compact-sm'
              loading={saving}
              disabled={!dirty}
              leftSection={<FontAwesomeIcon icon={faFloppyDisk} />}
              onClick={() => void save()}
            >
              {t('common.button.save', {})}
            </Button>
          )}
          <Tooltip label={t('common.button.close', {})}>
            <ActionIcon variant='subtle' color='gray' onClick={onClose}>
              <FontAwesomeIcon icon={faXmark} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      <div data-file-manager-editor-content className='flex min-h-0 w-full min-w-0 flex-1 flex-col'>
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
                  <Button
                    size='xs'
                    variant='default'
                    onClick={() => {
                      collab.reload();
                    }}
                  >
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

        <div className='min-h-0 flex-1'>
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
              <FileSqliteQuery filePath={filePath} onMissing={() => activeTabId && onMissing(activeTabId)} />
            </div>
          ) : matchedAction?.contentType === 'string' ? (
            <matchedAction.content
              content={content}
              setContent={updateContent}
              dirty={dirty}
              setDirty={setDirty}
              context={editorContext}
            />
          ) : matchedAction?.contentType === 'blob' ? (
            <matchedAction.content
              content={blobContent}
              setContent={setBlobContent}
              dirty={dirty}
              setDirty={setDirty}
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
              path={selection.file.name}
              defaultValue={content}
              readOnly={!canSave}
              wordWrap={editorLineOverflow}
              fontSize={editorFontSize}
              onChange={updateContent}
              onChangeEvent={collab.handlePierreChangeEvent}
              onMount={(editor) => {
                pierreEditorRef.current = editor;
                collab.attachPierreEditor(editor);
              }}
            />
          ) : (
            <MonacoEditor
              key={filePath}
              height='100%'
              width='100%'
              path={selection.file.name}
              value={content}
              options={{
                readOnly: !canSave,
                automaticLayout: true,
                stickyScroll: { enabled: false },
                minimap: { enabled: editorMinimap },
                wordWrap: editorLineOverflow ? 'on' : 'off',
                fontSize: editorFontSize,
                codeLens: false,
                scrollBeyondLastLine: false,
                smoothScrolling: false,
                fixedOverflowWidgets: true,
              }}
              onChange={(value) => updateContent(value ?? '')}
              onMount={(editor, monaco) => {
                collab.attachEditor(editor);
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
                registerTomlLanguage(monaco);
                registerHoconLanguage(monaco);
              }}
            />
          )}
        </div>
      </div>

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
        onRestore={(nextContent) => replaceEditorContent(nextContent, true)}
      />
    </Card>
  );
}
