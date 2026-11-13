import { decode, encode } from '@msgpack/msgpack';
import { EventEmitter } from 'events';
import {
  ServerWebsocketFrame,
  ServerWebsocketMessageEvent,
  ServerWebsocketSendEvent,
  serverWebsocketProtocolEvents,
} from 'shared';
import { toBase64 } from '@/plugins/websocket/args.ts';
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
  /** Manually restarts the connection, offered for errors that are not recovered automatically. */
  retry?: () => void;
}

const MSGPACK_PROBE = 'msgpack-probe';
const NEGOTIATION_TIMEOUT_MS = 10000;

type TransmissionMode = 'unconfigured' | 'negotiating' | 'msgpack' | 'binary';

function isForwardableFrame(frame: ServerWebsocketFrame): boolean {
  return (
    typeof frame.event === 'string' && Array.isArray(frame.args) && !serverWebsocketProtocolEvents.has(frame.event)
  );
}

export class Websocket extends EventEmitter {
  private socket: WebSocket | null = null;
  private url: string | null = null;
  private token = '';
  private authGapped = false;
  private useBinary = false;
  private transmissionMode: TransmissionMode = 'unconfigured';
  private negotiationTimer: ReturnType<typeof setTimeout> | null = null;
  private heldFrames: ServerWebsocketFrame[] = [];

  private state: SocketState = SocketState.CLOSED;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionallyClosed = false;
  private hadSuccessfulConnection = false;
  private nextRetryMs: number | null = null;

  private readonly minBackoff = 1000;
  private readonly maxBackoff = 20000;
  private readonly maxReconnectAttempts = Infinity;

  constructor(public readonly serverUuid: string) {
    super();
  }

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
    this.resetTransmissionMode();
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
   * Clears the auth gap before listeners run, so a listener reacting to 'auth success' can
   * send without depending on the order handlers were registered in.
   */
  private dispatch(event: string, args: unknown[]): void {
    if (event === 'auth success') {
      this.authGapped = false;
      if (this.transmissionMode === 'unconfigured') {
        this.negotiateTransmissionMode();
      }
    } else if (event === 'socket configured') {
      if (this.transmissionMode === 'negotiating' && args[0] === 'transmission mode' && args[1] === 'msgpack') {
        this.resolveTransmissionMode('msgpack');
      }
    } else if (event === 'pong' && args[0] === MSGPACK_PROBE) {
      if (this.transmissionMode === 'negotiating') {
        this.fallBackTransmissionMode();
      }
      return;
    }

    const handlers = window.extensionContext.extensionRegistry.events.serverWebsocket.messageHandlers;
    if (serverWebsocketProtocolEvents.has(event) || handlers.handlers.length === 0) {
      this.emit(event, ...args);
      return;
    }

    const message = handlers.emit(new ServerWebsocketMessageEvent(this.serverUuid, this, { event, args: [...args] }));
    if (message.cancelled || !isForwardableFrame(message.data)) {
      return;
    }

    this.emit(message.data.event, ...message.data.args);
  }

  private negotiateTransmissionMode(): void {
    this.transmissionMode = 'negotiating';
    this.sendFrame({ event: 'configure socket', args: ['transmission mode', 'msgpack'] });
    this.sendFrame({ event: 'ping', args: [MSGPACK_PROBE] });

    this.negotiationTimer = setTimeout(() => {
      this.negotiationTimer = null;
      if (this.transmissionMode === 'negotiating') {
        this.fallBackTransmissionMode();
      }
    }, NEGOTIATION_TIMEOUT_MS);
  }

  private fallBackTransmissionMode(): void {
    this.sendFrame({ event: 'configure socket', args: ['transmission mode', 'binary'] });
    this.resolveTransmissionMode('binary');
  }

  private resolveTransmissionMode(mode: 'msgpack' | 'binary'): void {
    if (this.negotiationTimer !== null) {
      clearTimeout(this.negotiationTimer);
      this.negotiationTimer = null;
    }

    this.transmissionMode = mode;

    const held = this.heldFrames;
    this.heldFrames = [];
    for (const frame of held) {
      this.sendFrame(frame);
    }
  }

  private resetTransmissionMode(): void {
    if (this.negotiationTimer !== null) {
      clearTimeout(this.negotiationTimer);
      this.negotiationTimer = null;
    }

    this.transmissionMode = 'unconfigured';
    this.heldFrames = [];
  }

  private interceptSend(event: string, args: unknown[]): ServerWebsocketFrame | null {
    const handlers = window.extensionContext.extensionRegistry.events.serverWebsocket.sendHandlers;
    if (serverWebsocketProtocolEvents.has(event) || handlers.handlers.length === 0) {
      return { event, args };
    }

    const send = handlers.emit(new ServerWebsocketSendEvent(this.serverUuid, this, { event, args: [...args] }));
    if (send.cancelled || !isForwardableFrame(send.data)) {
      return null;
    }

    return send.data;
  }

  /**
   * Marks the socket as having a stale token. Wings rejects and discards every non-auth
   * frame in this state, and closes the connection outright once it drops the jwt, so
   * frames are held back until the refreshed token is accepted.
   */
  setAuthGapped(gapped: boolean): void {
    this.authGapped = gapped;
  }

  /**
   * Sends a message over the socket. Silently drops messages if not connected.
   */
  send(event: string, payload?: string | unknown[]): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (this.authGapped && event !== 'auth') {
      return;
    }

    const frame = this.interceptSend(event, payload == null ? [] : Array.isArray(payload) ? payload : [payload]);
    if (!frame) {
      return;
    }

    // wings decodes binary arguments by the mode it is in when the frame arrives, so frames
    // carrying them wait until it is settled
    if (this.transmissionMode === 'negotiating' && frame.args.some((arg) => arg instanceof Uint8Array)) {
      this.heldFrames.push(frame);
      return;
    }

    this.sendFrame(frame);
  }

  private sendFrame(frame: ServerWebsocketFrame): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const args =
      this.transmissionMode === 'msgpack'
        ? frame.args
        : frame.args.map((arg) => (arg instanceof Uint8Array ? toBase64(arg) : arg));

    try {
      if (this.useBinary) {
        this.socket.send(encode([frame.event, args]));
      } else {
        this.socket.send(JSON.stringify({ event: frame.event, args }));
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
      this.resetTransmissionMode();
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
          const { event, args } = JSON.parse(e.data) as { event: string; args: unknown[] };
          this.dispatch(event, args);
        } else if (e.data instanceof ArrayBuffer) {
          const [event, args] = decode(e.data) as [string, unknown[]];
          this.dispatch(event, args);
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
