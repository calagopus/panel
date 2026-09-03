import { faPause, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { canResumeInSession, pauseUpload, resumeUpload } from '@/lib/files/uploadManager.ts';
import { bytesProgressString } from '@/lib/format/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { UploadItem } from '@/stores/uploads.ts';

export default function UploadFileRow({
  fileKey,
  file,
  isRateLimited,
  onCancel,
  onReselect,
}: {
  fileKey: string;
  file: UploadItem;
  isRateLimited: boolean;
  onCancel: () => void;
  onReselect: () => void;
}) {
  const { t } = useTranslations();

  if (file.status === 'paused') {
    const inSession = canResumeInSession(fileKey);

    return (
      <div className='flex flex-row items-center mb-2'>
        <div className='flex flex-col grow'>
          <div className='flex items-center gap-2 mb-1'>
            <Badge variant='light' color='yellow' size='sm'>
              {t('elements.fileUpload.badge.paused', {})}
            </Badge>
            <span className='break-all text-sm'>{file.filePath}</span>
          </div>
          {inSession ? (
            <Tooltip label={bytesProgressString(file.uploaded, file.size)} innerClassName='w-full'>
              <Progress value={file.progress} color='gray' />
            </Tooltip>
          ) : (
            <Button
              size='compact-xs'
              variant='light'
              leftSection={<FontAwesomeIcon icon={faPlay} size='sm' />}
              onClick={onReselect}
            >
              {t('elements.fileUpload.reselect', {})}
            </Button>
          )}
        </div>
        <div className='flex items-center gap-1 ml-3'>
          {inSession && (
            <Tooltip label={t('elements.fileUpload.resume', {})}>
              <ActionIcon variant='light' onClick={() => resumeUpload(fileKey)}>
                <FontAwesomeIcon icon={faPlay} size='sm' />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label={t('elements.fileUpload.cancel', {})}>
            <ActionIcon variant='light' color='red' onClick={onCancel}>
              <FontAwesomeIcon icon={faXmark} size='sm' />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
    );
  }

  const canPause = file.resumable && file.status === 'uploading';

  return (
    <div className='flex flex-row items-center mb-2'>
      <div className='flex flex-col grow'>
        <div className='flex items-center gap-2 mb-1'>
          <Badge
            variant='light'
            size='sm'
            color={
              file.status === 'error' ? 'red' : file.status === 'pending' ? 'gray' : isRateLimited ? 'orange' : 'blue'
            }
          >
            {file.status === 'error'
              ? t('common.badge.failed', {})
              : file.status === 'pending'
                ? t('elements.fileUpload.badge.waiting', {})
                : t('elements.fileUpload.badge.uploading', {})}
          </Badge>
          <span className='break-all text-sm'>{file.filePath}</span>
        </div>
        <Tooltip label={bytesProgressString(file.uploaded, file.size)} innerClassName='w-full'>
          <Progress
            value={file.progress}
            color={file.status === 'error' ? 'red' : isRateLimited ? 'orange' : undefined}
          />
        </Tooltip>
      </div>
      <div className='flex items-center gap-1 ml-3'>
        {canPause && (
          <Tooltip label={t('elements.fileUpload.pause', {})}>
            <ActionIcon variant='light' onClick={() => pauseUpload(fileKey)}>
              <FontAwesomeIcon icon={faPause} size='sm' />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={t('elements.fileUpload.cancel', {})}>
          <ActionIcon variant='light' color='red' onClick={onCancel}>
            <FontAwesomeIcon icon={faXmark} size='sm' />
          </ActionIcon>
        </Tooltip>
      </div>
    </div>
  );
}
