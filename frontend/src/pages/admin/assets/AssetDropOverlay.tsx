import { faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { memo } from 'react';

function AssetDropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className='fixed w-screen h-screen left-0 top-0 inset-0 z-100 flex items-center justify-center backdrop-blur-md bg-black/20 pointer-events-auto'>
      <div className='pointer-events-none'>
        <div className='bg-gray-800 rounded-lg p-8 shadow-2xl border-2 border-dashed border-blue-500 dark:border-blue-400'>
          <div className='flex flex-col items-center gap-4 z-100'>
            <FontAwesomeIcon icon={faUpload} className='text-6xl text-blue-500 dark:text-blue-400 animate-bounce' />
            <p className='text-xl font-semibold text-gray-800 dark:text-gray-200'>Drop files here to upload</p>
            <p className='text-sm text-gray-600 dark:text-gray-400'>Release to start uploading</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(AssetDropOverlay);
