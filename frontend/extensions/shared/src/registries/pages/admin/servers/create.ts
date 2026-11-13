import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AdminContentContainer.tsx';

export class CreateRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);

    return this;
  }

  /** @since 1.0.3 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();

  /** @since 1.0.3 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }
}
