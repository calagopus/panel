import { memo } from 'react';
import UploadDropOverlay from '@/elements/UploadDropOverlay.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ImportOverlayProps {
  visible: boolean;
  title: string;
  subtitle?: string;
}

function ImportOverlay({ subtitle, ...props }: ImportOverlayProps) {
  const { t } = useTranslations();

  return <UploadDropOverlay blur subtitle={subtitle ?? t('elements.importOverlay.subtitle', {})} {...props} />;
}

export default memo(ImportOverlay);
