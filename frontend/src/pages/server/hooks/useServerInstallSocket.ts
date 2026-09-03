import { useEffect } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import { serverImagePullProgressSchema, serverInstallProgressSchema } from '@/lib/schemas/server/server.ts';
import useWebsocketEvent, { SocketEvent } from '@/plugins/websocket/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';

export default function useServerInstallSocket() {
  const serverStoreApi = useServerStoreApi();
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { updateServer, setInstallProgress, setImagePull, removeImagePull, clearImagePulls } = useServerStore(
    useShallow((state) => ({
      updateServer: state.updateServer,
      setInstallProgress: state.setInstallProgress,
      setImagePull: state.setImagePull,
      removeImagePull: state.removeImagePull,
      clearImagePulls: state.clearImagePulls,
    })),
  );

  useEffect(() => {
    return () => {
      clearImagePulls();
    };
  }, [clearImagePulls]);

  useWebsocketEvent(SocketEvent.IMAGE_PULL_PROGRESS, (id, data) => {
    let wsData: z.infer<typeof serverImagePullProgressSchema>;
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    setImagePull(id, wsData);
  });

  useWebsocketEvent(SocketEvent.IMAGE_PULL_COMPLETED, (id) => {
    removeImagePull(id);
  });

  useWebsocketEvent(SocketEvent.INSTALL_STARTED, () => {
    setInstallProgress(null);
    updateServer({ status: 'installing' });
  });

  useWebsocketEvent(SocketEvent.INSTALL_PROGRESS, (data) => {
    let wsData: z.infer<typeof serverInstallProgressSchema>;
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    if (serverStoreApi.getState().server.status !== 'installing') {
      updateServer({ status: 'installing' });
    }

    setInstallProgress(wsData);
  });

  useWebsocketEvent(SocketEvent.INSTALL_COMPLETED, (successful) => {
    setInstallProgress(null);
    updateServer({ status: successful === 'true' ? null : 'install_failed' });

    if (successful === 'true') {
      addToast(t('elements.serverWebsocket.listener.toast.installCompleted', {}), 'success');
    } else {
      addToast(t('elements.serverWebsocket.listener.toast.installFailed', {}), 'error');
    }
  });
}
