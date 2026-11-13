import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AdminContentContainer.tsx';
import { SubNavigationRegistry } from '../../../slices/subNavigation.ts';
import { HealthRegistry } from './health.ts';
import { OverviewRegistry } from './overview.ts';
import { UpdatesRegistry } from './updates.ts';

export class HomeRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.subNavigation.mergeFrom(other.subNavigation);
    this.overview.mergeFrom(other.overview);
    this.updates.mergeFrom(other.updates);
    this.health.mergeFrom(other.health);

    return this;
  }

  /** @since 1.1.1 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.1.1 */
  public subNavigation: SubNavigationRegistry = new SubNavigationRegistry();
  /** @since 1.1.1 */
  public overview: OverviewRegistry = new OverviewRegistry();
  /** @since 1.1.1 */
  public updates: UpdatesRegistry = new UpdatesRegistry();
  /** @since 1.1.1 */
  public health: HealthRegistry = new HealthRegistry();

  /** @since 1.1.1 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.1.1 */
  public enterSubNavigation(callback: (registry: SubNavigationRegistry) => unknown): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.1 */
  public enterOverview(callback: (registry: OverviewRegistry) => unknown): this {
    callback(this.overview);
    return this;
  }

  /** @since 1.1.1 */
  public enterUpdates(callback: (registry: UpdatesRegistry) => unknown): this {
    callback(this.updates);
    return this;
  }

  /** @since 1.1.1 */
  public enterHealth(callback: (registry: HealthRegistry) => unknown): this {
    callback(this.health);
    return this;
  }
}
