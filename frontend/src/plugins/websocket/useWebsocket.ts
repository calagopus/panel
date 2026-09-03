import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { safeParseFromApi } from '@/lib/serialization/api-transform.ts';

interface WebsocketOptions {
  path: string;
  params?: Record<string, string>;
  enabled?: boolean;
  reconnectDelay?: number | null;
  onMessage: (data: string) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onConnectionLost?: () => void;
}

type SchemaOptions<T extends z.ZodTypeAny> = Omit<WebsocketOptions, 'onMessage'> & {
  schema: T;
  onMessage: (data: z.infer<T>) => void;
};

interface WebsocketHandle {
  connected: boolean;
  send: (data: string) => void;
}

export function useWebsocket(options: WebsocketOptions & { schema?: undefined }): WebsocketHandle;
export function useWebsocket<T extends z.ZodTypeAny>(options: SchemaOptions<T>): WebsocketHandle;

export function useWebsocket<T extends z.ZodTypeAny>(
  options: (WebsocketOptions & { schema?: undefined }) | SchemaOptions<T>,
): WebsocketHandle {
  const { path, params, enabled = true, reconnectDelay = null, schema } = options;

  const [connected, setConnected] = useState(false);

  const handlers = useRef(options);

  useEffect(() => {
    handlers.current = options;
  });

  const openSocket = useRef<WebSocket | null>(null);

  const serializedParams = params ? new URLSearchParams(params).toString() : '';

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let socketRef: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;
    let lossNotified = false;
    let lastSchemaError: string | null = null;

    const connect = () => {
      if (destroyed) {
        return;
      }

      const url = new URL(path, window.location.origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.search = serializedParams;

      const socket = new WebSocket(url);
      socketRef = socket;

      socket.onopen = () => {
        if (destroyed || socket !== socketRef) {
          return;
        }

        openSocket.current = socket;
        setConnected(true);
        handlers.current.onOpen?.();
      };

      socket.onmessage = (event) => {
        if (destroyed || socket !== socketRef || typeof event.data !== 'string') {
          return;
        }

        if (!schema) {
          lossNotified = false;
          (handlers.current as WebsocketOptions).onMessage(event.data);
          return;
        }

        let raw: unknown;
        try {
          raw = JSON.parse(event.data);
        } catch {
          return;
        }

        const result = safeParseFromApi(schema, raw);
        if (!result.success) {
          // A drifted schema fails every frame, so only report when the failure itself changes
          if (result.message !== lastSchemaError) {
            lastSchemaError = result.message;
            console.error(result.message, '\nfull frame:', raw);
          }
          return;
        }

        lastSchemaError = null;
        lossNotified = false;
        (handlers.current as SchemaOptions<T>).onMessage(result.data);
      };

      socket.onclose = (event) => {
        if (destroyed || socket !== socketRef) {
          return;
        }

        socketRef = null;
        openSocket.current = null;
        setConnected(false);
        handlers.current.onClose?.(event);

        if (event.wasClean) {
          return;
        }

        if (!lossNotified) {
          lossNotified = true;
          handlers.current.onConnectionLost?.();
        }

        if (reconnectDelay !== null) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, reconnectDelay);
        }
      };
    };

    connect();

    return () => {
      destroyed = true;
      setConnected(false);

      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }

      socketRef?.close();
      socketRef = null;
      openSocket.current = null;
    };
  }, [path, serializedParams, enabled, reconnectDelay, schema]);

  const send = useCallback((data: string) => {
    if (openSocket.current?.readyState === WebSocket.OPEN) {
      openSocket.current.send(data);
    }
  }, []);

  return { connected, send };
}
