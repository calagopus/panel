import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { ContextMenuRegistry } from '../../../../slices/contextMenu.ts';

type PageProps = { systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema> };
type MenuProps = PageProps & { node: z.infer<typeof adminNodeSchema> };

export class NodesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  public contextMenu: ContextMenuRegistry<MenuProps> = new ContextMenuRegistry();

  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  public enterContextMenu(callback: (registry: ContextMenuRegistry<MenuProps>) => unknown): this {
    callback(this.contextMenu);
    return this;
  }
}
