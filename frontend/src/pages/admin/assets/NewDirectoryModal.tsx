import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { join } from 'pathe';
import { z } from 'zod';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import Code from '@/elements/typography/Code.tsx';
import { assetDirectoryCreateSchema } from '@/lib/schemas/admin/assets.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface NewDirectoryModalProps extends Omit<ModalProps, 'onSubmit'> {
  currentDirectory: string;
  onNavigate: (dir: string) => void;
}

export default function NewDirectoryModal({ currentDirectory, onNavigate, ...props }: NewDirectoryModalProps) {
  const { t } = useTranslations();
  const { form, handleClose, handleSubmit, loading, isDirty } = useModalForm<
    z.infer<typeof assetDirectoryCreateSchema>
  >({
    initialValues: { name: '' },
    validate: zod4Resolver(assetDirectoryCreateSchema),
    onClose: props.onClose,
    onSubmit: async (values) => {
      onNavigate(join(currentDirectory, values.name));
    },
  });

  return (
    <FormModal
      title={t('pages.admin.assets.modal.createDirectory.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <TextInput
        withAsterisk
        label={t('common.form.directoryName', {})}
        data-autofocus
        {...form.getInputProps('name')}
      />

      <p className='mt-2 text-sm break-all'>
        <span>{t('pages.admin.assets.modal.createDirectory.createdAs', {})}</span>
        <Code>
          assets/
          <span className='text-cyan-200'>{join(currentDirectory, form.values.name)}</span>
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
