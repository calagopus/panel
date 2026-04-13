import { ContainerRegistry, Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers';

export class ManagementRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.managementContainers.mergeFrom(other.managementContainers);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<{ server: z.infer<typeof adminServerSchema> }>> =
    new ContainerRegistry();
  public managementContainers: ComponentListRegistry<{ server: z.infer<typeof adminServerSchema> }> =
    new ComponentListRegistry();

  public enterSubContainer(
    callback: (
      registry: ContainerRegistry<SubContainerProps<{ server: z.infer<typeof adminServerSchema> }>>,
    ) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }

  public enterManagementContainers(
    callback: (registry: ComponentListRegistry<{ server: z.infer<typeof adminServerSchema> }>) => unknown,
  ): this {
    callback(this.managementContainers);
    return this;
  }
}
