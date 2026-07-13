import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import exportDatabaseInstanceDatabase from '@/api/server/databases/instances/exportDatabaseInstanceDatabase.ts';
import Button from '@/elements/Button.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import {
  serverDatabaseInstanceDatabaseSchema,
  serverDatabaseInstanceSchema,
} from '@/lib/schemas/server/databaseInstances.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
  database: z.infer<typeof serverDatabaseInstanceDatabaseSchema>;
};

export default function DatabaseInstanceDatabaseExportModal({ instance, database, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const [loading, setLoading] = useState(false);

  const doExport = () => {
    setLoading(true);

    exportDatabaseInstanceDatabase(server.uuid, instance.uuid, database.uuid)
      .then(({ blob, filename }) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename ?? `${database.name}.dump`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        props.onClose();
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.databases.instance.databases.modal.exportDatabase.title', {})} {...props}>
      <Stack>
        <Text c='dimmed' size='sm'>
          {t('pages.server.databases.instance.databases.modal.exportDatabase.content', {})}
        </Text>

        <ModalFooter>
          <Button onClick={doExport} loading={loading}>
            {t('pages.server.databases.instance.databases.button.export', {})}
          </Button>
          <Button variant='default' onClick={props.onClose} disabled={loading}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
