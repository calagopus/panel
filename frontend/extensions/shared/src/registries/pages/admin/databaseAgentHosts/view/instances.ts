import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts';
import { adminServerDatabaseAgentSchema } from '@/lib/schemas/admin/servers';

type PageProps = { databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema> };

export class InstancesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  public contextMenu: ContextMenuRegistry<{
    databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
    databaseAgent: z.infer<typeof adminServerDatabaseAgentSchema>;
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
        databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
        databaseAgent: z.infer<typeof adminServerDatabaseAgentSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
