import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminNodeServerBackupSchema } from '@/lib/schemas/admin/nodes';
import { adminServerSchema } from '@/lib/schemas/admin/servers';

type PageProps = { server: z.infer<typeof adminServerSchema> };

export class BackupsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  public contextMenu: ContextMenuRegistry<{
    server: z.infer<typeof adminServerSchema>;
    backup: z.infer<typeof adminNodeServerBackupSchema>;
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
        server: z.infer<typeof adminServerSchema>;
        backup: z.infer<typeof adminNodeServerBackupSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
