import { ContainerRegistry, Registry } from 'shared';
import { ContextMenuRegistry } from 'shared/src/registries/slices/contextMenu';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminOAuthProviderMappingSchema, adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders';

type PageProps = { oauthProvider: z.infer<typeof adminOAuthProviderSchema> };

export class MappingsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  /** @since 1.1.1 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /** @since 1.1.1 */
  public contextMenu: ContextMenuRegistry<{
    oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
    mapping: z.infer<typeof adminOAuthProviderMappingSchema>;
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
        oauthProvider: z.infer<typeof adminOAuthProviderSchema>;
        mapping: z.infer<typeof adminOAuthProviderMappingSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
