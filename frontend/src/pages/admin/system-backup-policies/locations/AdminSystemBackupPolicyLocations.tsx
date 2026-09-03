import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import deleteSystemBackupPolicyLocation from '@/api/admin/system-backup-policies/locations/deleteSystemBackupPolicyLocation.ts';
import getSystemBackupPolicyLocations from '@/api/admin/system-backup-policies/locations/getSystemBackupPolicyLocations.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table, { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import ConfirmationModal from '@/elements/modals/ConfirmationModal.tsx';
import ContextMenu, { ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { systemBackupPolicyLocationTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useAdminCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SystemBackupPolicyAddLocationModal from './modals/SystemBackupPolicyAddLocationModal.tsx';

function SystemBackupPolicyLocationRow({
  location,
  added,
  systemBackupPolicy,
  canRemove,
  refetch,
}: {
  location: z.infer<typeof adminLocationSchema>;
  added: Date;
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  canRemove: boolean;
  refetch: () => void;
}) {
  const { addToast } = useToast();
  const { t } = useTranslations();

  const [openModal, setOpenModal] = useState<'remove' | null>(null);

  const doRemove = async () => {
    await deleteSystemBackupPolicyLocation(systemBackupPolicy.uuid, location.uuid)
      .then(() => {
        setOpenModal(null);
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
            canAccess: canRemove,
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
  const canUpdate = useAdminCan('system-backup-policies.update');
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
        canUpdate ? (
          <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
            {t('common.button.add', {})}
          </Button>
        ) : undefined
      }
    >
      {canUpdate && (
        <SystemBackupPolicyAddLocationModal
          systemBackupPolicy={systemBackupPolicy}
          refetch={refetch}
          opened={openModal === 'add'}
          onClose={() => setOpenModal(null)}
        />
      )}

      <Table
        columns={systemBackupPolicyLocationTableColumns()}
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
            canRemove={canUpdate}
            refetch={refetch}
          />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
