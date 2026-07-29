import { decode, encode } from '@msgpack/msgpack';
import { EventEmitter } from 'events';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export enum SocketState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  CLOSED = 'closed',
}

export enum SocketErrorType {
  CONNECTION_FAILED = 'connection_failed',
  CONNECTION_LOST = 'connection_lost',
  AUTH_FAILED = 'auth_failed',
  PERMISSION_DENIED = 'permission_denied',
  DAEMON_ERROR = 'daemon_error',
}

export interface SocketError {
  /** The category of error. */
  type: SocketErrorType;
  /** A human-readable message suitable for display in the UI. */
  message: string;
  /** Whether the socket will automatically attempt to recover from this. */
  recoverable: boolean;
  /** The current reconnect attempt number, if reconnecting. */
  reconnectAttempt: number;
  /** Approximate milliseconds until the next reconnect attempt, or null if not applicable. */
  nextRetryMs: number | null;
  /** The raw close code from the WebSocket, if available. */
  closeCode?: number;
  /** The raw close reason string from the WebSocket, if available. */
  closeReason?: string;
}

export class Websocket extends EventEmitter {
  private socket: WebSocket | null = null;
  private url: string | null = null;
  private token = '';
  private useBinary = false;

  private state: SocketState = SocketState.CLOSED;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionallyClosed = false;
  private hadSuccessfulConnection = false;
  private nextRetryMs: number | null = null;

  private readonly minBackoff = 1000;
  private readonly maxBackoff = 20000;
  private readonly maxReconnectAttempts = Infinity;

  /**
   * Returns the current connection state.
   */
  getState(): SocketState {
    return this.state;
  }

  /**
   * Connects to the websocket at the given URL.
   * If already connected or connecting, this is a no-op.
   */
  connect(url: string): this {
    if (this.state === SocketState.CONNECTED || this.state === SocketState.CONNECTING) {
      return this;
    }

    this.url = url;
    this.intentionallyClosed = false;
    this.createSocket();

    return this;
  }

  setToken(token: string, isUpdate = false): this {
    this.token = token;

    if (isUpdate && this.state === SocketState.CONNECTED) {
      this.authenticate();
    }

    return this;
  }

  setUseBinary(useBinary: boolean): this {
    this.useBinary = useBinary;
    return this;
  }

  authenticate(): void {
    if (this.token) {
      this.send('auth', this.token);
    }
  }

  /**
   * Intentionally closes the socket and stops all reconnection attempts.
   */
  close(code?: number, reason?: string): void {
    this.intentionallyClosed = true;
    this.clearReconnectTimer();
    this.destroySocket(code, reason);
    this.state = SocketState.CLOSED;
    this.url = null;
    this.token = '';
    this.reconnectAttempts = 0;
    this.hadSuccessfulConnection = false;
    this.nextRetryMs = null;
    this.removeAllListeners();
  }

  /**
   * Sends a message over the socket. Silently drops messages if not connected.
   */
  send(event: string, payload?: string | string[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const args = payload == null ? [] : Array.isArray(payload) ? payload : [payload];

    try {
      if (this.useBinary) {
        this.socket.send(encode([event, args]));
      } else {
        this.socket.send(JSON.stringify({ event, args }));
      }
    } catch (err) {
      console.warn('Failed to send websocket message.', err);
    }
  }

  private createSocket(): void {
    this.destroySocket();

    this.state = this.reconnectAttempts === 0 ? SocketState.CONNECTING : SocketState.RECONNECTING;

    try {
      this.socket = new WebSocket(this.url!);
    } catch (err) {
      console.warn('Failed to create WebSocket instance.', err);
      this.scheduleReconnect();
      return;
    }

    this.socket.binaryType = 'arraybuffer';

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.nextRetryMs = null;
      this.clearReconnectTimer();
      this.state = SocketState.CONNECTED;
      this.hadSuccessfulConnection = true;

      this.emit('SOCKET_ERROR_CLEAR');
      this.emit('SOCKET_OPEN');
      this.authenticate();
    };

    this.socket.onmessage = (e: MessageEvent) => {
      try {
        this.emit('SOCKET_MESSAGE', e);

        if (typeof e.data === 'string') {
          const { event, args } = JSON.parse(e.data) as { event: string; args: string[] };
          this.emit(event, ...args);
        } else if (e.data instanceof ArrayBuffer) {
          const [event, args] = decode(e.data) as [string, string[]];
          this.emit(event, ...args);
        }
      } catch (ex) {
        console.warn('Failed to parse incoming websocket message.', ex);
      }
    };

    this.socket.onclose = (e: CloseEvent) => {
      const wasConnected = this.state === SocketState.CONNECTED;
      this.state = SocketState.CLOSED;

      this.emit('SOCKET_CLOSE', e.reason);

      if (this.intentionallyClosed) {
        return;
      }

      if (e.reason === 'permission revoked') {
        this.emitError({
          type: SocketErrorType.PERMISSION_DENIED,
          message: getTranslations().t('elements.serverWebsocket.error.permissionRevoked', {}),
          recoverable: false,
          closeCode: e.code,
          closeReason: e.reason,
        });
        return;
      }

      const errorType =
        this.hadSuccessfulConnection || wasConnected
          ? SocketErrorType.CONNECTION_LOST
          : SocketErrorType.CONNECTION_FAILED;

      const message = wasConnected
        ? getTranslations().t('elements.serverWebsocket.error.connectionClosed', {})
        : getTranslations().t('elements.serverWebsocket.error.connectionRetry', {
            attempt: this.reconnectAttempts + 1,
          });

      if (wasConnected) {
        this.emit('SOCKET_RECONNECT');
      }

      this.scheduleReconnect();

      this.emitError({
        type: errorType,
        message,
        recoverable: true,
        closeCode: e.code,
        closeReason: e.reason,
      });
    };

    this.socket.onerror = () => {
      this.emit('SOCKET_ERROR');
    };
  }

  private destroySocket(code?: number, reason?: string): void {
    if (!this.socket) {
      return;
    }

    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onclose = null;
    this.socket.onerror = null;

    try {
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close(code, reason);
      }
    } catch {
      // ignore
    }

    this.socket = null;
  }

  private scheduleReconnect(): void {
    if (this.intentionallyClosed || !this.url) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max reconnect attempts reached. Giving up.');
      this.state = SocketState.CLOSED;
      this.nextRetryMs = null;
      this.emitError({
        type: SocketErrorType.CONNECTION_FAILED,
        message: getTranslations().t('elements.serverWebsocket.error.connectionFailed', {}),
        recoverable: false,
      });
      return;
    }

    this.clearReconnectTimer();

    const exponential = Math.min(this.minBackoff * Math.pow(2, this.reconnectAttempts), this.maxBackoff);
    const jitter = exponential * (0.75 + Math.random() * 0.5);
    const delay = Math.round(jitter);

    this.reconnectAttempts++;
    this.state = SocketState.RECONNECTING;
    this.nextRetryMs = delay;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.nextRetryMs = null;
      this.createSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emitError(fields: {
    type: SocketErrorType;
    message: string;
    recoverable: boolean;
    closeCode?: number;
    closeReason?: string;
  }): void {
    const error: SocketError = {
      type: fields.type,
      message: fields.message,
      recoverable: fields.recoverable,
      reconnectAttempt: this.reconnectAttempts,
      nextRetryMs: this.nextRetryMs,
      closeCode: fields.closeCode,
      closeReason: fields.closeReason,
    };

    this.emit('SOCKET_ERROR_STATE', error);
  }
}
