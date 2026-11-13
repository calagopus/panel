import { CancellableEvent, EventHandler, EventHandlerList, EventHandlerOptions, Registry } from 'shared';
import type { QuickActionItem, QuickActionScope } from '@/lib/quickActions/quickActions.ts';

export class QuickActionSelectEvent extends CancellableEvent<QuickActionItem> {
  constructor(
    public readonly scope: QuickActionScope,
    public readonly serverId: string | undefined,
    // The id of the active prefix mode, if any
    public readonly mode: string | undefined,
    data: QuickActionItem,
  ) {
    super(data);
  }
}

export class QuickActionEventRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.selectHandlers.mergeFrom(other.selectHandlers);

    return this;
  }

  /** @since 1.2.6 */
  public selectHandlers: EventHandlerList<QuickActionSelectEvent> = new EventHandlerList();

  /** @since 1.2.6 */
  public addSelectHandler(handler: EventHandler<QuickActionSelectEvent>, options?: EventHandlerOptions): this {
    this.selectHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeSelectHandler(handler: EventHandler<QuickActionSelectEvent>): this {
    this.selectHandlers.removeHandler(handler);
    return this;
  }
}
