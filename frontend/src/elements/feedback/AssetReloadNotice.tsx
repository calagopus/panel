import { faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { globalTranslationHandle } from 'shared';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { getTranslations } from '@/providers/TranslationProvider.tsx';
import { reloadNow, useAssetReloadStore } from '@/stores/assetReload.ts';

const fallbacks = {
  title: 'Updating to the latest version',
  reloading: 'A new version of the panel is available. Reloading...',
  offline: 'A new version of the panel is available. Reloading once your connection is back...',
  stalled: 'A new version of the panel is available. Reload the page to continue.',
  reloadNow: 'Reload Now',
};

export default function AssetReloadNotice() {
  const status = useAssetReloadStore((state) => state.status);

  if (status === 'idle') return null;

  const translations = globalTranslationHandle ? getTranslations() : null;

  return (
    <div
      role='status'
      aria-live='polite'
      className='fixed-viewport z-1000 flex items-center justify-center p-6 bg-(--mantine-color-body)/85 backdrop-blur-sm animate-fade-in motion-reduce:animate-none'
    >
      <div className='flex flex-col items-center text-center gap-4 max-w-sm'>
        <div className='w-12 h-12 flex items-center justify-center'>
          {status === 'stalled' ? (
            <FontAwesomeIcon icon={faRotateRight} className='w-6 h-6 text-(--mantine-color-dimmed)' />
          ) : (
            <Spinner size={28} />
          )}
        </div>

        <div className='flex flex-col gap-1'>
          <p className='text-base font-semibold'>
            {translations?.t('elements.assetReloadNotice.title', {}) ?? fallbacks.title}
          </p>
          <p className='text-sm text-(--mantine-color-dimmed) leading-relaxed'>
            {translations?.t(`elements.assetReloadNotice.${status}`, {}) ?? fallbacks[status]}
          </p>
        </div>

        <button
          onClick={reloadNow}
          className='px-4 py-2 text-sm font-medium rounded-md bg-(--mantine-color-default) hover:bg-(--mantine-color-default-hover) border border-(--mantine-color-default-border) transition-colors'
        >
          {translations?.t('elements.assetReloadNotice.button.reloadNow', {}) ?? fallbacks.reloadNow}
        </button>
      </div>
    </div>
  );
}
