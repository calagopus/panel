import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AdminContentContainer.tsx';
import { ViewRegistry } from './view/index.ts';

export class TeamsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.view.mergeFrom(other.view);

    return this;
  }

  /** @since 1.3.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.3.0 */
  public view: ViewRegistry = new ViewRegistry();

  /** @since 1.3.0 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.3.0 */
  public enterView(callback: (registry: ViewRegistry) => unknown): this {
    callback(this.view);
    return this;
  }
}
