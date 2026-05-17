import { faCopy, faFolder, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { forwardRef, useState } from 'react';
import { createSearchParams } from 'react-router';
import { z } from 'zod';
import deleteAssets from '@/api/admin/assets/deleteAssets.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { handleRawCopyToClipboard } from '@/lib/copy.ts';
import { storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { bytesToString } from '@/lib/size.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

interface AssetRowProps {
  asset: z.infer<typeof storageAssetSchema>;
  isSelected: boolean;

  addSelectedAsset: (asset: z.infer<typeof storageAssetSchema>) => void;
  removeSelectedAsset: (asset: z.infer<typeof storageAssetSchema>) => void;
  invalidateAssets: () => void;
  onDirectoryClick: (name: string) => void;
}

const AssetRow = forwardRef<HTMLTableRowElement, AssetRowProps>(function AssetRow(
  { asset, isSelected, addSelectedAsset, removeSelectedAsset, invalidateAssets, onDirectoryClick },
  ref,
) {
  const { addToast } = useToast();
  const canDeleteAssets = useAdminCan('assets.delete');

  const [openModal, setOpenModal] = useState<'delete' | null>(null);

  const displayName = asset.name.split('/').pop() ?? asset.name;

  const toggleSelected = () => (isSelected ? removeSelectedAsset(asset) : addSelectedAsset(asset));

  const doDelete = async () => {
    await deleteAssets([asset.name])
      .then(() => {
        removeSelectedAsset(asset);
        addToast('Asset deleted successfully', 'success');
        invalidateAssets();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  if (asset.isDirectory) {
    return (
      <TableRow
        ref={ref}
        className='cursor-pointer'
        onClick={(e) => {
          e.stopPropagation();
          onDirectoryClick(asset.name);
        }}
      >
        <td className='pl-4 relative cursor-pointer w-10 h-9 text-center flex flex-col'>
          <FontAwesomeIcon icon={faFolder} className='my-auto' />
        </td>

        <TableData colSpan={3}>
          <TableLink
            to={`?${createSearchParams({ directory: asset.name })}`}
            className='flex items-center gap-2'
            onClick={(e) => e.preventDefault()}
          >
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
        title='Delete Asset'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete this asset? This action cannot be undone.
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faCopy,
            label: 'Copy Link',
            onClick: () => handleRawCopyToClipboard(asset.url, addToast),
            color: 'gray',
          },
          {
            icon: faTrash,
            label: 'Delete',
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
              if (e.ctrlKey || e.metaKey) {
                addSelectedAsset(asset);
                return true;
              }

              return false;
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
            ref={ref}
          >
            <td className='pl-4 relative cursor-pointer w-10 text-center'>
              <Checkbox
                id={asset.name}
                checked={isSelected}
                onChange={toggleSelected}
                onClick={(e) => e.stopPropagation()}
              />
            </td>

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
});

export default AssetRow;
