import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminLocationDatabaseAgentHostSchema, adminLocationSchema } from '@/lib/schemas/admin/locations';

type PageProps = { location: z.infer<typeof adminLocationSchema> };

export class DatabaseAgentHostsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  /** @since 1.1.1 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /** @since 1.1.1 */
  public contextMenu: ContextMenuRegistry<{
    location: z.infer<typeof adminLocationSchema>;
    databaseAgentHost: z.infer<typeof adminLocationDatabaseAgentHostSchema>;
  }> = new ContextMenuRegistry();

  /** @since 1.1.1 */
  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  /** @since 1.1.1 */
  public enterContextMenu(
    callback: (
      registry: ContextMenuRegistry<{
        location: z.infer<typeof adminLocationSchema>;
        databaseAgentHost: z.infer<typeof adminLocationDatabaseAgentHostSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
