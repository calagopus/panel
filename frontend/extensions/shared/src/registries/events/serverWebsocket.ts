import { CancellableEvent, EventHandler, EventHandlerList, EventHandlerOptions, Registry } from 'shared';
import type { Websocket } from '@/plugins/websocket/Websocket.ts';

export { binaryArg, structuredArg } from '@/plugins/websocket/args.ts';

/**
 * Arguments are strings, except where wings sends structured or binary data: in `msgpack`
 * transmission mode those arrive as values and `Uint8Array`s, otherwise as JSON and base64
 * strings. Read them through `structuredArg` and `binaryArg` to handle both.
 */
export interface ServerWebsocketFrame {
  event: string;
  args: unknown[];
}

export const serverWebsocketProtocolEvents: ReadonlySet<string> = new Set([
  'auth',
  'auth success',
  'token expiring',
  'token expired',
  'jwt error',
  'configure socket',
  'socket configured',
]);

export class ServerWebsocketMessageEvent extends CancellableEvent<ServerWebsocketFrame> {
  constructor(
    public readonly serverUuid: string,
    public readonly socket: Websocket,
    data: ServerWebsocketFrame,
  ) {
    super(data);
  }
}

export class ServerWebsocketSendEvent extends CancellableEvent<ServerWebsocketFrame> {
  constructor(
    public readonly serverUuid: string,
    public readonly socket: Websocket,
    data: ServerWebsocketFrame,
  ) {
    super(data);
  }
}

export class ServerWebsocketEventRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.messageHandlers.mergeFrom(other.messageHandlers);
    this.sendHandlers.mergeFrom(other.sendHandlers);

    return this;
  }

  /**
   * Incoming frames, protocol events skip handlers, cancelling drops the frame before any listener.
   * @since 1.2.6
   */
  public messageHandlers: EventHandlerList<ServerWebsocketMessageEvent> = new EventHandlerList();
  /**
   * Outgoing frames, protocol events skip handlers, cancelling keeps the frame from being sent.
   * @since 1.2.6
   */
  public sendHandlers: EventHandlerList<ServerWebsocketSendEvent> = new EventHandlerList();

  /** @since 1.2.6 */
  public addMessageHandler(handler: EventHandler<ServerWebsocketMessageEvent>, options?: EventHandlerOptions): this {
    this.messageHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeMessageHandler(handler: EventHandler<ServerWebsocketMessageEvent>): this {
    this.messageHandlers.removeHandler(handler);
    return this;
  }

  /** @since 1.2.6 */
  public addSendHandler(handler: EventHandler<ServerWebsocketSendEvent>, options?: EventHandlerOptions): this {
    this.sendHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeSendHandler(handler: EventHandler<ServerWebsocketSendEvent>): this {
    this.sendHandlers.removeHandler(handler);
    return this;
  }
}
