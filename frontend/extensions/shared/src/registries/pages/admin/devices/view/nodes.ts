import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes';

type PageProps = { device: z.infer<typeof adminDeviceSchema> };

export class NodesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  /** @since 1.2.3 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /** @since 1.2.3 */
  public contextMenu: ContextMenuRegistry<{
    device: z.infer<typeof adminDeviceSchema>;
    node: z.infer<typeof adminNodeSchema>;
  }> = new ContextMenuRegistry();

  /** @since 1.2.3 */
  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  /** @since 1.2.3 */
  public enterContextMenu(
    callback: (
      registry: ContextMenuRegistry<{
        device: z.infer<typeof adminDeviceSchema>;
        node: z.infer<typeof adminNodeSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
