import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import UnstyledButton from '@/elements/buttons/UnstyledButton.tsx';
import Badge from '@/elements/data-display/Badge.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import RingProgress from '@/elements/feedback/RingProgress.tsx';
import Popover from '@/elements/overlays/Popover.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesProgressString } from '@/lib/format/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { UploadItem } from '@/stores/uploads.ts';

const STATUS_META = {
  error: { color: 'red', labelKey: 'common.badge.failed' },
  pending: { color: 'gray', labelKey: 'elements.fileUpload.badge.waiting' },
  uploading: { color: 'blue', labelKey: 'elements.fileUpload.badge.uploading' },
} as const;

function statusMeta(status: UploadItem['status']) {
  return STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.uploading;
}

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

  const hasErrors = [...uploadingFiles.values()].some((file) => file.status === 'error');

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
        {[...uploadingFiles].map(([key, file]) => {
          const meta = statusMeta(file.status);

          return (
            <div key={key} className='flex flex-row items-center mb-2'>
              <div className='flex flex-col grow'>
                <div className='flex items-center gap-2 mb-1'>
                  <Badge variant='light' size='sm' color={meta.color}>
                    {t(meta.labelKey, {})}
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
          );
        })}
      </Popover.Dropdown>
    </Popover>
  );
}
