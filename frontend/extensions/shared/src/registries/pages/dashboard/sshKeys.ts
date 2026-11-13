import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { userSshKeySchema } from '@/lib/schemas/user/sshKeys.ts';
import { ComponentListRegistry } from '../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class SshKeysRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);
    this.sshKeyContextMenu.mergeFrom(other.sshKeyContextMenu);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.2.3 */
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.0.0 */
  public sshKeyContextMenu: ContextMenuRegistry<{ sshKey: z.infer<typeof userSshKeySchema> }> =
    new ContextMenuRegistry();

  /** @since 1.0.0 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.2.3 */
  public enterActionBar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.actionBar);
    return this;
  }

  /** @since 1.0.0 */
  public enterSshKeyContextMenu(
    callback: (registry: ContextMenuRegistry<{ sshKey: z.infer<typeof userSshKeySchema> }>) => unknown,
  ): this {
    callback(this.sshKeyContextMenu);
    return this;
  }
}
