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

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public create: CreateRegistry = new CreateRegistry();
  public view: ViewRegistry = new ViewRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterCreate(callback: (registry: CreateRegistry) => unknown): this {
    callback(this.create);
    return this;
  }

  public enterView(callback: (registry: ViewRegistry) => unknown): this {
    callback(this.view);
    return this;
  }
}
