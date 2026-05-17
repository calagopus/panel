import { faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { memo } from 'react';

interface EggImportOverlayProps {
  visible: boolean;
}

function EggImportOverlay({ visible }: EggImportOverlayProps) {
  if (!visible) return null;

  return (
    <div className='fixed w-screen h-screen left-0 top-0 inset-0 z-100 flex items-center justify-center backdrop-blur-md bg-black/20 pointer-events-auto'>
      <div className='pointer-events-none'>
        <div className='bg-(--mantine-color-body) rounded-lg p-8 shadow-2xl border-2 border-dashed border-(--mantine-color-blue-5)'>
          <div className='flex flex-col items-center gap-4 z-100'>
            <FontAwesomeIcon icon={faUpload} className='text-6xl text-(--mantine-color-blue-5) animate-bounce' />
            <p className='text-xl font-semibold'>Drop some files here to import as Eggs</p>
            <p className='text-sm text-(--mantine-color-dimmed)'>Release to start importing</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(EggImportOverlay);
