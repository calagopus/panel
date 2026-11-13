import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { userOAuthLinkSchema } from '@/lib/schemas/user/oAuth.ts';
import { ComponentListRegistry } from '../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../slices/contextMenu.ts';

export class OAuthLinksRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);
    this.oauthLinkContextMenu.mergeFrom(other.oauthLinkContextMenu);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.2.3 */
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.0.0 */
  public oauthLinkContextMenu: ContextMenuRegistry<{ oauthLink: z.infer<typeof userOAuthLinkSchema> }> =
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
  public enterOauthLinkContextMenu(
    callback: (registry: ContextMenuRegistry<{ oauthLink: z.infer<typeof userOAuthLinkSchema> }>) => unknown,
  ): this {
    callback(this.oauthLinkContextMenu);
    return this;
  }
}
