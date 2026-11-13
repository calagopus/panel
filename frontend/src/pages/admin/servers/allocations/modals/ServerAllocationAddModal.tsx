import { ModalProps } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import getAvailableNodeAllocations from '@/api/admin/nodes/allocations/getAvailableNodeAllocations.ts';
import createServerAllocation from '@/api/admin/servers/allocations/createServerAllocation.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import MultiSelect from '@/elements/input/MultiSelect.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { formatAllocation } from '@/lib/domain/server.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeAllocationSchema } from '@/lib/schemas/admin/nodes.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import NoAvailableAllocationsAlert from '@/pages/admin/nodes/allocations/NoAvailableAllocationsAlert.tsx';
import { useInfiniteSearchableResource } from '@/plugins/resource/useInfiniteSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerAllocationAddModal({ server, ...props }: ModalProps & { server: AdminServer }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [selectedAllocationUuids, setSelectedAllocationUuids] = useState<string[]>([]);

  const availableAllocations = useInfiniteSearchableResource<z.infer<typeof adminNodeAllocationSchema>>({
    queryKey: queryKeys.admin.nodes.availableAllocations(server.node.uuid),
    fetcher: (page, search) => getAvailableNodeAllocations(server.node.uuid, page, search),
  });

  useEffect(() => {
    if (!props.opened) {
      availableAllocations.setSearch('');
      setSelectedAllocationUuids([]);
    }
  }, [props.opened]);

  const doAdd = async () => {
    setLoading(true);

    const results = await Promise.allSettled(
      selectedAllocationUuids.map((allocationUuid) => createServerAllocation(server.uuid, { allocationUuid })),
    );
    const failed = selectedAllocationUuids.filter((_, i) => results[i].status === 'rejected');
    const added = selectedAllocationUuids.length - failed.length;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.allocations(server.uuid) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.servers.detail(server.uuid) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.allocations(server.node.uuid) }),
    ]);

    if (added > 0) {
      addToast(t('pages.admin.servers.tabs.allocations.page.toast.added', { count: added }), 'success');
    }

    const firstFailure = results.find((result) => result.status === 'rejected');
    if (firstFailure) {
      addToast(httpErrorToHuman(firstFailure.reason), 'error');
      setSelectedAllocationUuids(failed);
    } else {
      props.onClose();
    }
    setLoading(false);
  };

  const noAvailableAllocations =
    !availableAllocations.loading && availableAllocations.items.length === 0 && !availableAllocations.search;

  return (
    <Modal title={t('pages.admin.servers.tabs.allocations.page.modal.add.title', {})} {...props}>
      <Stack>
        {props.opened && noAvailableAllocations && <NoAvailableAllocationsAlert nodeUuid={server.node.uuid} />}

        <MultiSelect
          withAsterisk
          label={t('pages.admin.servers.tabs.allocations.page.modal.add.form.allocations', {})}
          value={selectedAllocationUuids}
          onChange={(value) => setSelectedAllocationUuids(value)}
          data={availableAllocations.items.map((alloc) => ({
            label: formatAllocation(alloc),
            value: alloc.uuid,
          }))}
          searchable
          searchValue={availableAllocations.search}
          onSearchChange={availableAllocations.setSearch}
          infiniteScroll={availableAllocations.infiniteScroll}
          loading={availableAllocations.loading}
        />

        <ModalFooter>
          <Button onClick={doAdd} loading={loading} disabled={!selectedAllocationUuids.length}>
            {t('pages.admin.servers.tabs.allocations.page.modal.add.button.add', {
              count: selectedAllocationUuids.length,
            })}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
