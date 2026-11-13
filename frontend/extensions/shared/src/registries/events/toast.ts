import { CancellableEvent, EventHandler, EventHandlerList, EventHandlerOptions, Registry } from 'shared';
import type { Toast, ToastUpdate } from '@/providers/contexts/toastContext.ts';

export type ToastShowData = Omit<Toast, 'id'>;

export class ToastShowEvent extends CancellableEvent<ToastShowData> {
  constructor(
    public readonly id: number,
    // `progress` toasts come from `addProgressToast` and are not dismissed automatically
    public readonly kind: 'toast' | 'progress',
    data: ToastShowData,
  ) {
    super(data);
  }
}

export class ToastUpdateEvent extends CancellableEvent<ToastUpdate> {
  constructor(
    public readonly id: number,
    public readonly toast: Readonly<Toast>,
    data: ToastUpdate,
  ) {
    super(data);
  }
}

export type ToastDismissReason = 'timeout' | 'close' | 'programmatic';

/**
 * Cancelling a dismiss keeps the toast on screen, including when the reason is `timeout`.
 * The toast then stays until it is dismissed again, so make sure something eventually does.
 */
export class ToastDismissEvent extends CancellableEvent<void> {
  constructor(
    public readonly id: number,
    public readonly toast: Readonly<Toast>,
    public readonly reason: ToastDismissReason,
  ) {
    super(undefined);
  }
}

export class ToastEventRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.showHandlers.mergeFrom(other.showHandlers);
    this.updateHandlers.mergeFrom(other.updateHandlers);
    this.dismissHandlers.mergeFrom(other.dismissHandlers);

    return this;
  }

  /**
   * Mutate `data` to change the toast, cancelling never shows it.
   * @since 1.2.6
   */
  public showHandlers: EventHandlerList<ToastShowEvent> = new EventHandlerList();
  /**
   * `data` is the patch about to be applied, cancelling drops it.
   * @since 1.2.6
   */
  public updateHandlers: EventHandlerList<ToastUpdateEvent> = new EventHandlerList();
  /**
   * Cancelling keeps the toast on screen.
   * @since 1.2.6
   */
  public dismissHandlers: EventHandlerList<ToastDismissEvent> = new EventHandlerList();

  /** @since 1.2.6 */
  public addShowHandler(handler: EventHandler<ToastShowEvent>, options?: EventHandlerOptions): this {
    this.showHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeShowHandler(handler: EventHandler<ToastShowEvent>): this {
    this.showHandlers.removeHandler(handler);
    return this;
  }

  /** @since 1.2.6 */
  public addUpdateHandler(handler: EventHandler<ToastUpdateEvent>, options?: EventHandlerOptions): this {
    this.updateHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeUpdateHandler(handler: EventHandler<ToastUpdateEvent>): this {
    this.updateHandlers.removeHandler(handler);
    return this;
  }

  /** @since 1.2.6 */
  public addDismissHandler(handler: EventHandler<ToastDismissEvent>, options?: EventHandlerOptions): this {
    this.dismissHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeDismissHandler(handler: EventHandler<ToastDismissEvent>): this {
    this.dismissHandlers.removeHandler(handler);
    return this;
  }
}
