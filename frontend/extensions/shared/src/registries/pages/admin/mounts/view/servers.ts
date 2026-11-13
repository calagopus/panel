import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminMountSchema } from '@/lib/schemas/admin/mounts';

type PageProps = { mount: z.infer<typeof adminMountSchema> };

export class ServersRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);

    return this;
  }

  /** @since 1.1.1 */
  public subContainer: ContainerRegistry<SubContainerProps<PageProps>, PageProps> = new ContainerRegistry();

  /** @since 1.1.1 */
  public enterSubContainer(
    callback: (registry: ContainerRegistry<SubContainerProps<PageProps>, PageProps>) => unknown,
  ): this {
    callback(this.subContainer);
    return this;
  }
}
