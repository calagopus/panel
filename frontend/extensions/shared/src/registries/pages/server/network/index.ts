import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations.ts';
import { ComponentListRegistry } from '../../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../../slices/contextMenu.ts';
import { SubNavigationRegistry } from '../../../slices/subNavigation.ts';
import { FirewallRegistry } from './firewall.ts';

export class NetworkRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);
    this.subNavigation.mergeFrom(other.subNavigation);
    this.allocationContextMenu.mergeFrom(other.allocationContextMenu);
    this.firewall.mergeFrom(other.firewall);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.2.3 */
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.2.0 */
  public subNavigation: SubNavigationRegistry = new SubNavigationRegistry();
  /** @since 1.0.0 */
  public allocationContextMenu: ContextMenuRegistry<{ allocation: z.infer<typeof serverAllocationSchema> }> =
    new ContextMenuRegistry();
  /** @since 1.2.0 */
  public firewall: FirewallRegistry = new FirewallRegistry();

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

  /** @since 1.2.0 */
  public enterSubNavigation(callback: (registry: SubNavigationRegistry) => unknown): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.0.0 */
  public enterAllocationContextMenu(
    callback: (registry: ContextMenuRegistry<{ allocation: z.infer<typeof serverAllocationSchema> }>) => unknown,
  ): this {
    callback(this.allocationContextMenu);
    return this;
  }

  /** @since 1.2.0 */
  public enterFirewall(callback: (registry: FirewallRegistry) => unknown): this {
    callback(this.firewall);
    return this;
  }
}
