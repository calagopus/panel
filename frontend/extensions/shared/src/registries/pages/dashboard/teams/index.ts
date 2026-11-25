import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { ContextMenuRegistry } from '../../../slices/contextMenu.ts';
import { ViewRegistry } from './view/index.ts';

export class TeamsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.teamContextMenu.mergeFrom(other.teamContextMenu);
    this.view.mergeFrom(other.view);

    return this;
  }

  /** @since 1.3.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.3.0 */
  public teamContextMenu: ContextMenuRegistry<{ team: z.infer<typeof userTeamSchema> }> = new ContextMenuRegistry();
  /** @since 1.3.0 */
  public view: ViewRegistry = new ViewRegistry();

  /** @since 1.3.0 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.3.0 */
  public enterTeamContextMenu(
    callback: (registry: ContextMenuRegistry<{ team: z.infer<typeof userTeamSchema> }>) => unknown,
  ): this {
    callback(this.teamContextMenu);
    return this;
  }

  /** @since 1.3.0 */
  public enterView(callback: (registry: ViewRegistry) => unknown): this {
    callback(this.view);
    return this;
  }
}
