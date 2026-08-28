import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Alert from '@/elements/Alert.tsx';
import Button from '@/elements/Button.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileEditorDraftModalProps {
  pendingDraft: { content: string; hashMismatch: boolean } | null;
  onDiscard: () => void;
  onRestore: (content: string) => void;
}

export default function FileEditorDraftModal({ pendingDraft, onDiscard, onRestore }: FileEditorDraftModalProps) {
  const { t } = useTranslations();

  return (
    <Modal
      title={t('pages.server.files.modal.draftRestore.title', {})}
      opened={pendingDraft !== null}
      onClose={onDiscard}
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
              onRestore(pendingDraft.content);
            }
          }}
        >
          {t('common.button.restore', {})}
        </Button>
        <Button variant='default' onClick={onDiscard}>
          {t('common.button.discard', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
