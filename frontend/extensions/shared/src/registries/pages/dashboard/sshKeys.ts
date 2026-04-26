import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class SshKeysRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.sshKeyContextMenu.mergeFrom(other.sshKeyContextMenu);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public sshKeyContextMenu: ContextMenuRegistry<{ sshKey: z.infer<typeof userSshKeySchema> }> =
    new ContextMenuRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterSshKeyContextMenu(
    callback: (registry: ContextMenuRegistry<{ sshKey: z.infer<typeof userSshKeySchema> }>) => unknown,
  ): this {
    callback(this.sshKeyContextMenu);
    return this;
  }
}
