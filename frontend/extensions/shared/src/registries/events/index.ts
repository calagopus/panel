import { Registry } from 'shared';
import { ApiEventRegistry } from './api.ts';
import { AuthEventRegistry } from './auth.ts';
import { ClipboardEventRegistry } from './clipboard.ts';
import { QuickActionEventRegistry } from './quickActions.ts';
import { ServerWebsocketEventRegistry } from './serverWebsocket.ts';
import { ToastEventRegistry } from './toast.ts';

export class EventRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.toast.mergeFrom(other.toast);
    this.serverWebsocket.mergeFrom(other.serverWebsocket);
    this.api.mergeFrom(other.api);
    this.auth.mergeFrom(other.auth);
    this.clipboard.mergeFrom(other.clipboard);
    this.quickActions.mergeFrom(other.quickActions);

    return this;
  }

  /** @since 1.2.6 */
  public toast: ToastEventRegistry = new ToastEventRegistry();
  /** @since 1.2.6 */
  public serverWebsocket: ServerWebsocketEventRegistry = new ServerWebsocketEventRegistry();
  /** @since 1.2.6 */
  public api: ApiEventRegistry = new ApiEventRegistry();
  /** @since 1.2.6 */
  public auth: AuthEventRegistry = new AuthEventRegistry();
  /** @since 1.2.6 */
  public clipboard: ClipboardEventRegistry = new ClipboardEventRegistry();
  /** @since 1.2.6 */
  public quickActions: QuickActionEventRegistry = new QuickActionEventRegistry();

  /** @since 1.2.6 */
  public enterToast(callback: (registry: ToastEventRegistry) => unknown): this {
    callback(this.toast);
    return this;
  }

  /** @since 1.2.6 */
  public enterServerWebsocket(callback: (registry: ServerWebsocketEventRegistry) => unknown): this {
    callback(this.serverWebsocket);
    return this;
  }

  /** @since 1.2.6 */
  public enterApi(callback: (registry: ApiEventRegistry) => unknown): this {
    callback(this.api);
    return this;
  }

  /** @since 1.2.6 */
  public enterAuth(callback: (registry: AuthEventRegistry) => unknown): this {
    callback(this.auth);
    return this;
  }

  /** @since 1.2.6 */
  public enterClipboard(callback: (registry: ClipboardEventRegistry) => unknown): this {
    callback(this.clipboard);
    return this;
  }

  /** @since 1.2.6 */
  public enterQuickActions(callback: (registry: QuickActionEventRegistry) => unknown): this {
    callback(this.quickActions);
    return this;
  }
}

export * from './api.ts';
export * from './auth.ts';
export * from './clipboard.ts';
export * from './quickActions.ts';
export * from './serverWebsocket.ts';
export * from './toast.ts';
