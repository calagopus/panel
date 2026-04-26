import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Text, UnstyledButton } from '@mantine/core';
import { useRef } from 'react';
import uploadAssets from '@/api/admin/assets/uploadAssets.ts';
import Button from '@/elements/Button.tsx';
import CloseButton from '@/elements/CloseButton.tsx';
import Popover from '@/elements/Popover.tsx';
import Progress from '@/elements/Progress.tsx';
import RingProgress from '@/elements/RingProgress.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { bytesToString } from '@/lib/size.ts';
import { useFileUpload } from '@/plugins/useFileUpload.ts';

export default function AssetUpload({ invalidateAssets }: { invalidateAssets: () => void }) {
  const { uploadingFiles, handleFileSelect, totalUploadProgress, cancelFileUpload } = useFileUpload(
    (form, config) => uploadAssets(form, config).then(() => ({ url: '', continuationToken: null })),
    invalidateAssets,
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      {uploadingFiles.size > 0 ? (
        <Popover position='bottom-start' shadow='md'>
          <Popover.Target>
            <UnstyledButton>
              <RingProgress
                size={50}
                sections={[
                  {
                    value: totalUploadProgress,
                    color: 'green',
                  },
                ]}
                roundCaps
                thickness={4}
                label={
                  <Text c='green' fw={700} ta='center' size='xs'>
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
                    {file.status === 'pending' ? 'Waiting: ' : 'Uploading: '}
                    {file.filePath}
                  </p>
                  <Tooltip
                    label={`${bytesToString(file.uploaded)} / ${bytesToString(file.size)}`}
                    innerClassName='w-full'
                  >
                    <Progress value={file.progress} />
                  </Tooltip>
                </div>
                <CloseButton className='ml-3' onClick={() => cancelFileUpload(key)} />
              </div>
            ))}
          </Popover.Dropdown>
        </Popover>
      ) : null}

      <Button
        onClick={() => fileInputRef.current?.click()}
        color='blue'
        leftSection={<FontAwesomeIcon icon={faPlus} />}
      >
        Upload
      </Button>

      <input
        type='file'
        ref={fileInputRef}
        className='hidden'
        onChange={(e) => handleFileSelect(e, fileInputRef)}
        multiple
      />
    </>
  );
}
