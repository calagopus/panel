import { ModalProps } from '@mantine/core';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import duplicateEgg from '@/api/admin/nests/eggs/duplicateEgg.ts';
import Button from '@/elements/buttons/Button.tsx';
import NestSelect from '@/elements/input/NestSelect.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
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

  const { form, handleClose, handleSubmit, loading } = useModalForm<{ name: string; targetNestUuid: string }>({
    initialValues: { name: '', targetNestUuid: nest.uuid },
    onClose: props.onClose,
    onSubmit: async ({ name, targetNestUuid }) => {
      const duplicated = await duplicateEgg(nest.uuid, egg.uuid, name, targetNestUuid);
      addToast(
        t('common.toast.duplicated', { resource: t('pages.admin.nests.tabs.eggs.page.resourceName', {}) }),
        'success',
      );
      navigate(`/admin/nests/${targetNestUuid}/eggs/${duplicated.uuid}`);
    },
  });

  useEffect(() => {
    if (props.opened) {
      form.setValues({ name: `${egg.name} (copy)`, targetNestUuid: nest.uuid });
    }
  }, [egg, nest, props.opened]);

  return (
    <FormModal
      title={t('common.modal.duplicate.title', { resource: t('pages.admin.nests.tabs.eggs.page.resourceName', {}) })}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('common.form.newName', {})}
          key={form.key('name')}
          {...form.getInputProps('name')}
        />
        <NestSelect
          withAsterisk
          label={t('common.form.nest', {})}
          value={form.getValues().targetNestUuid}
          onChange={(uuid) => form.setFieldValue('targetNestUuid', uuid ?? nest.uuid)}
          includeItems={[nest]}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={form.getValues().name.length < 1}>
            {t('common.button.duplicate', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
