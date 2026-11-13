import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';

export class HomeRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.containerGrouped.mergeFrom(other.containerGrouped);
    this.containerAll.mergeFrom(other.containerAll);

    return this;
  }

  /**
   * Container of the grouped servers view.
   * @since 1.0.0
   */
  public containerGrouped: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /**
   * Container of the flat all servers view.
   * @since 1.0.0
   */
  public containerAll: ContainerRegistry<ContainerProps> = new ContainerRegistry();

  /** @since 1.0.0 */
  public enterContainerGrouped(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.containerGrouped);
    return this;
  }

  /** @since 1.0.0 */
  public enterContainerAll(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.containerAll);
    return this;
  }
}
