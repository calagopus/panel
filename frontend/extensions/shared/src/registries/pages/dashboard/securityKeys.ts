import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { userSecurityKeySchema } from '@/lib/schemas/user/securityKeys.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class SecurityKeysRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.securityKeyContextMenu.mergeFrom(other.securityKeyContextMenu);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public securityKeyContextMenu: ContextMenuRegistry<{ securityKey: z.infer<typeof userSecurityKeySchema> }> =
    new ContextMenuRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterSecurityKeyContextMenu(
    callback: (registry: ContextMenuRegistry<{ securityKey: z.infer<typeof userSecurityKeySchema> }>) => unknown,
  ): this {
    callback(this.securityKeyContextMenu);
    return this;
  }
}
