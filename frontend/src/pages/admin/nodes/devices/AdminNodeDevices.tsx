import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { z } from 'zod';
import getNodeDevices from '@/api/admin/nodes/devices/getNodeDevices.ts';
import Button from '@/elements/buttons/Button.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Table from '@/elements/data-display/Table.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { nodeDeviceTableColumns } from '@/lib/tableColumns.ts';
import { useSearchablePaginatedTable } from '@/plugins/resource/useSearchablePaginatedTable.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import NodeDeviceAddModal from './modals/NodeDeviceAddModal.tsx';
import NodeDeviceRow from './NodeDeviceRow.tsx';

export default function AdminNodeDevices({ node }: { node: z.infer<typeof adminNodeSchema> }) {
  const { t } = useTranslations();
  const [openModal, setOpenModal] = useState<'add' | null>(null);

  const {
    data: nodeDevices,
    loading,
    error,
    search,
    setSearch,
    setPage,
    setPerPage,
  } = useSearchablePaginatedTable({
    queryKey: queryKeys.admin.deviceAssignments.devicesByNode(node.uuid),
    fetcher: (page, search, perPage) => getNodeDevices(node.uuid, page, search, perPage),
    backgroundRefetch: true,
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.nodes.tabs.devices.page.title', {})}
      titleOrder={2}
      search={search}
      setSearch={setSearch}
      registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.devices.subContainer}
      registryProps={{ node }}
      contentRight={
        <Button onClick={() => setOpenModal('add')} color='blue' leftSection={<FontAwesomeIcon icon={faPlus} />}>
          {t('common.button.add', {})}
        </Button>
      }
    >
      <NodeDeviceAddModal node={node} opened={openModal === 'add'} onClose={() => setOpenModal(null)} />

      <Table
        columns={nodeDeviceTableColumns()}
        loading={loading}
        error={error}
        pagination={nodeDevices}
        onPageSelect={setPage}
        onPerPageSelect={setPerPage}
      >
        {nodeDevices?.data.map((device) => (
          <NodeDeviceRow key={device.device.uuid} node={node} device={device} />
        ))}
      </Table>
    </AdminSubContentContainer>
  );
}
