import { ModalProps, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import createNodeAllocations from '@/api/admin/nodes/allocations/createNodeAllocations.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { resolvePorts } from '@/lib/ip.ts';
import { adminNodeAllocationsSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { useToast } from '@/providers/ToastProvider.tsx';

export default function NodeAllocationsCreateModal({
  node,
  loadAllocations,
  opened,
  onClose,
}: ModalProps & { node: z.infer<typeof adminNodeSchema>; loadAllocations: () => void }) {
  const { addToast } = useToast();

  const [resolvedPorts, setResolvedPorts] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof adminNodeAllocationsSchema>>({
    initialValues: {
      ip: '',
      ipAlias: null,
      ports: [],
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(adminNodeAllocationsSchema),
  });

  useEffect(() => {
    const { resolved, toRemove } = resolvePorts(form.values.ports);

    for (const removable of toRemove) {
      form.setFieldValue('ports', (p) => p.filter((r) => r !== removable));
    }

    setResolvedPorts(resolved);
  }, [form.values.ports]);

  const doCreate = () => {
    setLoading(true);

    createNodeAllocations(node.uuid, {
      ip: form.values.ip,
      ipAlias: form.values.ipAlias || null,
      ports: resolvedPorts,
    })
      .then(({ created }) => {
        addToast(`${created} Node Allocation${created === 1 ? '' : 's'} created.`, 'success');

        onClose();
        loadAllocations();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Create Node Allocations' onClose={onClose} opened={opened}>
      <Stack>
        <TextInput withAsterisk label='IP' placeholder='IP' {...form.getInputProps('ip')} />

        <TextInput label='IP Alias' placeholder='IP Alias' {...form.getInputProps('ipAlias')} />

        <TagsInput
          withAsterisk
          label='Port Ranges'
          placeholder='Port Ranges (eg. 3000-4000)'
          {...form.getInputProps('ports')}
        />

        <ModalFooter>
          <Button onClick={doCreate} loading={loading} disabled={!form.isValid() || !resolvedPorts.length}>
            Create {resolvedPorts.length}
          </Button>
          <Button variant='default' onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
