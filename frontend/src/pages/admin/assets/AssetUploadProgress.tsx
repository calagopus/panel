import CloseButton from '@/elements/CloseButton.tsx';
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
              <p className='break-all mb-1 text-sm'>
                {file.status === 'error'
                  ? t('elements.fileUpload.failed', { file: file.filePath })
                  : file.status === 'pending'
                    ? t('elements.fileUpload.waiting', { file: file.filePath })
                    : t('elements.fileUpload.uploading', { file: file.filePath })}
              </p>
              <Tooltip label={bytesProgressString(file.uploaded, file.size)} innerClassName='w-full'>
                <Progress value={file.progress} color={file.status === 'error' ? 'red' : undefined} />
              </Tooltip>
            </div>
            <CloseButton className='ml-3' onClick={() => cancelFileUpload(key)} />
          </div>
        ))}
      </Popover.Dropdown>
    </Popover>
  );
}
