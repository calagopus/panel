import { faArrowLeft, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { editor } from 'monaco-editor';
import { basename, dirname } from 'pathe';
import { useEffect, useRef, useState } from 'react';
import { createSearchParams, useLocation, useNavigate, useSearchParams } from 'react-router';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import getFileRevisionContent from '@/api/server/files/getFileRevisionContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Group from '@/elements/layout/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Title from '@/elements/typography/Title.tsx';
import { readFileDraft, removeFileDraft } from '@/lib/files/fileDrafts.ts';
import FileRevisionDiffEditor from '@/pages/server/files/editor/FileRevisionDiffEditor.tsx';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useContainerAutoHeight } from '@/plugins/viewport/useContainerAutoHeight.ts';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';
import { FileManagerProvider, useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import useFileDraft from '../hooks/useFileDraft.ts';
import useFileDraftPersistence from '../hooks/useFileDraftPersistence.ts';
import FileEditorDraftModal from '../modals/FileEditorDraftModal.tsx';

function FileRevisionDiffComponent() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const { setSavedContent, persistDraft } = useFileDraft(server.uuid);
  const { getParent } = useCurrentWindow();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const editorEngine = useFileManager((state) => state.editorEngine);

  const filePath = searchParams.get('file') || '';
  const revisionId = parseInt(searchParams.get('revision') || '0', 10);
  const previousRevisionId = parseInt(searchParams.get('previousRevision') || '0', 10) || undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalContent, setOriginalContent] = useState('');
  const [modifiedContent, setModifiedContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{ content: string; hashMismatch: boolean } | null>(null);
  const modifiedRef = useRef('');
  const mountedRef = useRef(true);
  const handoffTargetRef = useRef<string | null>(null);
  const canCreate = useServerCan('files.create');
  const canSave = !previousRevisionId && canCreate && editorEngine === 'monaco';
  const blocker = useBlocker(
    dirty,
    false,
    (tx) =>
      !(tx.location.pathname === location.pathname && tx.location.search === location.search) &&
      handoffTargetRef.current !== tx.location.pathname + tx.location.search,
  );
  useFileDraftPersistence(server.uuid, filePath, dirty);

  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    if (typeof location.state?.currentContent === 'string') {
      navigate(location.pathname + location.search, {
        replace: true,
        state: { ...location.state, currentContent: undefined },
      });
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!filePath || !revisionId) return;

    const passedContent: string | undefined = (location.state as { currentContent?: string } | null)?.currentContent;
    let cancelled = false;

    const fetches: [Promise<string>, Promise<string>] = previousRevisionId
      ? [
          getFileRevisionContent(server.uuid, previousRevisionId, filePath),
          getFileRevisionContent(server.uuid, revisionId, filePath),
        ]
      : [
          getFileRevisionContent(server.uuid, revisionId, filePath),
          getFileContent(server.uuid, filePath).then((blob) => blob.text()),
        ];

    Promise.all(fetches)
      .then(([original, modified]) => {
        if (cancelled) return;
        const initial = !previousRevisionId && passedContent !== undefined ? passedContent : modified;
        setOriginalContent(original);
        const hash = setSavedContent(modified);
        modifiedRef.current = initial;
        setModifiedContent(initial);
        setDirty(initial !== modified);
        if (initial !== modified) persistDraft(filePath, initial);
        if (!previousRevisionId && passedContent === undefined) {
          const draft = readFileDraft(server.uuid, filePath);
          if (draft && draft.content !== modified)
            setPendingDraft({ content: draft.content, hashMismatch: draft.originalHash !== hash });
        }
      })
      .catch((err) => {
        if (!cancelled) addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filePath, revisionId, previousRevisionId]);

  useContainerAutoHeight({
    containerRef: editorContainerRef,
    loading,
    getParent,
    layout: () => diffEditorRef.current?.layout(),
    deps: [loading, getParent],
  });

  const updateContent = (value: string) => {
    modifiedRef.current = value;
    setModifiedContent(value);
    const changed = persistDraft(filePath, value, { preserve: pendingDraft !== null });
    setDirty(changed);
  };

  const handleSave = () => {
    if (!canSave || saving || loading) return;
    const content = modifiedRef.current;
    setSaving(true);
    saveFileContent(server.uuid, filePath, content)
      .then(() => {
        if (!mountedRef.current) return;
        setSavedContent(content);
        updateContent(modifiedRef.current);
        addToast(t('pages.server.files.toast.fileSaved', {}), 'success');
      })
      .catch((err) => {
        if (mountedRef.current) addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => {
        if (mountedRef.current) setSaving(false);
      });
  };

  const editorUrl = `/server/${server.uuidShort}/files/edit?${createSearchParams({ directory: dirname(filePath), file: basename(filePath) })}`;
  const openInEditor = (content: string) => {
    handoffTargetRef.current = editorUrl;
    navigate(editorUrl, { state: { editorContent: content } });
  };

  const title = previousRevisionId
    ? t('pages.server.files.titleDiffRevisionVsRevision', {
        file: basename(filePath),
        revision: String(revisionId),
        previousRevision: String(previousRevisionId),
      })
    : t('pages.server.files.titleDiffRevisionVsCurrent', {
        file: basename(filePath),
        revision: String(revisionId),
      });

  return (
    <ServerContentContainer hideTitleComponent fullscreen title={title}>
      <ConfirmationModal
        title={t('pages.server.files.modal.unsavedChanges.title', {})}
        opened={blocker.state === 'blocked'}
        onClose={blocker.reset}
        onConfirmed={blocker.proceed}
        confirm={t('common.button.leavePage', {})}
      >
        {t('pages.server.files.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>
      <ConfirmationModal
        title={t('pages.server.files.modal.unsavedChanges.title', {})}
        opened={restoreConfirm}
        onClose={() => setRestoreConfirm(false)}
        onConfirmed={() => {
          setRestoreConfirm(false);
          openInEditor(originalContent);
        }}
        confirm={t('common.button.restore', {})}
      >
        {t('pages.server.files.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>
      <FileEditorDraftModal
        pendingDraft={pendingDraft}
        onDiscard={() => {
          removeFileDraft(server.uuid, filePath);
          setPendingDraft(null);
        }}
        onRestore={(value) => {
          updateContent(value);
          setPendingDraft(null);
        }}
      />
      <div className='flex flex-wrap justify-between items-center gap-2 lg:pt-6 px-4 lg:px-6 lg:pb-0'>
        <Group>
          <ActionIcon
            variant='subtle'
            color='gray'
            aria-label={t('common.button.back', {})}
            onClick={() => {
              const backTo = (location.state as { backTo?: string } | null)?.backTo;
              if (backTo) {
                navigate(backTo);
                return;
              }

              navigate(editorUrl, { state: { openRevisions: true } });
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </ActionIcon>
          <Title>{title}</Title>
        </Group>
        {!previousRevisionId && (
          <ServerCan action='files.create'>
            <Group>
              <Button
                loading={saving}
                variant='outline'
                leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
                disabled={loading}
                onClick={() => (dirty ? setRestoreConfirm(true) : openInEditor(originalContent))}
              >
                {t('pages.server.files.drawer.revisions.tooltip.restore', {})}
              </Button>
              {editorEngine === 'pierre' ? (
                <Button disabled={loading} onClick={() => openInEditor(modifiedRef.current)}>
                  {t('pages.server.files.button.openInEditor', {})}
                </Button>
              ) : (
                <Button loading={saving} disabled={loading || !dirty} onClick={handleSave}>
                  {t('common.button.save', {})}
                </Button>
              )}
            </Group>
          </ServerCan>
        )}
      </div>

      {loading ? (
        <div className='w-full h-screen flex items-center justify-center'>
          <Spinner size={75} />
        </div>
      ) : (
        <div className='flex flex-col relative mt-4'>
          <div className='relative'>
            <div ref={editorContainerRef} className='flex max-w-full w-full z-1 absolute'>
              <FileRevisionDiffEditor
                original={originalContent}
                modified={modifiedContent}
                filePath={filePath}
                revisionId={revisionId}
                previousRevisionId={previousRevisionId}
                readOnly={!canSave}
                onChange={updateContent}
                onSave={handleSave}
                onMount={(diffEditor) => {
                  diffEditorRef.current = diffEditor;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </ServerContentContainer>
  );
}

export default function FileRevisionDiff() {
  const [searchParams] = useSearchParams();
  const serverUuid = useServerStore((state) => state.server.uuid);
  return (
    <FileManagerProvider key={`${serverUuid}:${searchParams}`}>
      <FileRevisionDiffComponent />
    </FileManagerProvider>
  );
}
