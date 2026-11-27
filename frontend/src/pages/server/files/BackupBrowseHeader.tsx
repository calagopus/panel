import {
  faArrowLeft,
  faCalendar,
  faChevronDown,
  faFile,
  faFileArrowDown,
  faHardDrive,
  faLock,
  faRotateLeft,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Group from '@/elements/layout/Group.tsx';
import ContextMenu from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Text from '@/elements/typography/Text.tsx';
import Title from '@/elements/typography/Title.tsx';
import { virtualRootOf } from '@/lib/files/virtualRoot.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import BackupRestoreModal from '@/pages/server/backups/modals/BackupRestoreModal.tsx';
import { useBackupDownload } from '@/pages/server/backups/useBackupDownload.ts';
import FileOperationsProgress from '@/pages/server/files/list/FileOperationsProgress.tsx';
import FileSettings from '@/pages/server/files/list/FileSettings.tsx';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

function BackupDetails({ backup }: { backup: z.infer<typeof serverBackupSchema> }) {
  const { tItem } = useTranslations();

  return (
    <Group gap='lg' c='dimmed'>
      <Text size='sm' className='flex items-center gap-1.5'>
        <FontAwesomeIcon icon={faCalendar} />
        <FormattedTimestamp timestamp={backup.created} />
      </Text>
      {backup.completed && (
        <>
          <Text size='sm' className='flex items-center gap-1.5'>
            <FontAwesomeIcon icon={faHardDrive} />
            {bytesToString(backup.bytes)}
          </Text>
          <Text size='sm' className='flex items-center gap-1.5'>
            <FontAwesomeIcon icon={faFile} />
            {tItem('file', backup.files)}
          </Text>
        </>
      )}
    </Group>
  );
}

function BackupActions({ backup }: { backup: z.infer<typeof serverBackupSchema> }) {
  const { t } = useTranslations();
  const download = useBackupDownload(backup);
  const canDownload = useServerCan('backups.download');
  const canRestore = useServerCan('backups.restore');
  const [restoring, setRestoring] = useState(false);

  if (!backup.completed || !backup.isSuccessful) return null;

  return (
    <>
      <BackupRestoreModal backup={backup} opened={restoring} onClose={() => setRestoring(false)} />

      {canDownload &&
        (download.streaming ? (
          <ContextMenu items={download.formatItems}>
            {({ openMenu }) => (
              <Button
                variant='default'
                leftSection={<FontAwesomeIcon icon={faFileArrowDown} />}
                rightSection={<FontAwesomeIcon icon={faChevronDown} />}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openMenu(rect.left, rect.bottom);
                }}
              >
                {t('common.button.download', {})}
              </Button>
            )}
          </ContextMenu>
        ) : (
          <Button
            variant='default'
            leftSection={<FontAwesomeIcon icon={faFileArrowDown} />}
            onClick={() => download.doDownload('tar_gz')}
          >
            {t('common.button.download', {})}
          </Button>
        ))}

      {canRestore && (
        <Button leftSection={<FontAwesomeIcon icon={faRotateLeft} />} onClick={() => setRestoring(true)}>
          {t('common.button.restore', {})}
        </Button>
      )}
    </>
  );
}

export default function BackupBrowseHeader({ showTitle }: { showTitle: boolean }) {
  const { t } = useTranslations();
  const navigate = useNavigate();
  const server = useServerStore((state) => state.server);
  const canReadBackups = useServerCan('backups.read');
  const browsingBackup = useFileManagerStore((state) => state.browsingBackup);
  const browsingDirectory = useFileManagerStore((state) => state.browsingDirectory);

  const backupUuid = virtualRootOf(browsingDirectory)?.uuid;

  return (
    <Group justify='space-between' align='center' mb='md'>
      <div className='min-w-0'>
        <Group gap='md' wrap='nowrap'>
          {showTitle && (
            <Title order={1} className='truncate'>
              {browsingBackup?.name ?? backupUuid}
            </Title>
          )}
          <Badge size='lg' color='gray' variant='light' className='shrink-0'>
            {t('common.readOnly', {})}
          </Badge>
          {browsingBackup?.isLocked && (
            <Badge
              size='lg'
              color='green'
              variant='light'
              className='shrink-0'
              leftSection={<FontAwesomeIcon icon={faLock} />}
            >
              {t('common.form.locked', {})}
            </Badge>
          )}
          <FileSettings />
        </Group>
        {browsingBackup && (
          <div className='mt-1'>
            <BackupDetails backup={browsingBackup} />
          </div>
        )}
      </div>

      <Group>
        <FileOperationsProgress />
        <Button
          variant='default'
          leftSection={<FontAwesomeIcon icon={faArrowLeft} />}
          onClick={() => navigate(`/server/${server.uuidShort}/${canReadBackups ? 'backups' : 'files'}`)}
        >
          {canReadBackups
            ? t('pages.server.files.button.backToBackups', {})
            : t('pages.server.files.button.exitBackup', {})}
        </Button>
        {browsingBackup && <BackupActions backup={browsingBackup} />}
      </Group>
    </Group>
  );
}
