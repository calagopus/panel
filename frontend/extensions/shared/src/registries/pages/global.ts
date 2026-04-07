import type { FC } from 'react';
import { Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList';

export class GlobalRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.copyright.mergeFrom(other.copyright);

    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  public copyright: ComponentListRegistry<{}> = new ComponentListRegistry();

  public prependedComponents: FC[] = [];
  public appendedComponents: FC[] = [];

  public enterCopyright(callback: (registry: ComponentListRegistry<{}>) => unknown): this {
    callback(this.copyright);
    return this;
  }

  public prependComponent(component: FC): this {
    this.prependedComponents.push(component);
    return this;
  }

  public appendComponent(component: FC): this {
    this.appendedComponents.push(component);
    return this;
  }
}
