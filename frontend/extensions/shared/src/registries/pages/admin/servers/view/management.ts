import { ContainerRegistry, Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers';

type PageProps = { server: z.infer<typeof adminServerSchema> };

export class ManagementRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.managementContainers.mergeFrom(other.managementContainers);

    return this;
  }

  /** @since 1.0.3 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();
  /**
   * Cards in the management tab grid.
   * @since 1.0.3
   */
  public managementContainers: ComponentListRegistry<PageProps> = new ComponentListRegistry();

  /** @since 1.0.3 */
  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  /** @since 1.0.3 */
  public enterManagementContainers(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.managementContainers);
    return this;
  }
}
