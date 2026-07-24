import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AdminContentContainer.tsx';
import { ViewRegistry } from './view/index.ts';

export class DatabaseAgentHostsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.view.mergeFrom(other.view);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public view: ViewRegistry = new ViewRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterView(callback: (registry: ViewRegistry) => unknown): this {
    callback(this.view);
    return this;
  }
}
