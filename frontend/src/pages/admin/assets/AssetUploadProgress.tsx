import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ActionIcon from '@/elements/ActionIcon.tsx';
import Badge from '@/elements/Badge.tsx';
import Popover from '@/elements/Popover.tsx';
import Progress from '@/elements/Progress.tsx';
import RingProgress from '@/elements/RingProgress.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import UnstyledButton from '@/elements/UnstyledButton.tsx';
import { bytesProgressString } from '@/lib/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { UploadItem } from '@/stores/uploads.ts';

export default function AssetUploadProgress({
  uploadingFiles,
  totalUploadProgress,
  cancelFileUpload,
}: {
  uploadingFiles: Map<string, UploadItem>;
  totalUploadProgress: number;
  cancelFileUpload: (key: string) => void;
}) {
  const { t } = useTranslations();

  if (uploadingFiles.size === 0) {
    return null;
  }

  let hasErrors = false;
  uploadingFiles.forEach((file) => {
    if (file.status === 'error') hasErrors = true;
  });

  return (
    <Popover position='bottom-start' shadow='md'>
      <Popover.Target>
        <UnstyledButton>
          <RingProgress
            size={50}
            sections={[
              {
                value: totalUploadProgress,
                color: hasErrors ? 'red' : 'green',
              },
            ]}
            roundCaps
            thickness={4}
            label={
              <Text c={hasErrors ? 'red' : 'green'} fw={700} ta='center' size='xs'>
                {totalUploadProgress.toFixed(0)}%
              </Text>
            }
          />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown className='md:min-w-xl max-w-screen max-h-96 overflow-y-auto'>
        {Array.from(uploadingFiles).map(([key, file]) => (
          <div key={key} className='flex flex-row items-center mb-2'>
            <div className='flex flex-col grow'>
              <div className='flex items-center gap-2 mb-1'>
                <Badge
                  variant='light'
                  size='sm'
                  color={file.status === 'error' ? 'red' : file.status === 'pending' ? 'gray' : 'blue'}
                >
                  {file.status === 'error'
                    ? t('elements.fileUpload.badge.failed', {})
                    : file.status === 'pending'
                      ? t('elements.fileUpload.badge.waiting', {})
                      : t('elements.fileUpload.badge.uploading', {})}
                </Badge>
                <span className='break-all text-sm'>{file.filePath}</span>
              </div>
              <Tooltip label={bytesProgressString(file.uploaded, file.size)} innerClassName='w-full'>
                <Progress value={file.progress} color={file.status === 'error' ? 'red' : undefined} />
              </Tooltip>
            </div>
            <Tooltip label={t('elements.fileUpload.cancel', {})}>
              <ActionIcon variant='light' color='red' className='ml-3' onClick={() => cancelFileUpload(key)}>
                <FontAwesomeIcon icon={faXmark} size='sm' />
              </ActionIcon>
            </Tooltip>
          </div>
        ))}
      </Popover.Dropdown>
    </Popover>
  );
}
