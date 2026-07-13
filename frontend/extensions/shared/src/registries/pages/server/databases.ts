import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverDatabaseInstanceSchema } from '@/lib/schemas/server/databaseInstances.ts';
import { serverDatabaseSchema } from '@/lib/schemas/server/databases.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class DatabasesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.databaseContextMenu.mergeFrom(other.databaseContextMenu);
    this.databaseInstanceContextMenu.mergeFrom(other.databaseInstanceContextMenu);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public databaseContextMenu: ContextMenuRegistry<{ database: z.infer<typeof serverDatabaseSchema> }> =
    new ContextMenuRegistry();
  public databaseInstanceContextMenu: ContextMenuRegistry<{
    instance: z.infer<typeof serverDatabaseInstanceSchema>;
  }> = new ContextMenuRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterDatabaseContextMenu(
    callback: (registry: ContextMenuRegistry<{ database: z.infer<typeof serverDatabaseSchema> }>) => unknown,
  ): this {
    callback(this.databaseContextMenu);
    return this;
  }

  public enterDatabaseInstanceContextMenu(
    callback: (registry: ContextMenuRegistry<{ instance: z.infer<typeof serverDatabaseInstanceSchema> }>) => unknown,
  ): this {
    callback(this.databaseInstanceContextMenu);
    return this;
  }
}
