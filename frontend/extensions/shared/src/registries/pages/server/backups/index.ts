import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverBackupSchema } from '@/lib/schemas/server/backups.ts';
import { ContextMenuRegistry } from '../../../slices/contextMenu.ts';
import { SubNavigationRegistry } from '../../../slices/subNavigation.ts';
import { SystemRegistry } from './system.ts';

export class BackupsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.subNavigation.mergeFrom(other.subNavigation);
    this.backupContextMenu.mergeFrom(other.backupContextMenu);
    this.system.mergeFrom(other.system);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public subNavigation: SubNavigationRegistry = new SubNavigationRegistry();
  public backupContextMenu: ContextMenuRegistry<{ backup: z.infer<typeof serverBackupSchema> }> =
    new ContextMenuRegistry();
  public system: SystemRegistry = new SystemRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterSubNavigation(callback: (registry: SubNavigationRegistry) => unknown): this {
    callback(this.subNavigation);
    return this;
  }

  public enterBackupContextMenu(
    callback: (registry: ContextMenuRegistry<{ backup: z.infer<typeof serverBackupSchema> }>) => unknown,
  ): this {
    callback(this.backupContextMenu);
    return this;
  }

  public enterSystem(callback: (registry: SystemRegistry) => unknown): this {
    callback(this.system);
    return this;
  }
}
