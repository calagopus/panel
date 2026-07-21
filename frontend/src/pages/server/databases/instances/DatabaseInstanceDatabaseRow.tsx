import { faDownload, faRefresh, faTrash, faUpload, faWarning } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import deleteDatabaseInstanceDatabase from '@/api/server/databases/instances/deleteDatabaseInstanceDatabase.ts';
import getDatabaseInstanceDatabaseSize from '@/api/server/databases/instances/getDatabaseInstanceDatabaseSize.ts';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { bytesToString } from '@/lib/size.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import DatabaseInstanceDatabaseExportModal from './modals/DatabaseInstanceDatabaseExportModal.tsx';
import DatabaseInstanceDatabaseImportModal from './modals/DatabaseInstanceDatabaseImportModal.tsx';
import DatabaseInstanceDatabaseRecreateModal from './modals/DatabaseInstanceDatabaseRecreateModal.tsx';

export default function DatabaseInstanceDatabaseRow({
  instance,
  database,
  offline,
  hasUser,
}: {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  database: z.infer<typeof serverDatabaseInstanceDatabaseSchema>;
  offline: boolean;
  hasUser: boolean;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const queryClient = useQueryClient();

  const [openModal, setOpenModal] = useState<'export' | 'import' | 'recreate' | 'delete' | null>(null);

  const {
    data: size,
    loading: sizeLoading,
    refetch: refetchSize,
  } = useResource({
    queryKey: queryKeys.server(server.uuid).databases.instances.databaseSize(instance.uuid, database.uuid),
    queryFn: () => getDatabaseInstanceDatabaseSize(server.uuid, instance.uuid, database.uuid),
    enabled: !offline,
    silent: true,
  });

  const canExport = useServerCan('database-instances.export');
  const canImport = useServerCan('database-instances.import');
  const canRecreate = useServerCan('database-instances.recreate');

  const doDelete = async () => {
    await deleteDatabaseInstanceDatabase(server.uuid, instance.uuid, database.uuid)
      .then(() => {
        addToast(t('pages.server.databases.instance.databases.toast.deleted', {}), 'success');
        queryClient.invalidateQueries({
          queryKey: queryKeys.server(server.uuid).databases.instances.databases(instance.uuid),
        });
        setOpenModal(null);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <DatabaseInstanceDatabaseExportModal
        instance={instance}
        database={database}
        opened={openModal === 'export'}
        onClose={() => setOpenModal(null)}
      />
      <DatabaseInstanceDatabaseImportModal
        instance={instance}
        database={database}
        opened={openModal === 'import'}
        onClose={() => setOpenModal(null)}
      />
      <DatabaseInstanceDatabaseRecreateModal
        instance={instance}
        database={database}
        opened={openModal === 'recreate'}
        onClose={() => setOpenModal(null)}
        onRecreated={refetchSize}
      />
      <ConfirmationModal
        opened={openModal === 'delete'}
        onClose={() => setOpenModal(null)}
        title={t('pages.server.databases.instance.databases.modal.deleteDatabase.title', {})}
        confirm={t('common.button.delete', {})}
        onConfirmed={doDelete}
      >
        {t('pages.server.databases.instance.databases.modal.deleteDatabase.content', {
          username: database.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faDownload,
            label: t('pages.server.databases.instance.databases.button.export', {}),
            onClick: () => setOpenModal('export'),
            color: 'gray',
            canAccess: canExport,
          },
          {
            type: 'action',
            icon: faUpload,
            label: t('pages.server.databases.instance.databases.button.import', {}),
            onClick: () => setOpenModal('import'),
            color: 'gray',
            canAccess: canImport,
          },
          {
            type: 'divider',
          },
          {
            type: 'action',
            icon: faRefresh,
            label: t('common.button.recreate', {}),
            disabled: offline,
            onClick: () => setOpenModal('recreate'),
            color: 'red',
            canAccess: canRecreate,
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
            <TableData className='flex flex-row items-center'>
              <CopyOnClick content={database.name}>
                <Code>{database.name}</Code>
              </CopyOnClick>
              {!hasUser && (
                <Tooltip label={t('pages.server.databases.instance.databases.tooltip.noUser', {})}>
                  <FontAwesomeIcon icon={faWarning} className='ml-2 text-yellow-400' />
                </Tooltip>
              )}
            </TableData>

            <TableData>
              {offline ? t('common.na', {}) : sizeLoading ? <Spinner size={16} /> : bytesToString(size ?? 0)}
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}
