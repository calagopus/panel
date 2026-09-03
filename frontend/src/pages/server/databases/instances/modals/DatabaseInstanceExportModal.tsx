import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import exportDatabaseInstance from '@/api/server/databases/instances/exportDatabaseInstance.ts';
import Button from '@/elements/buttons/Button.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { downloadBlob } from '@/lib/download/download.ts';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

type Props = ModalProps & {
  instance: z.infer<typeof serverDatabaseInstanceSchema>;
};

export default function DatabaseInstanceExportModal({ instance, ...props }: Props) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);

  const [loading, setLoading] = useState(false);

  const doExport = () => {
    setLoading(true);

    exportDatabaseInstance(server.uuid, instance.uuid)
      .then(({ blob, filename }) => {
        downloadBlob(blob, filename ?? `${instance.name}.dump`);

        props.onClose();
      })
      .catch((msg) => addToast(httpErrorToHuman(msg), 'error'))
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.databases.instance.modal.exportInstance.title', {})} {...props}>
      <Stack>
        <Text c='dimmed' size='sm'>
          {t('pages.server.databases.instance.modal.exportInstance.content', {})}
        </Text>

        <ModalFooter>
          <Button onClick={doExport} loading={loading}>
            {t('common.button.export', {})}
          </Button>
          <Button variant='default' onClick={props.onClose} disabled={loading}>
            {t('common.button.close', {})}
          </Button>
        </ModalFooter>
      </Stack>
    </Modal>
  );
}
