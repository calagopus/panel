import { ModalProps } from '@mantine/core';
import { useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import exportDatabaseInstance from '@/api/server/databases/instances/exportDatabaseInstance.ts';
import Button from '@/elements/Button.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
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
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename ?? `${instance.name}.dump`;
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
    <Modal title={t('pages.server.databases.instance.modal.exportInstance.title', {})} {...props}>
      <Stack>
        <Text c='dimmed' size='sm'>
          {t('pages.server.databases.instance.modal.exportInstance.content', {})}
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
