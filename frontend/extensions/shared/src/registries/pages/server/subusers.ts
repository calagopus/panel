import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverSubuserSchema } from '@/lib/schemas/server/subusers.ts';
import { ComponentListRegistry } from '../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class SubusersRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);
    this.subuserContextMenu.mergeFrom(other.subuserContextMenu);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.2.3 */
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.0.0 */
  public subuserContextMenu: ContextMenuRegistry<{ subuser: z.infer<typeof serverSubuserSchema> }> =
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
  public enterSubuserContextMenu(
    callback: (registry: ContextMenuRegistry<{ subuser: z.infer<typeof serverSubuserSchema> }>) => unknown,
  ): this {
    callback(this.subuserContextMenu);
    return this;
  }
}
