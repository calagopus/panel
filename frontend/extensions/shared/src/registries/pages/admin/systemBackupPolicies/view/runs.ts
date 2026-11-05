import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import {
  adminSystemBackupPolicyRunSchema,
  adminSystemBackupPolicySchema,
} from '@/lib/schemas/admin/systemBackupPolicies.ts';

type PageProps = { systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema> };
type ContextMenuProps = {
  systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  run: z.infer<typeof adminSystemBackupPolicyRunSchema>;
};

export class RunsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  public contextMenu: ContextMenuRegistry<ContextMenuProps> = new ContextMenuRegistry();

  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  public enterContextMenu(callback: (registry: ContextMenuRegistry<ContextMenuProps>) => unknown): this {
    callback(this.contextMenu);
    return this;
  }
}
