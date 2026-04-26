import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';

export class ActivityRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }
}
