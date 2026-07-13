import { Registry } from 'shared';
import { ViewRegistry } from './view/index.ts';

export class NodesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.view.mergeFrom(other.view);

    return this;
  }

  public view: ViewRegistry = new ViewRegistry();

  public enterView(callback: (registry: ViewRegistry) => unknown): this {
    callback(this.view);
    return this;
  }
}
