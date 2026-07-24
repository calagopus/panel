import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories';

type PageProps = { eggRepository: z.infer<typeof adminEggRepositorySchema> };

export class EggsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();

  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }
}
