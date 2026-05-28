import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteAssets from '@/api/admin/assets/deleteAssets.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { useKeyboardShortcuts } from '@/plugins/useKeyboardShortcuts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AssetActionBar({
  selectedAssets,
  invalidateAssets,
}: {
  selectedAssets: ObjectSet<z.infer<typeof storageAssetSchema>, 'name'>;
  invalidateAssets: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    await deleteAssets(selectedAssets.keys())
      .then(({ deleted }) => {
        invalidateAssets();

        addToast(t('pages.admin.assets.toast.assetsDeleted', { assets: tItem('asset', deleted) }), 'success');
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'Delete',
        callback: () => setOpenModal('delete'),
      },
    ],
    deps: [],
  });

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.assets.modal.deleteAssets.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.admin.assets.modal.deleteAssets.content', { count: selectedAssets.size }).md()}
      </ConfirmationModal>

      <ActionBar opened={selectedAssets.size > 0}>
        <AdminCan action='assets.delete'>
          <Button color='red' onClick={() => setOpenModal('delete')} className='col-span-2'>
            <FontAwesomeIcon icon={faTrash} className='mr-2' /> {t('common.button.delete', {})}
          </Button>
        </AdminCan>
      </ActionBar>
    </>
  );
}
