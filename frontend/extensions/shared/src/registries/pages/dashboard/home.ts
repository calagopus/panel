import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';

export class HomeRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.containerGrouped.mergeFrom(other.containerGrouped);
    this.containerAll.mergeFrom(other.containerAll);

    return this;
  }

  public containerGrouped: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public containerAll: ContainerRegistry<ContainerProps> = new ContainerRegistry();

  public enterContainerGrouped(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.containerGrouped);
    return this;
  }

  public enterContainerAll(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.containerAll);
    return this;
  }
}
