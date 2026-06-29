import { ModalProps } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import updateNodeAllocations from '@/api/admin/nodes/allocations/updateNodeAllocations.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminNodeAllocationSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeAllocationsUpdateModal({
  node,
  loadAllocations,
  selectedNodeAllocations,
  setSelectedNodeAllocations,
  ...props
}: ModalProps & {
  node: z.infer<typeof adminNodeSchema>;
  loadAllocations: () => void;
  selectedNodeAllocations: ObjectSet<z.infer<typeof adminNodeAllocationSchema>, 'uuid'>;
  setSelectedNodeAllocations: (allocations: z.infer<typeof adminNodeAllocationSchema>[]) => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const mostCommonIp = useMemo(() => {
    const ipCounts = new Map<string, number>();

    for (const allocation of selectedNodeAllocations.values()) {
      if (ipCounts.get(allocation.ip)) {
        ipCounts.set(allocation.ip, ipCounts.get(allocation.ip)! + 1);
      } else {
        ipCounts.set(allocation.ip, 1);
      }
    }

    let mostCommon = '';
    let maxCount = 0;

    for (const [ip, count] of ipCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = ip;
      }
    }

    return mostCommon;
  }, [selectedNodeAllocations]);

  const mostCommonIpAlias = useMemo(() => {
    const ipAliasCounts = new Map<string, number>();

    for (const allocation of selectedNodeAllocations.values()) {
      if (!allocation.ipAlias) {
        continue;
      }

      if (ipAliasCounts.get(allocation.ipAlias)) {
        ipAliasCounts.set(allocation.ipAlias, ipAliasCounts.get(allocation.ipAlias)! + 1);
      } else {
        ipAliasCounts.set(allocation.ipAlias, 1);
      }
    }

    let mostCommon = '';
    let maxCount = 0;

    for (const [ipAlias, count] of ipAliasCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = ipAlias;
      }
    }

    return mostCommon;
  }, [selectedNodeAllocations]);

  const [ip, setIp] = useState('');
  const [ipAlias, setIpAlias] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIp(mostCommonIp);
  }, [mostCommonIp, props.opened]);

  useEffect(() => {
    setIpAlias(mostCommonIpAlias);
  }, [mostCommonIpAlias, props.opened]);

  const doUpdate = () => {
    setLoading(true);

    updateNodeAllocations(node.uuid, [...selectedNodeAllocations.values().map((a) => a.uuid)], {
      ip,
      ipAlias: ipAlias || null,
    })
      .then(({ updated }) => {
        addToast(
          t('pages.admin.nodes.tabs.allocations.page.modal.update.toast.updated', {
            allocations: tItem('allocation', updated),
          }),
          'success',
        );
        setSelectedNodeAllocations([]);

        props.onClose();
        loadAllocations();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.admin.nodes.tabs.allocations.page.modal.update.title', {})} {...props}>
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.table.columns.ip', {})}
          value={ip}
          onChange={(e) => setIp(e.target.value)}
        />

        <TextInput
          label={t('pages.admin.nodes.tabs.allocations.page.form.ipAlias', {})}
          value={ipAlias}
          onChange={(e) => setIpAlias(e.target.value)}
        />

        <ModalFooter>
          <Button onClick={doUpdate} loading={loading} disabled={!ip}>
            {t('common.button.update', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
