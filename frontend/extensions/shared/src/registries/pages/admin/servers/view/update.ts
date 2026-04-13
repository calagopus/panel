import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers';

export class UpdateRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<{ server: z.infer<typeof adminServerSchema> }>> =
    new ContainerRegistry();

  public enterSubContainer(
    callback: (
      registry: ContainerRegistry<SubContainerProps<{ server: z.infer<typeof adminServerSchema> }>>,
    ) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }
}
