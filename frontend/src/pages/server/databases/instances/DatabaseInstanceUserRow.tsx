import { faEye, faShieldHalved, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteDatabaseInstanceUser from '@/api/server/databases/instances/deleteDatabaseInstanceUser.ts';
import Badge from '@/elements/Badge.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Group from '@/elements/Group.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { serverDatabaseInstanceUserPermissionLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
  serverDatabaseInstanceUserSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceCredentialsModal from './modals/DatabaseInstanceCredentialsModal.tsx';
import DatabaseInstanceUserPermissionsModal from './modals/DatabaseInstanceUserPermissionsModal.tsx';

export default function DatabaseInstanceUserRow({
  instance,
  user,
  databases,
  offline,
}: {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  user: z.infer<typeof serverDatabaseInstanceUserSchema>;
  databases: z.infer<typeof serverDatabaseInstanceDatabaseSchema>[];
  offline: boolean;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'details' | 'permissions' | 'delete' | null>(null);

  const hasDatabases = instance.type !== 'redis';
  const aclOffline = offline && hasDatabases;

  const grantedDatabases = databases.flatMap((database) => {
    const permission = user.databases.find((entry) => entry.databaseUuid === database.uuid)?.permission;

    return permission && permission !== 'none' ? [{ database, permission }] : [];
  });

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
        databases={grantedDatabases.map((entry) => entry.database)}
        offline={offline}
        opened={openModal === 'details'}
        onClose={() => setOpenModal(null)}
      />
      <DatabaseInstanceUserPermissionsModal
        instance={instance}
        user={user}
        databases={databases}
        opened={openModal === 'permissions'}
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
            type: 'action',
            icon: faShieldHalved,
            label: t('pages.server.databases.instance.users.button.permissions', {}),
            hidden: !hasDatabases || databases.length === 0,
            disabled: aclOffline,
            onClick: () => setOpenModal('permissions'),
            color: 'gray',
          },
          {
            type: 'divider',
          },
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.delete', {}),
            disabled: aclOffline,
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
              <Group gap='xs'>
                {grantedDatabases.map(({ database, permission }) => (
                  <Tooltip key={database.uuid} label={serverDatabaseInstanceUserPermissionLabelMapping[permission]()}>
                    <Badge color={permission === 'read_write' ? 'blue' : 'gray'}>{database.name}</Badge>
                  </Tooltip>
                ))}
              </Group>
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
