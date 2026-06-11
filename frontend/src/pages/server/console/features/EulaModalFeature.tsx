import { Text } from '@mantine/core';
import { useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import getFileContent from '@/api/server/files/getFileContent.ts';
import saveFileContent from '@/api/server/files/saveFileContent.ts';
import Button from '@/elements/Button.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import useWebsocketEvent, { SocketEvent } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function EulaModal() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, state, socketInstance } = useServerStore();

  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);

  useWebsocketEvent(SocketEvent.CONSOLE_OUTPUT, (line) => {
    if (line.includes('You need to agree to the EULA') && state !== 'running') {
      setOpened(true);
    }
  });

  const acceptEula = async () => {
    setLoading(true);

    try {
      let content: string;
      try {
        content = await getFileContent(server.uuid, '/eula.txt').then((c) => c.text());
      } catch {
        content = 'eula=false';
      }

      let updatedContent = content.replace(/eula\s*=\s*false/gi, 'eula=true');
      if (!updatedContent.includes('eula=true')) {
        updatedContent += 'eula=true\n';
      }
      await saveFileContent(server.uuid, '/eula.txt', updatedContent);

      addToast(t('pages.server.console.feature.eula.toast.accepted', {}), 'success');
      setOpened(false);

      socketInstance?.send('set state', 'restart');
    } catch (error) {
      addToast(httpErrorToHuman(error as object), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={t('pages.server.console.feature.eula.title', {})} opened={opened} onClose={() => setOpened(false)}>
      <Text size='sm' mb='md'>
        {t('pages.server.console.feature.eula.content', {}).md()}
      </Text>
      <Text size='sm' mb='md'>
        {t('pages.server.console.feature.eula.contentDetails', {}).md()}
      </Text>

      <ModalFooter>
        <Button color='green' loading={loading} onClick={acceptEula}>
          {t('pages.server.console.feature.eula.button.accept', {})}
        </Button>
        <Button variant='default' onClick={() => setOpened(false)}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
