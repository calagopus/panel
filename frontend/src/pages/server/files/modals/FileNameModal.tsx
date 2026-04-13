import { ModalProps } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import Button from '@/elements/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverFilesNameSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

type Props = ModalProps & {
  onFileName: (name: string) => void;
};

export default function FileNameModal({ onFileName, opened, onClose }: Props) {
  const { t } = useTranslations();

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverFilesNameSchema>>(
    {
      initialValues: {
        name: '',
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverFilesNameSchema),
    },
    onClose,
  );

  return (
    <Modal title={t('pages.server.files.modal.createFile.title', {})} onClose={handleClose} opened={opened}>
      <form onSubmit={form.onSubmit(() => onFileName(form.values.name))}>
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
      </form>
    </Modal>
  );
}
