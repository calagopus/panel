import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts';
import { adminServerDatabaseSchema } from '@/lib/schemas/admin/servers';

type PageProps = { databaseHost: z.infer<typeof adminDatabaseHostSchema> };

export class DatabasesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  public contextMenu: ContextMenuRegistry<{
    databaseHost: z.infer<typeof adminDatabaseHostSchema>;
    database: z.infer<typeof adminServerDatabaseSchema>;
  }> = new ContextMenuRegistry();

  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  public enterContextMenu(
    callback: (
      registry: ContextMenuRegistry<{
        databaseHost: z.infer<typeof adminDatabaseHostSchema>;
        database: z.infer<typeof adminServerDatabaseSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
