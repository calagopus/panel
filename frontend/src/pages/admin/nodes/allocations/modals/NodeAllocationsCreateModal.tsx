import { ModalProps } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { FormEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import createNodeAllocations from '@/api/admin/nodes/allocations/createNodeAllocations.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import NodeAllocationIpInput from '@/elements/input/NodeAllocationIpInput.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { resolvePorts } from '@/lib/network/ip.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNodeAllocationsSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { liveValidation } from '@/plugins/form/liveValidation.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function NodeAllocationsCreateModal({
  node,
  loadAllocations,
  ...props
}: ModalProps & { node: Pick<z.infer<typeof adminNodeSchema>, 'uuid'>; loadAllocations?: () => void }) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [resolvedPorts, setResolvedPorts] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminNodeAllocationsSchema>>({
    initialValues: {
      ip: '',
      ipAlias: null,
      ports: [],
    },
    ...liveValidation,
    validate: zod4Resolver(adminNodeAllocationsSchema),
  });

  useEffect(() => {
    const { resolved, toRemove } = resolvePorts(form.values.ports);

    for (const removable of toRemove) {
      form.setFieldValue('ports', (p) => p.filter((r) => r !== removable));
    }

    setResolvedPorts(resolved);
  }, [form.values.ports]);

  const doCreate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    createNodeAllocations(node.uuid, {
      ip: form.values.ip,
      ipAlias: form.values.ipAlias || null,
      ports: resolvedPorts,
    })
      .then(({ created }) => {
        addToast(
          t('pages.admin.nodes.tabs.allocations.page.modal.create.toast.created', {
            allocations: tItem('allocation', created),
          }),
          'success',
        );

        props.onClose();
        form.reset();
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.nodes.allocations(node.uuid) });
        loadAllocations?.();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <FormModal
      title={t('pages.admin.nodes.tabs.allocations.page.modal.create.title', {})}
      loading={loading}
      {...props}
      onSubmit={doCreate}
    >
      <Stack>
        <NodeAllocationIpInput
          withAsterisk
          nodeUuid={node.uuid}
          label={t('common.table.columns.ip', {})}
          placeholder={t('common.table.columns.ip', {})}
          {...form.getInputProps('ip')}
        />

        <TextInput
          label={t('pages.admin.nodes.tabs.allocations.page.form.ipAlias', {})}
          placeholder={t('pages.admin.nodes.tabs.allocations.page.form.ipAlias', {})}
          {...form.getInputProps('ipAlias')}
        />

        <TagsInput
          withAsterisk
          label={t('common.form.portRanges', {})}
          placeholder={t('common.form.portRangesPlaceholder', {})}
          {...form.getInputProps('ports')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={!form.isValid() || !resolvedPorts.length}>
            {t('pages.admin.nodes.tabs.allocations.page.modal.create.button.create', { count: resolvedPorts.length })}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
