import type { FC } from 'react';
import { Registry } from 'shared';

export class ComponentListRegistry<Props = {}> implements Registry {
  public mergeFrom(other: this): this {
    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  /** @since 1.0.0 */
  public prependedComponents: FC<Props>[] = [];
  /** @since 1.0.0 */
  public appendedComponents: FC<Props>[] = [];

  /** @since 1.0.0 */
  public prependComponent(component: FC<Props>): this {
    this.prependedComponents.push(component);
    return this;
  }

  /** @since 1.0.0 */
  public appendComponent(component: FC<Props>): this {
    this.appendedComponents.push(component);
    return this;
  }
}
