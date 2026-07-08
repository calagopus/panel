import { faLock, faLockOpen, faPencil, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteSubuser from '@/api/server/subusers/deleteSubuser.ts';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import { serverSubuserSchema } from '@/lib/schemas/server/subusers.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import SubuserUpdateModal from './modals/SubuserUpdateModal.tsx';

export default function SubuserRow({ subuser }: { subuser: z.infer<typeof serverSubuserSchema> }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const removeSubuser = useServerStore((state) => state.removeSubuser);

  const [openModal, setOpenModal] = useState<'update' | 'remove' | null>(null);

  const doRemove = async () => {
    await deleteSubuser(server.uuid, subuser.user.uuid)
      .then(() => {
        addToast(t('pages.server.subusers.modal.removeSubuser.toast.removed', {}), 'success');
        removeSubuser(subuser);
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
        {t('pages.server.subusers.modal.removeSubuser.content', {
          username: subuser.user.username,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faPencil,
            label: t('common.button.edit', {}),
            onClick: () => setOpenModal('update'),
            color: 'gray',
            canAccess: useServerCan('subusers.update'),
          },
          {
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
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <div className='size-5 aspect-square relative'>
                <img
                  src={subuser.user.avatar ?? '/icon.svg'}
                  alt={subuser.user.username}
                  className='object-cover rounded-full select-none'
                />
              </div>
            </TableData>

            <TableData>{subuser.user.username}</TableData>

            <TableData>
              {subuser.user.totpEnabled ? (
                <FontAwesomeIcon className='text-green-500' icon={faLock} />
              ) : (
                <FontAwesomeIcon className='text-red-500' icon={faLockOpen} />
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
}
