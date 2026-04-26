import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { userOAuthLinkSchema } from '@/lib/schemas/user/oAuth.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class OAuthLinksRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.oauthLinkContextMenu.mergeFrom(other.oauthLinkContextMenu);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public oauthLinkContextMenu: ContextMenuRegistry<{ oauthLink: z.infer<typeof userOAuthLinkSchema> }> =
    new ContextMenuRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterOauthLinkContextMenu(
    callback: (registry: ContextMenuRegistry<{ oauthLink: z.infer<typeof userOAuthLinkSchema> }>) => unknown,
  ): this {
    callback(this.oauthLinkContextMenu);
    return this;
  }
}
