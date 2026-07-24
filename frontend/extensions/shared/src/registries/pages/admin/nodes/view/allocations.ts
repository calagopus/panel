import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes';

type PageProps = { node: z.infer<typeof adminNodeSchema> };

export class AllocationsRegistry implements Registry {
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
