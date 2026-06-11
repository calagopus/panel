import { faUpload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { memo } from 'react';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface OAuthProviderImportOverlayProps {
  visible: boolean;
}

function OAuthProviderImportOverlay({ visible }: OAuthProviderImportOverlayProps) {
  const { t } = useTranslations();

  if (!visible) return null;

  return (
    <div className='fixed w-screen h-screen left-0 top-0 inset-0 z-100 flex items-center justify-center backdrop-blur-md bg-black/20 pointer-events-auto'>
      <div className='pointer-events-none'>
        <div className='bg-(--mantine-color-body) rounded-lg p-8 shadow-2xl border-2 border-dashed border-(--mantine-color-blue-5)'>
          <div className='flex flex-col items-center gap-4 z-100'>
            <FontAwesomeIcon icon={faUpload} className='text-6xl text-(--mantine-color-blue-5) animate-bounce' />
            <p className='text-xl font-semibold'>{t('pages.admin.oAuthProviders.dropzone.title', {})}</p>
            <p className='text-sm text-(--mantine-color-dimmed)'>
              {t('pages.admin.oAuthProviders.dropzone.subtitle', {})}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(OAuthProviderImportOverlay);
