import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { httpErrorToHuman } from '@/api/axios.ts';
import updateDockerImage from '@/api/server/startup/updateDockerImage.ts';
import Button from '@/elements/Button.tsx';
import { ServerCan } from '@/elements/Can.tsx';
import Select from '@/elements/input/Select.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/Text.tsx';
import useWebsocketEvent, { SocketEvent } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

const MATCHERS: (string | RegExp)[] = [
  'java.lang.unsupportedclassversionerror',
  'unsupported major.minor version',
  'has been compiled by a more recent version of the java runtime',
  /requires running the server with java \d+ or above/i,
];

const matchesLine = (line: string): boolean => {
  const normalized = line.toLowerCase();

  return MATCHERS.some((matcher) =>
    typeof matcher === 'string' ? normalized.includes(matcher.toLowerCase()) : matcher.test(line),
  );
};

const OFFLINE_GRACE_MS = 5000;

export default function JavaVersionModal() {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server, state, socketInstance, updateServer } = useServerStore(
    useShallow((s) => ({
      server: s.server,
      state: s.state,
      socketInstance: s.socketInstance,
      updateServer: s.updateServer,
    })),
  );

  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(server.image);
  const lastMatchAt = useRef<number | null>(null);

  useWebsocketEvent(SocketEvent.CONSOLE_OUTPUT, (line) => {
    if (state !== 'running' && matchesLine(line)) {
      lastMatchAt.current = Date.now();
    }
  });

  useEffect(() => {
    if (state !== 'offline') {
      if (state === 'running') {
        lastMatchAt.current = null;
      }
      return;
    }

    if (lastMatchAt.current !== null && Date.now() - lastMatchAt.current <= OFFLINE_GRACE_MS) {
      lastMatchAt.current = null;
      setOpened(true);
    }
  }, [state]);

  useEffect(() => {
    if (opened) {
      setSelectedImage(Object.values(server.egg.dockerImages)[0] ?? server.image);
    }
  }, [opened]);

  const updateImage = async () => {
    setLoading(true);

    try {
      await updateDockerImage(server.uuid, selectedImage);
      updateServer({ image: selectedImage });

      addToast(t('pages.server.console.feature.javaVersion.toast.updated', {}), 'success');
      setOpened(false);

      if (state === 'offline') {
        socketInstance?.send('set state', 'restart');
      }
    } catch (error) {
      addToast(httpErrorToHuman(error as object), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('pages.server.console.feature.javaVersion.title', {})}
      opened={opened}
      onClose={() => setOpened(false)}
    >
      <Text size='sm' mb='md'>
        {t('pages.server.console.feature.javaVersion.content', {}).md()}
      </Text>

      <ServerCan action='startup.docker-image'>
        <Text size='sm' mb='md'>
          {t('pages.server.console.feature.javaVersion.contentDetails', {}).md()}
        </Text>

        <Select
          label={t('common.form.dockerImage', {})}
          value={selectedImage}
          onChange={(value) => setSelectedImage(value ?? '')}
          data={Object.entries(server.egg.dockerImages).map(([key, value]) => ({
            value,
            label: key,
          }))}
          searchable
        />
      </ServerCan>

      <ModalFooter>
        <ServerCan action='startup.docker-image'>
          <Button color='green' loading={loading} disabled={!selectedImage} onClick={updateImage}>
            {t('pages.server.console.feature.javaVersion.button.update', {})}
          </Button>
        </ServerCan>
        <Button variant='default' onClick={() => setOpened(false)}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
