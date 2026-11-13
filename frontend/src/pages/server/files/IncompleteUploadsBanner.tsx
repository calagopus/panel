import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import Group from '@/elements/layout/Group.tsx';
import { safeSessionStorageGet, safeSessionStorageSet } from '@/lib/safeStorage.ts';
import useHasIncompleteUploads from '@/pages/server/files/hooks/useHasIncompleteUploads.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerStore } from '@/stores/fileManager.ts';

const dismissedStorageKey = (serverUuid: string) => `file_manager_incomplete_uploads_dismissed:${serverUuid}`;

export default function IncompleteUploadsBanner() {
  const { t } = useTranslations();
  const serverUuid = useFileManagerStore((state) => state.externals.serverUuid);
  const doOpenModal = useFileManagerStore((state) => state.doOpenModal);
  const hasIncompleteUploads = useHasIncompleteUploads();
  const [dismissed, setDismissed] = useState(() => safeSessionStorageGet(dismissedStorageKey(serverUuid)) === 'true');

  useEffect(() => setDismissed(safeSessionStorageGet(dismissedStorageKey(serverUuid)) === 'true'), [serverUuid]);

  if (!hasIncompleteUploads || dismissed) return null;

  const handleDismiss = () => {
    safeSessionStorageSet(dismissedStorageKey(serverUuid), 'true');
    setDismissed(true);
  };

  return (
    <Alert
      icon={<FontAwesomeIcon icon={faTriangleExclamation} />}
      color='yellow'
      title={t('pages.server.files.upload.banner.title', {})}
      onClose={handleDismiss}
      withCloseButton
      mb='md'
    >
      <Group gap='xs'>
        <span>{t('pages.server.files.upload.banner.content', {})}</span>
        <Button variant='subtle' color='yellow' size='compact-sm' onClick={() => doOpenModal('incompleteUploads')}>
          {t('pages.server.files.upload.banner.review', {})}
        </Button>
      </Group>
    </Alert>
  );
}
