import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { ComponentListRegistry } from '../../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../../slices/contextMenu.ts';
import { SubNavigationRegistry } from '../../../slices/subNavigation.ts';
import { InstancesRegistry } from './instances.ts';

export class DatabasesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);
    this.subNavigation.mergeFrom(other.subNavigation);
    this.databaseContextMenu.mergeFrom(other.databaseContextMenu);
    this.databaseInstanceContextMenu.mergeFrom(other.databaseInstanceContextMenu);
    this.instances.mergeFrom(other.instances);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.2.3 */
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.1.4 */
  public subNavigation: SubNavigationRegistry = new SubNavigationRegistry();
  /** @since 1.0.0 */
  public databaseContextMenu: ContextMenuRegistry<{ database: z.infer<typeof serverDatabaseSchema> }> =
    new ContextMenuRegistry();
  /** @since 1.1.0 */
  public databaseInstanceContextMenu: ContextMenuRegistry<{
    instance: z.infer<typeof serverDatabaseInstanceSchema>;
  }> = new ContextMenuRegistry();
  /** @since 1.1.4 */
  public instances: InstancesRegistry = new InstancesRegistry();

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

  /** @since 1.1.4 */
  public enterSubNavigation(callback: (registry: SubNavigationRegistry) => unknown): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.0.0 */
  public enterDatabaseContextMenu(
    callback: (registry: ContextMenuRegistry<{ database: z.infer<typeof serverDatabaseSchema> }>) => unknown,
  ): this {
    callback(this.databaseContextMenu);
    return this;
  }

  /** @since 1.1.0 */
  public enterDatabaseInstanceContextMenu(
    callback: (registry: ContextMenuRegistry<{ instance: z.infer<typeof serverDatabaseInstanceSchema> }>) => unknown,
  ): this {
    callback(this.databaseInstanceContextMenu);
    return this;
  }

  /** @since 1.1.4 */
  public enterInstances(callback: (registry: InstancesRegistry) => unknown): this {
    callback(this.instances);
    return this;
  }
}
