import { ModalProps } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import duplicateEgg from '@/api/admin/nests/eggs/duplicateEgg.ts';
import getNests from '@/api/admin/nests/getNests.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/Button.tsx';
import Select from '@/elements/input/Select.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useSearchableResource } from '@/plugins/useSearchableResource.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggDuplicateModal({
  nest,
  egg,
  ...props
}: ModalProps & {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [targetNestUuid, setTargetNestUuid] = useState(nest.uuid);

  useEffect(() => {
    setName(`${egg.name} (copy)`);
    setTargetNestUuid(nest.uuid);
  }, [egg, nest, props.opened]);

  const nests = useSearchableResource<z.infer<typeof adminNestSchema>>({
    queryKey: queryKeys.admin.nests.all(),
    fetcher: (search) => getNests(1, search),
  });

  const doDuplicate = () => {
    setLoading(true);

    duplicateEgg(nest.uuid, egg.uuid, name, targetNestUuid)
      .then((duplicated) => {
        addToast(
          t('common.toast.duplicated', { resource: t('pages.admin.nests.tabs.eggs.page.resourceName', {}) }),
          'success',
        );
        props.onClose();
        navigate(`/admin/nests/${targetNestUuid}/eggs/${duplicated.uuid}`);
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t('common.modal.duplicate.title', { resource: t('pages.admin.nests.tabs.eggs.page.resourceName', {}) })}
      {...props}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.newName', {})}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          withAsterisk
          label={t('common.form.nest', {})}
          value={targetNestUuid}
          onChange={(value) => setTargetNestUuid(value ?? nest.uuid)}
          data={[
            { label: nest.name, value: nest.uuid },
            ...nests.items.filter((n) => n.uuid !== nest.uuid).map((n) => ({ label: n.name, value: n.uuid })),
          ]}
          searchable
          searchValue={nests.search}
          onSearchChange={nests.setSearch}
          loading={nests.loading}
        />

        <ModalFooter>
          <Button onClick={doDuplicate} loading={loading} disabled={name.length < 1}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={props.onClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
