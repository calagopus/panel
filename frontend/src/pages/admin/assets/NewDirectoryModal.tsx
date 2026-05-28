import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { assetDirectoryCreateSchema, storageAssetSchema } from '@/lib/schemas/admin/assets.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface NewDirectoryModalProps extends Omit<ModalProps, 'onSubmit'> {
  currentDirectory: string;
  existingEntries: z.infer<typeof storageAssetSchema>[];
  onNavigate: (dir: string) => void;
}

export default function NewDirectoryModal({
  currentDirectory,
  existingEntries,
  onNavigate,
  onClose,
  ...props
}: NewDirectoryModalProps) {
  const { t } = useTranslations();
  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof assetDirectoryCreateSchema>
  >({
    initialValues: { name: '' },
    validate: zod4Resolver(assetDirectoryCreateSchema),
    onClose,
    onSubmit: async (values) => {
      const fullPath = currentDirectory ? `${currentDirectory}/${values.name}` : values.name;
      onNavigate(fullPath);
    },
  });

  return (
    <FormModal
      title={t('pages.admin.assets.modal.createDirectory.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      {...props}
    >
      <TextInput
        withAsterisk
        label={t('pages.admin.assets.modal.createDirectory.form.directoryName', {})}
        placeholder={t('pages.admin.assets.modal.createDirectory.form.directoryName', {})}
        data-autofocus
        {...form.getInputProps('name')}
      />

      <p className='mt-2 text-sm break-all'>
        <span>{t('pages.admin.assets.modal.createDirectory.createdAs', {})}</span>
        <Code>
          assets/
          <span className='text-cyan-200'>
            {currentDirectory ? `${currentDirectory}/${form.values.name}` : form.values.name}
          </span>
        </Code>
      </p>

      <ModalFooter>
        <Button type='submit' loading={loading} disabled={!form.isValid()}>
          {t('common.button.create', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
