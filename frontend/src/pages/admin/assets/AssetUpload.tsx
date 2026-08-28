import { faFileUpload, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ChangeEvent, RefObject, useRef } from 'react';
import Button from '@/elements/Button.tsx';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import { useImportDragAndDrop } from '@/plugins/useImportDragAndDrop.ts';
import { useQuickActions } from '@/plugins/useQuickActions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AssetDropOverlay from './AssetDropOverlay.tsx';

export default function AssetUpload({
  handleFileSelect,
  uploadFiles,
}: {
  handleFileSelect: (event: ChangeEvent<HTMLInputElement>, inputRef: RefObject<HTMLInputElement | null>) => void;
  uploadFiles: (files: File[]) => Promise<void>;
}) {
  const { t } = useTranslations();

  const { isDragging } = useImportDragAndDrop({
    onDrop: uploadFiles,
    filterFile: () => true,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useQuickActions([
    {
      id: 'assets.uploadFiles',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.assets.quickAction.uploadFiles', {}),
      icon: <FontAwesomeIcon icon={faFileUpload} />,
      adminPermission: 'assets.upload',
      perform: () => fileInputRef.current?.click(),
    },
  ]);

  return (
    <>
      <AssetDropOverlay visible={isDragging} />

      <Button
        onClick={() => fileInputRef.current?.click()}
        color='blue'
        leftSection={<FontAwesomeIcon icon={faPlus} />}
      >
        {t('pages.admin.assets.button.upload', {})}
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
