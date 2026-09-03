import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import importDatabaseInstance from '@/api/server/databases/instances/importDatabaseInstance.ts';
import Button from '@/elements/buttons/Button.tsx';
import FileInput from '@/elements/input/FileInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
};

export default function DatabaseInstanceImportModal({ instance, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const [file, setFile] = useState<File | null>(null);
  const [wipe, setWipe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    if (loading) {
      return;
    }

    setFile(null);
    setWipe(false);
    props.onClose();
  };

  const doImport = () => {
    if (!file) {
      return;
    }

    setLoading(true);

    importDatabaseInstance(server.uuid, instance.uuid, file, wipe)
      .then(() => {
        addToast(t('pages.server.databases.instance.databases.toast.imported', {}), 'success');
        setFile(null);
        setWipe(false);
        props.onClose();
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.databases.instance.modal.importInstance.title', {})} {...props} onClose={handleClose}>
      <Stack>
        <Text c='dimmed' size='sm'>
          {t('pages.server.databases.instance.modal.importInstance.content', {})}
        </Text>

        <FileInput
          withAsterisk
          label={t('pages.server.databases.instance.databases.modal.importDatabase.form.file', {})}
          value={file}
          onChange={setFile}
          clearable
        />

        <Switch
          label={t('pages.server.databases.instance.modal.importInstance.form.wipe', {})}
          name='wipe'
          checked={wipe}
          onChange={(e) => setWipe(e.target.checked)}
        />

        <ModalFooter>
          <Button color={wipe ? 'red' : undefined} onClick={doImport} loading={loading} disabled={!file}>
            {t('common.button.import', {})}
          </Button>
          <Button variant='default' onClick={handleClose} disabled={loading}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
