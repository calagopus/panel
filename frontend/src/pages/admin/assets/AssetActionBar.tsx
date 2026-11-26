import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import ActionBar from '@/elements/ActionBar.tsx';
import Button from '@/elements/buttons/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import ItemPreviewList from '@/elements/data-display/ItemPreviewList.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { CORE_QUICK_ACTION_CATEGORIES } from '@/lib/quickActions/coreQuickActions.tsx';
import AssetListItem from '@/pages/admin/assets/AssetListItem.tsx';
import { AssetSet } from '@/pages/admin/assets/hooks/useAssetSelection.ts';
import { useDeleteAssets } from '@/pages/admin/assets/hooks/useDeleteAssets.ts';
import { useKeyboardShortcuts } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useQuickActions } from '@/plugins/quick-actions/useQuickActions.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AssetActionBar({
  selectedAssets,
  currentDirectory,
  onDeleted,
}: {
  selectedAssets: AssetSet;
  currentDirectory: string;
  onDeleted: () => void;
}) {
  const { t, tItem } = useTranslations();
  const canDeleteAssets = useAdminCan('assets.delete');
  const deleteAssets = useDeleteAssets();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const doDelete = async () => {
    if (await deleteAssets(selectedAssets.keys())) {
      setOpenModal(null);
      onDeleted();
    }
  };

  useQuickActions([
    {
      id: 'assets.deleteSelection',
      category: CORE_QUICK_ACTION_CATEGORIES.page,
      label: () => t('pages.admin.assets.quickAction.deleteSelection', {}),
      icon: faTrash,
      danger: true,
      adminPermission: 'assets.delete',
      isVisible: () => selectedAssets.size > 0,
      perform: () => setOpenModal('delete'),
    },
  ]);

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'Delete',
        callback: () => setOpenModal('delete'),
      },
    ],
    enabled: canDeleteAssets && selectedAssets.size > 0,
    deps: [canDeleteAssets, selectedAssets.size],
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
        <Stack>
          {t('common.modal.delete.content', { name: tItem('asset', selectedAssets.size) }).md()}

          <ItemPreviewList
            items={selectedAssets.values()}
            getKey={(asset) => asset.name}
            renderItem={(asset) => <AssetListItem asset={asset} currentDirectory={currentDirectory} />}
          />
        </Stack>
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
