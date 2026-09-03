import { faCopy, faFolder, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Ref, useState } from 'react';
import { createSearchParams, useNavigate } from 'react-router';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { handleRawCopyToClipboard } from '@/lib/clipboard/copy.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { relativeName } from '@/lib/path.ts';
import { StorageAsset } from '@/lib/schemas/admin/assets.ts';
import { useDeleteAssets } from '@/pages/admin/assets/hooks/useDeleteAssets.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface AssetRowProps {
  asset: StorageAsset;
  currentDirectory: string;
  isSelected: boolean;

  toggleSelectedAsset: (asset: StorageAsset) => void;
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
        {t('pages.admin.assets.modal.deleteAsset.content', {})}
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
              if (e.ctrlKey || e.metaKey) {
                toggleSelectedAsset(asset);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
            ref={ref}
          >
            <td className='pl-4 w-10 text-center'>
              <Checkbox
                id={asset.name}
                checked={isSelected}
                onChange={() => toggleSelectedAsset(asset)}
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
}
