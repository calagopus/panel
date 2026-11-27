import {
  faArrowLeft,
  faArrowUp,
  faBoxArchive,
  faFolderClosed,
  faHouse,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { join, relative } from 'pathe';
import { createSearchParams, useNavigate } from 'react-router';
import Button from '@/elements/buttons/Button.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Group from '@/elements/layout/Group.tsx';
import Paper from '@/elements/layout/Paper.tsx';
import { isVirtualRoot, virtualRootOf } from '@/lib/files/virtualRoot.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

export default function FileBrowserError() {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const server = useServerStore((state) => state.server);
  const canReadBackups = useServerCan('backups.read');
  const browsingError = useFileManagerStore((state) => state.browsingError);
  const browsingErrorStatus = useFileManagerStore((state) => state.browsingErrorStatus);
  const browsingDirectory = useFileManagerStore((state) => state.browsingDirectory);
  const searchInfo = useFileManagerStore((state) => state.searchInfo);
  const isLoading = useFileManagerStore((state) => state.isLoading);
  const invalidateFilemanager = useFileManagerStore((state) => state.invalidateFilemanager);

  if (!browsingError) return null;

  if (browsingErrorStatus !== 404 || searchInfo) {
    return (
      <Paper withBorder radius='md'>
        <ErrorState error={browsingError} onRetry={() => invalidateFilemanager()} retrying={isLoading} />
      </Paper>
    );
  }

  const directory = join('/', browsingDirectory);
  const virtualRoot = virtualRootOf(directory);
  const filesUrl = `/server/${server.uuidShort}/files`;
  const openDirectory = (target: string) => navigate(`${filesUrl}?${createSearchParams({ directory: target })}`);

  if (virtualRoot?.type === 'backup' && isVirtualRoot(directory)) {
    return (
      <EmptyState
        icon={faBoxArchive}
        title={t('pages.server.files.backupUnavailable.title', {})}
        description={t('pages.server.files.backupUnavailable.description', {})}
      >
        <Button
          variant='default'
          leftSection={<FontAwesomeIcon icon={faArrowLeft} />}
          onClick={() => navigate(canReadBackups ? `/server/${server.uuidShort}/backups` : filesUrl)}
        >
          {canReadBackups
            ? t('pages.server.files.button.backToBackups', {})
            : t('pages.server.files.button.backToFiles', {})}
        </Button>
      </EmptyState>
    );
  }

  if (virtualRoot?.type === 'trash' && isVirtualRoot(directory)) {
    return (
      <EmptyState
        icon={faTrashCan}
        title={t('pages.server.files.trashEntryUnavailable.title', {})}
        description={t('pages.server.files.trashEntryUnavailable.description', {})}
      >
        <Button
          variant='default'
          leftSection={<FontAwesomeIcon icon={faArrowLeft} />}
          onClick={() => navigate(`${filesUrl}/trash`)}
        >
          {t('pages.server.files.button.backToTrash', {})}
        </Button>
      </EmptyState>
    );
  }

  const rootDirectory = virtualRoot?.directory ?? '/';
  const parentDirectory = join(directory, '..');

  return (
    <EmptyState
      icon={faFolderClosed}
      title={t('pages.server.files.missing.title', {})}
      description={t('pages.server.files.missing.description', {
        directory: join('/', relative(rootDirectory, directory)),
      }).md()}
    >
      <Group justify='center'>
        {parentDirectory !== rootDirectory && (
          <Button
            variant='default'
            leftSection={<FontAwesomeIcon icon={faArrowUp} />}
            onClick={() => openDirectory(parentDirectory)}
          >
            {t('pages.server.files.button.parentDirectory', {})}
          </Button>
        )}
        <Button
          variant='default'
          leftSection={<FontAwesomeIcon icon={faHouse} />}
          onClick={() => openDirectory(rootDirectory)}
        >
          {t('pages.server.files.button.goToRoot', {})}
        </Button>
      </Group>
    </EmptyState>
  );
}
