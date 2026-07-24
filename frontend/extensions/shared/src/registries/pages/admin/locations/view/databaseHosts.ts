import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminLocationDatabaseHostSchema, adminLocationSchema } from '@/lib/schemas/admin/locations';

type PageProps = { location: z.infer<typeof adminLocationSchema> };

export class DatabaseHostsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  public contextMenu: ContextMenuRegistry<{
    location: z.infer<typeof adminLocationSchema>;
    databaseHost: z.infer<typeof adminLocationDatabaseHostSchema>;
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
        location: z.infer<typeof adminLocationSchema>;
        databaseHost: z.infer<typeof adminLocationDatabaseHostSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
