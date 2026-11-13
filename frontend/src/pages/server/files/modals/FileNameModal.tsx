import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { basename, dirname, join } from 'pathe';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import statFiles from '@/api/server/files/statFiles.ts';
import Button from '@/elements/buttons/Button.tsx';
import Alert from '@/elements/feedback/Alert.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverFilesNameSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/form/useModalForm.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  onFileName: (name: string) => Promise<void> | void;
  directory?: string;
};

const OVERWRITE_REQUIRED = Symbol('overwriteRequired');

export default function FileNameModal({ onFileName, directory, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const serverUuid = useServerStore((state) => state.server.uuid);
  const [overwriteName, setOverwriteName] = useState<string | null>(null);

  const fileExists = async (name: string) => {
    if (directory === undefined) return false;
    const target = join(directory, name);
    try {
      const entries = await statFiles(serverUuid, dirname(target), [basename(target)]);
      return entries.some((entry) => entry.name === basename(target));
    } catch {
      return false;
    }
  };

  const { form, handleClose, handleSubmit, isDirty, loading } = useModalForm<z.infer<typeof serverFilesNameSchema>>({
    initialValues: {
      name: '',
    },
    schema: serverFilesNameSchema,
    onClose: () => {
      setOverwriteName(null);
      props.onClose();
    },
    onSubmit: async (values) => {
      if (overwriteName !== values.name && (await fileExists(values.name))) {
        setOverwriteName(values.name);
        throw OVERWRITE_REQUIRED;
      }
      await onFileName(values.name);
    },
    onError: (error) => {
      if (error !== OVERWRITE_REQUIRED) addToast(httpErrorToHuman(error), 'error');
    },
  });

  const overwriting = overwriteName !== null && overwriteName === form.values.name;

  return (
    <FormModal
      title={t('pages.server.files.modal.createFile.title', {})}
      isDirty={isDirty}
      loading={loading}
      {...props}
      onClose={handleClose}
      onSubmit={handleSubmit}
    >
      <TextInput withAsterisk label={t('common.form.fileName', {})} data-autofocus {...form.getInputProps('name')} />

      {overwriting && (
        <Alert mt='sm' color='yellow' icon={<FontAwesomeIcon icon={faTriangleExclamation} />}>
          {t('pages.server.files.modal.createFile.overwriteWarning', { file: overwriteName })}
        </Alert>
      )}

      <ModalFooter>
        <Button type='submit' color={overwriting ? 'red' : undefined} disabled={!form.isValid()}>
          {overwriting ? t('pages.server.files.modal.createFile.overwrite', {}) : t('common.button.create', {})}
        </Button>
        <Button variant='default' onClick={handleClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
