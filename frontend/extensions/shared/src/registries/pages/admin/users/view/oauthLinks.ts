import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminFullUserSchema, adminUserOAuthLinkSchema } from '@/lib/schemas/admin/users';

type PageProps = { user: z.infer<typeof adminFullUserSchema> };

export class OAuthLinksRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  /** @since 1.1.1 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /** @since 1.1.1 */
  public contextMenu: ContextMenuRegistry<{
    user: z.infer<typeof adminFullUserSchema>;
    userOAuthLink: z.infer<typeof adminUserOAuthLinkSchema>;
  }> = new ContextMenuRegistry();

  /** @since 1.1.1 */
  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  /** @since 1.1.1 */
  public enterContextMenu(
    callback: (
      registry: ContextMenuRegistry<{
        user: z.infer<typeof adminFullUserSchema>;
        userOAuthLink: z.infer<typeof adminUserOAuthLinkSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
