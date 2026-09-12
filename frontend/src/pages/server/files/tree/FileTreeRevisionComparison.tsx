import { faArrowLeft, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { basename } from 'pathe';
import { useEffect, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileRevisionContent from '@/api/server/files/getFileRevisionContent.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import FileRevisionDiffEditor from '@/pages/server/files/editor/FileRevisionDiffEditor.tsx';
import { useFileManager } from '@/providers/FileManagerProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export interface FileRevisionComparison {
  revisionId: number;
  previousRevisionId?: number;
}

interface Props extends FileRevisionComparison {
  filePath: string;
  content: string;
  dirty: boolean;
  canSave: boolean;
  canRestore: boolean;
  onChange: (content: string) => void;
  onSave: () => void;
  onBack: () => void;
  onRestore: (content: string) => void;
}

export default function FileTreeRevisionComparison({
  filePath,
  revisionId,
  previousRevisionId,
  content,
  dirty,
  canSave,
  canRestore,
  onChange,
  onSave,
  onBack,
  onRestore,
}: Props) {
  const { t } = useTranslations();
  const engine = useFileManager((state) => state.editorEngine);
  const serverUuid = useServerStore((state) => state.server.uuid);
  const [revisions, setRevisions] = useState<{ original: string; modified?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRevisions(null);
    setError(null);
    Promise.all([
      getFileRevisionContent(serverUuid, previousRevisionId ?? revisionId, filePath),
      previousRevisionId === undefined
        ? Promise.resolve(undefined)
        : getFileRevisionContent(serverUuid, revisionId, filePath),
    ])
      .then(([original, modified]) => {
        if (!cancelled) setRevisions({ original, modified });
      })
      .catch((err) => {
        if (!cancelled) setError(httpErrorToHuman(err));
      });
    return () => {
      cancelled = true;
    };
  }, [serverUuid, filePath, revisionId, previousRevisionId]);

  const title =
    previousRevisionId === undefined
      ? t('pages.server.files.titleDiffRevisionVsCurrent', { file: basename(filePath), revision: String(revisionId) })
      : t('pages.server.files.titleDiffRevisionVsRevision', {
          file: basename(filePath),
          revision: String(revisionId),
          previousRevision: String(previousRevisionId),
        });

  return (
    <div data-file-manager-revision-comparison className='flex min-h-0 flex-1 flex-col'>
      <ConfirmationModal
        title={t('pages.server.files.modal.unsavedChanges.title', {})}
        opened={restoreConfirm}
        onClose={() => setRestoreConfirm(false)}
        onConfirmed={() => {
          if (revisions) onRestore(revisions.original);
        }}
        confirm={t('common.button.restore', {})}
      >
        {t('pages.server.files.modal.unsavedChanges.content', {}).md()}
      </ConfirmationModal>
      <div className='flex shrink-0 flex-wrap items-center gap-2 border-b border-(--mantine-color-default-border) px-3 py-2'>
        <ActionIcon variant='subtle' color='gray' aria-label={t('common.button.back', {})} onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </ActionIcon>
        <span className='min-w-0 flex-1 text-sm'>{title}</span>
        {previousRevisionId === undefined && canRestore && (
          <Button
            size='compact-sm'
            variant='outline'
            disabled={!revisions}
            leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
            onClick={() => {
              if (revisions) dirty ? setRestoreConfirm(true) : onRestore(revisions.original);
            }}
          >
            {t('pages.server.files.drawer.revisions.tooltip.restore', {})}
          </Button>
        )}
        {previousRevisionId === undefined && engine === 'pierre' && (
          <Button size='compact-sm' onClick={onBack}>
            {t('pages.server.files.button.openInEditor', {})}
          </Button>
        )}
      </div>
      <div className='min-h-0 flex-1'>
        {error ? (
          <Alert color='red' m='sm'>
            {error}
          </Alert>
        ) : !revisions ? (
          <div className='flex h-full items-center justify-center'>
            <Spinner />
          </div>
        ) : (
          <FileRevisionDiffEditor
            original={revisions.original}
            modified={revisions.modified ?? content}
            filePath={filePath}
            revisionId={revisionId}
            previousRevisionId={previousRevisionId}
            readOnly={!canSave}
            onChange={onChange}
            onSave={onSave}
          />
        )}
      </div>
    </div>
  );
}
