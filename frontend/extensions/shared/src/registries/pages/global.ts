import type { FC } from 'react';
import { Registry } from 'shared';

export class GlobalRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  /**
   * Rendered around the routes inside the auth and store providers, can mount more than once at a time.
   * @since 1.0.0
   */
  public prependedComponents: FC[] = [];
  /**
   * Rendered around the routes inside the auth and store providers, can mount more than once at a time.
   * @since 1.0.0
   */
  public appendedComponents: FC[] = [];

  /** @since 1.0.0 */
  public prependComponent(component: FC): this {
    this.prependedComponents.push(component);
    return this;
  }

  /** @since 1.0.0 */
  public appendComponent(component: FC): this {
    this.appendedComponents.push(component);
    return this;
  }
}
