import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { userSessionSchema } from '@/lib/schemas/user/sessions.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class SessionsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.sessionContextMenu.mergeFrom(other.sessionContextMenu);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public sessionContextMenu: ContextMenuRegistry<{ session: z.infer<typeof userSessionSchema> }> =
    new ContextMenuRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterSessionContextMenu(
    callback: (registry: ContextMenuRegistry<{ session: z.infer<typeof userSessionSchema> }>) => unknown,
  ): this {
    callback(this.sessionContextMenu);
    return this;
  }
}
