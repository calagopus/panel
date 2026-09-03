import { ModalProps } from '@mantine/core';
import { useEffect } from 'react';
import { z } from 'zod';
import updateEggUsingUrl from '@/api/admin/nests/eggs/updateEggUsingUrl.ts';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggUpdateUrlModal({
  nest,
  egg,
  onUpdated,
  ...props
}: ModalProps & {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
  onUpdated: () => void;
}) {
  const { t } = useTranslations();

  const { form, handleClose, handleSubmit, loading } = useModalForm<{ url: string }>({
    initialValues: { url: '' },
    onClose: props.onClose,
    onSubmit: async ({ url }) => {
      await updateEggUsingUrl(nest.uuid, egg.uuid, url);
      onUpdated();
    },
  });

  useEffect(() => {
    if (props.opened) form.reset();
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.admin.nests.tabs.eggs.page.modal.updateUrl.title', {})}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TextInput
          withAsterisk
          label={t('pages.admin.nests.tabs.eggs.page.modal.updateUrl.url', {})}
          description={t('pages.admin.nests.tabs.eggs.page.modal.updateUrl.urlDescription', {})}
          placeholder='https://example.com/egg.json'
          key={form.key('url')}
          {...form.getInputProps('url')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={form.getValues().url.length < 1}>
            {t('common.button.update', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
