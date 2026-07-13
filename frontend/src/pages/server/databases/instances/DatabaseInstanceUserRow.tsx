import { faEye, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteDatabaseInstanceUser from '@/api/server/databases/instances/deleteDatabaseInstanceUser.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceSchema,
  serverDatabaseInstanceUserSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceCredentialsModal from './modals/DatabaseInstanceCredentialsModal.tsx';

export default function DatabaseInstanceUserRow({
  instance,
  user,
  databaseName,
}: {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  user: z.infer<typeof serverDatabaseInstanceUserSchema>;
  databaseName: string | null;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'details' | 'delete' | null>(null);

  const doDelete = async () => {
    await deleteDatabaseInstanceUser(server.uuid, instance.uuid, user.uuid)
      .then(() => {
        addToast(t('pages.server.databases.instance.users.toast.deleted', {}), 'success');
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).databases.instances.users(instance.uuid),
        });
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <DatabaseInstanceCredentialsModal
        instance={instance}
        user={user}
        opened={openModal === 'details'}
        onClose={() => setOpenModal(null)}
      />
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.databases.instance.users.modal.deleteUser.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.server.databases.instance.users.modal.deleteUser.content', {
          username: user.username,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faEye,
            label: t('common.button.details', {}),
            onClick: () => setOpenModal('details'),
            color: 'gray',
          },
          {
            type: 'divider',
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            onClick: () => setOpenModal('delete'),
            color: 'red',
          },
        ]}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <CopyOnClick content={user.username}>
                <Code>{user.username}</Code>
              </CopyOnClick>
            </TableData>

            <TableData>
              <Code>{databaseName ? databaseName : t('common.na', {})}</Code>
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
