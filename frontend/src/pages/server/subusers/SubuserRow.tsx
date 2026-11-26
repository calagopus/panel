import { faLock, faLockOpen, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteSubuser from '@/api/server/subusers/deleteSubuser.ts';
import Avatar from '@/elements/data-display/Avatar.tsx';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { serverSubuserSchema } from '@/lib/schemas/server/subusers.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import SubuserUpdateModal from './modals/SubuserUpdateModal.tsx';

interface SubuserRowProps {
  subuser: z.infer<typeof serverSubuserSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
}

const SubuserRow = forwardRef<HTMLTableRowElement, SubuserRowProps>(function SubuserRow(
  { subuser, isSelected = false, onSelectionChange },
  ref,
) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'update' | 'remove' | null>(null);

  const doRemove = async () => {
    await deleteSubuser(server.uuid, subuser.user.uuid)
      .then(() => {
        setOpenModal(null);
        addToast(t('pages.server.subusers.modal.removeSubuser.toast.removed', {}), 'success');
        queryClient.invalidateQueries({ queryKey: queryKeys.server(server.uuid).subusers.all() });
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <SubuserUpdateModal subuser={subuser} opened={openModal === 'update'} onClose={() => setOpenModal(null)} />

      <ConfirmationModal
        opened={openModal === 'remove'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.subusers.modal.removeSubuser.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('common.modal.removeFromServer.content', {
          name: subuser.user.username,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('update'),
            color: 'gray',
            canAccess: useServerCan('subusers.update'),
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useServerCan('subusers.delete'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.server.subusers.subuserContextMenu}
        registryProps={{ subuser }}
      >
        {({ items, openMenu }) => (
          <TableRow
            ref={ref}
            bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            {onSelectionChange !== undefined && (
              <TableSelectionCell id={subuser.user.uuid} checked={isSelected} onChange={onSelectionChange} />
            )}

            <TableData>
              <div className='size-5 aspect-square relative'>
                <Avatar size={20} className='select-none' src={subuser.user.avatar} name={subuser.user.username} />
              </div>
            </TableData>

            <TableData>{subuser.user.username}</TableData>

            <TableData>
              {subuser.user.totpEnabled ? (
                <FontAwesomeIcon className='text-(--mantine-color-green-text)' icon={faLock} />
              ) : (
                <FontAwesomeIcon className='text-(--mantine-color-red-text)' icon={faLockOpen} />
              )}
            </TableData>

            <TableData>{subuser.permissions.length}</TableData>

            <TableData>{subuser.ignoredFiles.length}</TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
});

export default SubuserRow;
