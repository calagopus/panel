import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteSystemBackupPolicyLocation from '@/api/admin/system-backup-policies/locations/deleteSystemBackupPolicyLocation.ts';
import getSystemBackupPolicyLocations from '@/api/admin/system-backup-policies/locations/getSystemBackupPolicyLocations.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import { AdminCan } from '@/elements/Can.tsx';
import Code from '@/elements/Code.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useSearchablePaginatedTable } from '@/plugins/useSearchablePaginatedTable.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SystemBackupPolicyAddLocationModal from './modals/SystemBackupPolicyAddLocationModal.tsx';

function SystemBackupPolicyLocationRow({
  location,
  added,
  systemBackupPolicy,
  refetch,
}: {
  location: z.infer<typeof adminLocationSchema>;
  added: Date;
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  refetch: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteSystemBackupPolicyLocation(systemBackupPolicy.uuid, location.uuid)
      .then(() => {
        addToast(t('pages.admin.systemBackupPolicies.tabs.locations.page.toast.removed', {}), 'success');
        refetch();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  };

  return (
    <>
      <ConfirmationModal
        opened={openModal === 'remove'}
        onClose={() => setOpenModal(null)}
        title={t('pages.admin.systemBackupPolicies.tabs.locations.page.modal.remove.title', {})}
        confirm={t('common.button.remove', {})}
        onConfirmed={doRemove}
      >
        {t('pages.admin.systemBackupPolicies.tabs.locations.page.modal.remove.content', {
          policy: systemBackupPolicy.name,
          name: location.name,
        }).md()}
      </ConfirmationModal>

      <ContextMenu
        items={[
          {
            type: 'action',
            icon: faTrash,
            label: t('common.button.remove', {}),
            onClick: () => setOpenModal('remove'),
            color: 'red',
            canAccess: useAdminCan('system-backup-policies.update'),
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.locations.contextMenu}
        registryProps={{ systemBackupPolicy, location }}
      >
        {({ items, openMenu }) => (
          <TableRow
            onContextMenu={(e) => {
              e.preventDefault();
              openMenu(e.clientX, e.clientY);
            }}
          >
            <TableData>
              <TableLink to={`/admin/locations/${location.uuid}`}>
                <Code>{location.uuid}</Code>
              </TableLink>
            </TableData>

            <TableData className='flex flex-row items-center'>
              {location.flag && (
                <img
                  src={`/flags/${location.flag}.svg`}
                  alt={location.name}
                  className='w-5 h-5 mr-1 rounded-md shrink-0 my-auto'
                />
              )}{' '}
              {location.name}
            </TableData>

            <TableData>
              <FormattedTimestamp timestamp={added} />
            </TableData>

            <ContextMenuToggle items={items} openMenu={openMenu} />
          </TableRow>
        )}
      </ContextMenu>
    </>
  );
}

export default function AdminSystemBackupPolicyLocations({
  systemBackupPolicy,
}: {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
}) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: systemBackupPolicyLocations,
    loading,
    error,
    search,
    setSearch,
    setPage,
    refetch,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.systemBackupPolicies.locations(systemBackupPolicy.uuid),
    fetcher: (page, search) => getSystemBackupPolicyLocations(systemBackupPolicy.uuid, page, search),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.systemBackupPolicies.tabs.locations.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.locations.subContainer}
      registryProps={{ systemBackupPolicy }}
      contentRight={
        <AdminCan action='system-backup-policies.update'>
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        </AdminCan>
      }
    >
      <AdminCan action='system-backup-policies.update'>
        <SystemBackupPolicyAddLocationModal
          systemBackupPolicy={systemBackupPolicy}
          refetch={refetch}
          opened={openModal === 'add'}
          onClose={() => setOpenModal(null)}
        />
      </AdminCan>

      <Table
        columns={[
          t('common.table.columns.id', {}),
          t('common.table.columns.name', {}),
          t('common.table.columns.added', {}),
          '',
        ]}
        loading={loading}
        pagination={systemBackupPolicyLocations}
        onPageSelect={setPage}
        error={error}
      >
        {systemBackupPolicyLocations?.data.map((systemBackupPolicyLocation) => (
          <SystemBackupPolicyLocationRow
            key={systemBackupPolicyLocation.location.uuid}
            location={systemBackupPolicyLocation.location}
            added={systemBackupPolicyLocation.created}
            systemBackupPolicy={systemBackupPolicy}
            refetch={refetch}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
