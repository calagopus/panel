import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import getServer from '@/api/server/getServer.ts';
import useWebsocketEvent, { SocketEvent } from '@/plugins/useWebsocketEvent.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';

export default function useServerTransferSocket() {
  const serverStoreApi = useServerStoreApi();
  const { t } = useTranslations();
  const { addToast } = useToast();
  const socketInstance = useServerStore((state) => state.socketInstance);
  const { updateServer, setSocketConnectionState, setSocketError, setTransferProgress } = useServerStore(
    useShallow((state) => ({
      updateServer: state.updateServer,
      setSocketConnectionState: state.setSocketConnectionState,
      setSocketError: state.setSocketError,
      setTransferProgress: state.setTransferProgress,
    })),
  );

  const transferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (transferTimeoutRef.current !== null) clearTimeout(transferTimeoutRef.current);
    };
  }, []);

  useWebsocketEvent(SocketEvent.TRANSFER_STATUS, (s) => {
    if (s === 'processing') {
      updateServer({ isTransferring: true });
    } else if (s === 'completed') {
      if (socketInstance) {
        socketInstance.close();
        setSocketConnectionState(false);
        setSocketError(null);
      }
      if (transferTimeoutRef.current !== null) clearTimeout(transferTimeoutRef.current);
      transferTimeoutRef.current = setTimeout(() => {
        transferTimeoutRef.current = null;
        getServer(serverStoreApi.getState().server.uuid)
          .then((data) => {
            updateServer(data);
            updateServer({ isTransferring: false });
          })
          .catch((e) => console.error(e));
      }, 5000);
    } else if (s === 'failure') {
      if (transferTimeoutRef.current !== null) {
        clearTimeout(transferTimeoutRef.current);
        transferTimeoutRef.current = null;
      }

      updateServer({ isTransferring: false });
      setTransferProgress(0, 0, 0, 0);
      addToast(t('elements.serverWebsocket.listener.toast.transferFailed', {}), 'error');

      getServer(serverStoreApi.getState().server.uuid)
        .then((data) => {
          updateServer(data);
          updateServer({ isTransferring: false });
        })
        .catch((e) => console.error(e));
    }
  });

  useWebsocketEvent(SocketEvent.TRANSFER_PROGRESS, (data) => {
    updateServer({ isTransferring: true });

    let wsData: {
      archive_bytes_processed: number;
      network_bytes_processed: number;
      bytes_total: number;
      files_processed: number;
    };
    try {
      wsData = JSON.parse(data);
    } catch {
      return;
    }

    setTransferProgress(
      wsData.archive_bytes_processed,
      wsData.network_bytes_processed,
      wsData.bytes_total,
      wsData.files_processed,
    );
  });
}
