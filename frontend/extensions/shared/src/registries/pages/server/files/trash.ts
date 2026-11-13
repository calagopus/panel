import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { serverTrashEntrySchema } from '@/lib/schemas/server/files.ts';
import { ComponentListRegistry } from '../../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../../slices/contextMenu.ts';

export class TrashRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);
    this.entryContextMenu.mergeFrom(other.entryContextMenu);

    return this;
  }

  /** @since 1.2.6 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.2.6 */
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.2.6 */
  public entryContextMenu: ContextMenuRegistry<{ entry: z.infer<typeof serverTrashEntrySchema> }> =
    new ContextMenuRegistry();

  /** @since 1.2.6 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.2.6 */
  public enterActionBar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.actionBar);
    return this;
  }

  /** @since 1.2.6 */
  public enterEntryContextMenu(
    callback: (registry: ContextMenuRegistry<{ entry: z.infer<typeof serverTrashEntrySchema> }>) => unknown,
  ): this {
    callback(this.entryContextMenu);
    return this;
  }
}
