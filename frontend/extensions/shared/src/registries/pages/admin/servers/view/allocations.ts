import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers';
import { serverAllocationSchema } from '@/lib/schemas/server/allocations';

export class AllocationsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<{ server: z.infer<typeof adminServerSchema> }>> =
    new ContainerRegistry();
  public contextMenu: ContextMenuRegistry<{
    server: z.infer<typeof adminServerSchema>;
    allocation: z.infer<typeof serverAllocationSchema>;
  }> = new ContextMenuRegistry();

  public enterSubContainer(
    callback: (
      registry: ContainerRegistry<
        SubContainerProps<{
          server: z.infer<typeof adminServerSchema>;
        }>
      >,
    ) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  public enterContextMenu(
    callback: (
      registry: ContextMenuRegistry<{
        server: z.infer<typeof adminServerSchema>;
        allocation: z.infer<typeof serverAllocationSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
