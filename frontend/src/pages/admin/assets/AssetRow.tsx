import { faCopy, faFolder, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router';
import ItemPreviewList from '@/elements/data-display/ItemPreviewList.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { handleRawCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { relativeName } from '@/lib/path.ts';
import { StorageAsset } from '@/lib/schemas/admin/assets.ts';
import AssetListItem from '@/pages/admin/assets/AssetListItem.tsx';
import { useDeleteAssets } from '@/pages/admin/assets/hooks/useDeleteAssets.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface AssetRowProps {
  asset: StorageAsset;
  currentDirectory: string;
  isSelected: boolean;

  toggleSelectedAsset: (asset: StorageAsset, range?: boolean) => void;
  removeSelectedAsset: (asset: StorageAsset) => void;
  invalidateAssets: () => void;
  ref?: Ref<HTMLTableRowElement>;
}

export default function AssetRow({
  asset,
  currentDirectory,
  isSelected,
  toggleSelectedAsset,
  removeSelectedAsset,
  invalidateAssets,
  ref,
}: AssetRowProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const canDeleteAssets = useAdminCan('assets.delete');
  const deleteAssets = useDeleteAssets();

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const displayName = relativeName(asset.name, currentDirectory);
  const directoryTo = `?${createSearchParams({ directory: asset.name })}`;

  const doDelete = async () => {
    if (await deleteAssets([asset.name])) {
      setOpenModal(null);
      removeSelectedAsset(asset);
      invalidateAssets();
    }
  };

  if (asset.isDirectory) {
    return (
      <TableRow
        ref={ref}
        className='cursor-pointer'
        onClick={(e) => {
          if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
          navigate(directoryTo);
        }}
      >
        <td className='pl-4 w-10 h-9 text-center flex flex-col'>
          <FontAwesomeIcon icon={faFolder} className='my-auto' />
        </td>

        <TableData colSpan={3}>
          <TableLink to={directoryTo} className='flex items-center gap-2'>
            <Code>{displayName}</Code>
          </TableLink>
        </TableData>

        <td />
      </TableRow>
    );
  }

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.assets.modal.deleteAsset.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        <Stack>
          {t('pages.admin.assets.modal.deleteAsset.content', {})}

          <ItemPreviewList
            items={[asset]}
            getKey={(asset) => asset.name}
            renderItem={(asset) => <AssetListItem asset={asset} currentDirectory={currentDirectory} />}
          />
        </Stack>
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faCopy,
            label: t('pages.admin.assets.button.copyLink', {}),
            onClick: () => handleRawCopyToClipboard(asset.url, addToast),
            color: 'gray',
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
            canAccess: canDeleteAssets,
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) {
                toggleSelectedAsset(asset, e.shiftKey);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
            ref={ref}
          >
            <TableSelectionCell
              id={asset.name}
              checked={isSelected}
              onChange={(_, range) => toggleSelectedAsset(asset, range)}
            />

            <TableData>
              <TableLink to={asset.url} target='_blank'>
                <Code>{displayName}</Code>
              </TableLink>
            </TableData>

            <TableData>{bytesToString(asset.size)}</TableData>

            <TableData>
              <FormattedTimestamp timestamp={asset.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
