import { CancellableEvent, EventHandler, EventHandlerList, EventHandlerOptions, Registry } from 'shared';

export class ClipboardCancelledError extends Error {
  constructor() {
    super('Clipboard operation cancelled by an extension');
    this.name = 'ClipboardCancelledError';
  }
}

export class ClipboardCopyEvent extends CancellableEvent<string> {}
export class ClipboardPasteEvent extends CancellableEvent<string> {}

export class ClipboardEventRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.copyHandlers.mergeFrom(other.copyHandlers);
    this.pasteHandlers.mergeFrom(other.pasteHandlers);

    return this;
  }

  /**
   * Mutate `data` to change the copied text, cancelling aborts the copy silently.
   * @since 1.2.6
   */
  public copyHandlers: EventHandlerList<ClipboardCopyEvent> = new EventHandlerList();
  /**
   * Only runs for panel driven pastes, not native Ctrl+V. Cancelling aborts the paste silently.
   * @since 1.2.6
   */
  public pasteHandlers: EventHandlerList<ClipboardPasteEvent> = new EventHandlerList();

  /** @since 1.2.6 */
  public addCopyHandler(handler: EventHandler<ClipboardCopyEvent>, options?: EventHandlerOptions): this {
    this.copyHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeCopyHandler(handler: EventHandler<ClipboardCopyEvent>): this {
    this.copyHandlers.removeHandler(handler);
    return this;
  }

  /** @since 1.2.6 */
  public addPasteHandler(handler: EventHandler<ClipboardPasteEvent>, options?: EventHandlerOptions): this {
    this.pasteHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removePasteHandler(handler: EventHandler<ClipboardPasteEvent>): this {
    this.pasteHandlers.removeHandler(handler);
    return this;
  }
}
