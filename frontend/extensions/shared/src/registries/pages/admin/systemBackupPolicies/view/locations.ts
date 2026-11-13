import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { ContextMenuRegistry } from '../../../../slices/contextMenu.ts';

type PageProps = { systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema> };
type MenuProps = PageProps & { location: z.infer<typeof adminLocationSchema> };

export class LocationsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.contextMenu.mergeFrom(other.contextMenu);

    return this;
  }

  /** @since 1.1.4 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /** @since 1.1.4 */
  public contextMenu: ContextMenuRegistry<MenuProps> = new ContextMenuRegistry();

  /** @since 1.1.4 */
  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  /** @since 1.1.4 */
  public enterContextMenu(callback: (registry: ContextMenuRegistry<MenuProps>) => unknown): this {
    callback(this.contextMenu);
    return this;
  }
}
