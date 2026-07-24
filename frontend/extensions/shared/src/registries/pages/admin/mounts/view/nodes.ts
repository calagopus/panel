import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminMountSchema } from '@/lib/schemas/admin/mounts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes';

type PageProps = { mount: z.infer<typeof adminMountSchema> };

export class NodesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  public contextMenu: ContextMenuRegistry<{
    mount: z.infer<typeof adminMountSchema>;
    node: z.infer<typeof adminNodeSchema>;
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
        mount: z.infer<typeof adminMountSchema>;
        node: z.infer<typeof adminNodeSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
