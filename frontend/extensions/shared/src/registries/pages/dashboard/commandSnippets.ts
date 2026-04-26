import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { userCommandSnippetSchema } from '@/lib/schemas/user/commandSnippets.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class CommandSnippetsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.commandSnippetContextMenu.mergeFrom(other.commandSnippetContextMenu);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public commandSnippetContextMenu: ContextMenuRegistry<{ commandSnippet: z.infer<typeof userCommandSnippetSchema> }> =
    new ContextMenuRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterCommandSnippetContextMenu(
    callback: (registry: ContextMenuRegistry<{ commandSnippet: z.infer<typeof userCommandSnippetSchema> }>) => unknown,
  ): this {
    callback(this.commandSnippetContextMenu);
    return this;
  }
}
