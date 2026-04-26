import type { FC } from 'react';
import { Registry } from 'shared';

export class GlobalRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  public prependedComponents: FC[] = [];
  public appendedComponents: FC[] = [];

  public prependComponent(component: FC): this {
    this.prependedComponents.push(component);
    return this;
  }

  public appendComponent(component: FC): this {
    this.appendedComponents.push(component);
    return this;
  }
}
