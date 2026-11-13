import type { z } from 'zod';
import { CancellableEvent, EventHandler, EventHandlerList, EventHandlerOptions, Registry } from 'shared';
import type { fullUserSchema } from '@/lib/schemas/user.ts';

type FullUser = z.infer<typeof fullUserSchema>;

export class AuthLogoutEvent extends CancellableEvent<void> {
  constructor(
    public readonly kind: 'logout' | 'stopImpersonating',
    public readonly user: Readonly<FullUser> | null,
  ) {
    super(undefined);
  }
}

export class AuthImpersonateEvent extends CancellableEvent<void> {
  constructor(
    public readonly user: Readonly<FullUser>,
    public readonly currentUser: Readonly<FullUser> | null,
  ) {
    super(undefined);
  }
}

export class AuthEventRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.logoutHandlers.mergeFrom(other.logoutHandlers);
    this.impersonateHandlers.mergeFrom(other.impersonateHandlers);

    return this;
  }

  /** @since 1.2.6 */
  public logoutHandlers: EventHandlerList<AuthLogoutEvent> = new EventHandlerList();
  /** @since 1.2.6 */
  public impersonateHandlers: EventHandlerList<AuthImpersonateEvent> = new EventHandlerList();

  /** @since 1.2.6 */
  public addLogoutHandler(handler: EventHandler<AuthLogoutEvent>, options?: EventHandlerOptions): this {
    this.logoutHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeLogoutHandler(handler: EventHandler<AuthLogoutEvent>): this {
    this.logoutHandlers.removeHandler(handler);
    return this;
  }

  /** @since 1.2.6 */
  public addImpersonateHandler(handler: EventHandler<AuthImpersonateEvent>, options?: EventHandlerOptions): this {
    this.impersonateHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeImpersonateHandler(handler: EventHandler<AuthImpersonateEvent>): this {
    this.impersonateHandlers.removeHandler(handler);
    return this;
  }
}
