import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminNodeDatabaseHostSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes';

type PageProps = { node: z.infer<typeof adminNodeSchema> };

export class DatabaseHostsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  /** @since 1.1.2 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /** @since 1.1.2 */
  public contextMenu: ContextMenuRegistry<{
    node: z.infer<typeof adminNodeSchema>;
    databaseHost: z.infer<typeof adminNodeDatabaseHostSchema>;
  }> = new ContextMenuRegistry();

  /** @since 1.1.2 */
  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  /** @since 1.1.2 */
  public enterContextMenu(
    callback: (
      registry: ContextMenuRegistry<{
        node: z.infer<typeof adminNodeSchema>;
        databaseHost: z.infer<typeof adminNodeDatabaseHostSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
