import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { ComponentListRegistry } from '../../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../../slices/contextMenu.ts';
import { SubNavigationRegistry } from '../../../slices/subNavigation.ts';
import { SystemRegistry } from './system.ts';

export class BackupsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);
    this.subNavigation.mergeFrom(other.subNavigation);
    this.backupContextMenu.mergeFrom(other.backupContextMenu);
    this.system.mergeFrom(other.system);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.2.3 */
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.1.4 */
  public subNavigation: SubNavigationRegistry = new SubNavigationRegistry();
  /** @since 1.0.0 */
  public backupContextMenu: ContextMenuRegistry<{ backup: z.infer<typeof serverBackupSchema> }> =
    new ContextMenuRegistry();
  /**
   * Backups created by admin system backup policies.
   * @since 1.1.4
   */
  public system: SystemRegistry = new SystemRegistry();

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
  public enterBackupContextMenu(
    callback: (registry: ContextMenuRegistry<{ backup: z.infer<typeof serverBackupSchema> }>) => unknown,
  ): this {
    callback(this.backupContextMenu);
    return this;
  }

  /** @since 1.1.4 */
  public enterSystem(callback: (registry: SystemRegistry) => unknown): this {
    callback(this.system);
    return this;
  }
}
