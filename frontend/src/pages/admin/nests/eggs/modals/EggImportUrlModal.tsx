import { ModalProps } from '@mantine/core';
import { useEffect } from 'react';
import { z } from 'zod';
import importEggsFromUrl from '@/api/admin/nests/eggs/importEggsFromUrl.ts';
import Button from '@/elements/buttons/Button.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function EggImportUrlModal({
  nest,
  onImported,
  ...props
}: ModalProps & {
  nest: z.infer<typeof adminNestSchema>;
  onImported: () => void;
}) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();

  const { form, handleClose, handleSubmit, loading } = useModalForm<{ urls: string[] }>({
    initialValues: { urls: [] },
    onClose: props.onClose,
    onSubmit: async ({ urls }) => {
      const { eggs, failures } = await importEggsFromUrl(nest.uuid, urls);

      if (eggs.length > 0) {
        addToast(
          t('pages.admin.nests.tabs.eggs.page.toast.importedBulk', { eggs: tItem('egg', eggs.length) }),
          'success',
        );
      }

      for (const failure of failures) {
        addToast(
          t('pages.admin.nests.tabs.eggs.page.toast.importFailed', { url: failure.url, error: failure.error }),
          'error',
        );
      }

      onImported();
    },
  });

  useEffect(() => {
    if (props.opened) form.reset();
  }, [props.opened]);

  return (
    <FormModal
      title={t('pages.admin.nests.tabs.eggs.page.modal.importUrl.title', {})}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <Stack>
        <TagsInput
          withAsterisk
          label={t('pages.admin.nests.tabs.eggs.page.modal.importUrl.urls', {})}
          description={t('pages.admin.nests.tabs.eggs.page.modal.importUrl.urlsDescription', {})}
          placeholder='https://example.com/egg.json'
          allowReordering={false}
          key={form.key('urls')}
          {...form.getInputProps('urls')}
        />

        <ModalFooter>
          <Button type='submit' loading={loading} disabled={form.getValues().urls.length < 1}>
            {t('common.button.import', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </FormModal>
  );
}
