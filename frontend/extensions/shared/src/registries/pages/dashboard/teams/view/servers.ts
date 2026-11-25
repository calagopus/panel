import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AccountSubContentContainer.tsx';
import { serverSchema } from '@/lib/schemas/server/server.ts';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { ComponentListRegistry } from '../../../../slices/componentList.ts';
import { ContextMenuRegistry } from '../../../../slices/contextMenu.ts';

type PageProps = { team: z.infer<typeof userTeamSchema> };

export class ServersRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.actionBar.mergeFrom(other.actionBar);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  /** @since 1.3.0 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /** @since 1.3.0 */
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  /** @since 1.3.0 */
  public contextMenu: ContextMenuRegistry<{
    team: z.infer<typeof userTeamSchema>;
    server: z.infer<typeof serverSchema>;
  }> = new ContextMenuRegistry();

  /** @since 1.3.0 */
  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  /** @since 1.3.0 */
  public enterActionBar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.actionBar);
    return this;
  }

  /** @since 1.3.0 */
  public enterContextMenu(
    callback: (
      registry: ContextMenuRegistry<{
        team: z.infer<typeof userTeamSchema>;
        server: z.infer<typeof serverSchema>;
      }>,
    ) => unknown,
  ): this {
    callback(this.contextMenu);
    return this;
  }
}
