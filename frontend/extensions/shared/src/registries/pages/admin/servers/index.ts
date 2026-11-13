import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AdminContentContainer.tsx';
import { CreateRegistry } from './create.ts';
import { ViewRegistry } from './view/index.ts';

export class ServersRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.create.mergeFrom(other.create);
    this.view.mergeFrom(other.view);

    return this;
  }

  /** @since 1.0.3 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /** @since 1.0.3 */
  public create: CreateRegistry = new CreateRegistry();
  /** @since 1.0.3 */
  public view: ViewRegistry = new ViewRegistry();

  /** @since 1.0.3 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.0.3 */
  public enterCreate(callback: (registry: CreateRegistry) => unknown): this {
    callback(this.create);
    return this;
  }

  /** @since 1.0.3 */
  public enterView(callback: (registry: ViewRegistry) => unknown): this {
    callback(this.view);
    return this;
  }
}
