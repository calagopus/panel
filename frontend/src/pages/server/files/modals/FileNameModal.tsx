import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverFilesNameSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  onFileName: (name: string) => void;
};

export default function FileNameModal({ onFileName, opened, onClose }: Props) {
  const { t } = useTranslations();

  const { form, handleClose, handleSubmit, isDirty, loading } = useModalForm<z.infer<typeof serverFilesNameSchema>>({
    initialValues: {
      name: '',
    },
    validate: zod4Resolver(serverFilesNameSchema),
    onClose,
    onSubmit: async (values) => {
      onFileName(values.name);
    },
  });

  return (
    <FormModal
      title={t('pages.server.files.modal.createFile.title', {})}
      onClose={handleClose}
      onSubmit={handleSubmit}
      isDirty={isDirty}
      loading={loading}
      opened={opened}
    >
      <TextInput
        withAsterisk
        label={t('pages.server.files.modal.createFile.form.fileName', {})}
        placeholder={t('pages.server.files.modal.createFile.form.fileName', {})}
        data-autofocus
        {...form.getInputProps('name')}
      />

      <ModalFooter>
        <Button type='submit' disabled={!form.isValid()}>
          {t('common.button.create', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
