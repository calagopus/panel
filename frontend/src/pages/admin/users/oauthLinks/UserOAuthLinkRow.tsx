import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { z } from 'zod';
import deleteUserOAuthLink from '@/api/admin/users/oauthLinks/deleteUserOAuthLink.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminUserOAuthLinkSchema } from '@/lib/schemas/admin/users.ts';
import { fullUserSchema } from '@/lib/schemas/user.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

export default function UserOAuthLinkRow({
  user,
  userOAuthLink,
}: {
  user: z.infer<typeof fullUserSchema>;
  userOAuthLink: z.infer<typeof adminUserOAuthLinkSchema>;
}) {
  const { addToast } = useToast();
  const { removeUserOAuthLink } = useAdminStore();

  const [openModal, setOpenModal] = useState<'edit' | 'delete' | null>(null);

  const doDelete = async () => {
    await deleteUserOAuthLink(user.uuid, userOAuthLink.uuid)
      .then(() => {
        removeUserOAuthLink(userOAuthLink);
        addToast('OAuth Link removed.', 'success');
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title='Confirm OAuth Link Deletion'
        confirm='Delete'
        onConfirmed={doDelete}
      >
        Are you sure you want to delete the
        <Code>{userOAuthLink.oauthProvider.name}</Code>
        connection from <Code>{user.username}</Code>?
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            icon: faTrash,
            label: 'Remove',
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.pageX, e.pageY);
            }}
          >
            <TableData>
              <Code>{userOAuthLink.uuid}</Code>
            </TableData>

            <TableData>
              <TableLink to={`/admin/oauth-providers/${userOAuthLink.oauthProvider.uuid}`}>
                <Code>{userOAuthLink.oauthProvider.name}</Code>
              </TableLink>
            </TableData>

            <TableData>
              <Code>{userOAuthLink.identifier}</Code>
            </TableData>

            <TableData>
              {!userOAuthLink.lastUsed ? 'N/A' : <FormattedTimestamp timestamp={userOAuthLink.lastUsed} />}
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={userOAuthLink.created} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
