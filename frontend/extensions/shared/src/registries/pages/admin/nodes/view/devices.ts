import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminNodeDeviceSchema, adminNodeSchema } from '@/lib/schemas/admin/nodes';

type PageProps = { node: z.infer<typeof adminNodeSchema> };

export class DevicesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  /** @since 1.2.3 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /** @since 1.2.3 */
  public contextMenu: ContextMenuRegistry<{
    node: z.infer<typeof adminNodeSchema>;
    device: z.infer<typeof adminNodeDeviceSchema>;
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
        node: z.infer<typeof adminNodeSchema>;
        device: z.infer<typeof adminNodeDeviceSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
