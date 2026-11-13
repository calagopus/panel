import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import {
  adminServerSchema,
  adminServerServerDatabaseAgentSchema,
  adminServerServerDatabaseSchema,
} from '@/lib/schemas/admin/servers';

type PageProps = { server: z.infer<typeof adminServerSchema> };

export class DatabasesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.instancesSubContainer.mergeFrom(other.instancesSubContainer);
    this.contextMenu.mergeFrom(other.contextMenu);
    this.instanceContextMenu.mergeFrom(other.instanceContextMenu);

    return this;
  }

  /** @since 1.1.1 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /**
   * Sub container of the database agent instances list, `subContainer` is the classic databases list.
   * @since 1.1.1
   */
  public instancesSubContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /** @since 1.1.1 */
  public contextMenu: ContextMenuRegistry<{
    server: z.infer<typeof adminServerSchema>;
    database: z.infer<typeof adminServerServerDatabaseSchema>;
  }> = new ContextMenuRegistry();
  /**
   * Context menu of a database agent instance row.
   * @since 1.1.1
   */
  public instanceContextMenu: ContextMenuRegistry<{
    server: z.infer<typeof adminServerSchema>;
    databaseAgent: z.infer<typeof adminServerServerDatabaseAgentSchema>;
  }> = new ContextMenuRegistry();

  /** @since 1.1.1 */
  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  /** @since 1.1.1 */
  public enterInstancesSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.instancesSubContainer);
    return this;
  }

  /** @since 1.1.1 */
  public enterContextMenu(
    callback: (
      registry: ContextMenuRegistry<{
        server: z.infer<typeof adminServerSchema>;
        database: z.infer<typeof adminServerServerDatabaseSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }

  /** @since 1.1.1 */
  public enterInstanceContextMenu(
    callback: (
      registry: ContextMenuRegistry<{
        server: z.infer<typeof adminServerSchema>;
        databaseAgent: z.infer<typeof adminServerServerDatabaseAgentSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.instanceContextMenu);
    return this;
  }
}
