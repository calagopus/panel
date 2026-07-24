import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes';
import { adminServerBackupSchema } from '@/lib/schemas/admin/servers';

type PageProps = { node: z.infer<typeof adminNodeSchema> };

export class BackupsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  public contextMenu: ContextMenuRegistry<{
    node: z.infer<typeof adminNodeSchema>;
    backup: z.infer<typeof adminServerBackupSchema>;
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
        node: z.infer<typeof adminNodeSchema>;
        backup: z.infer<typeof adminServerBackupSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
