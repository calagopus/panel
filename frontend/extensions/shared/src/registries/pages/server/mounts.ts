import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { ComponentListRegistry } from '../../slices/componentList.ts';
import { SubNavigationRegistry } from '../../slices/subNavigation.ts';

export class MountsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);
    this.subNavigation.mergeFrom(other.subNavigation);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.2.3 */
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.2.3 */
  public subNavigation: SubNavigationRegistry = new SubNavigationRegistry();

  /** @since 1.0.0 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.2.3 */
  public enterActionBar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.actionBar);
    return this;
  }

  /** @since 1.2.3 */
  public enterSubNavigation(callback: (registry: SubNavigationRegistry) => unknown): this {
    callback(this.subNavigation);
    return this;
  }
}
