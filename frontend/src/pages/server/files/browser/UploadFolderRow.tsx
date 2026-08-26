import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Progress from '@/elements/Progress.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { bytesProgressString } from '@/lib/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { AggregatedUploadProgress } from '@/stores/uploads.ts';

export default function UploadFolderRow({
  folderName,
  info,
  isRateLimited,
  onCancel,
}: {
  folderName: string;
  info: AggregatedUploadProgress;
  isRateLimited: boolean;
  onCancel: () => void;
}) {
  const { t, tItem } = useTranslations();

  const progress = info.totalSize > 0 ? (info.uploadedSize / info.totalSize) * 100 : 0;
  const failed = info.erroredCount > 0 && info.activeCount === 0;
  const statusText = failed
    ? t('elements.fileUpload.failedFolder', {
        folder: folderName,
        files: tItem('file', info.erroredCount),
      })
    : t('elements.fileUpload.uploadingFolder', {
        folder: folderName,
        files: tItem('file', info.fileCount),
      });

  return (
    <div className='flex flex-row items-center mb-3'>
      <div className='flex flex-col grow'>
        <p className='break-all mb-1'>{statusText}</p>
        <Tooltip label={bytesProgressString(info.uploadedSize, info.totalSize)} innerClassName='w-full'>
          <Progress
            indeterminate={info.totalSize === 0}
            value={progress}
            color={info.erroredCount > 0 ? 'red' : isRateLimited ? 'orange' : undefined}
          />
        </Tooltip>
      </div>
      <Tooltip label={t('elements.fileUpload.cancel', {})}>
        <ActionIcon variant='light' color='red' className='ml-3' onClick={onCancel}>
          <FontAwesomeIcon icon={faXmark} size='sm' />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
