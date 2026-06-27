import { Registry } from 'shared';
import { OverviewRegistry } from './overview.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.overview.mergeFrom(other.overview);

    return this;
  }

  public overview: OverviewRegistry = new OverviewRegistry();

  public enterOverview(callback: (registry: OverviewRegistry) => unknown): this {
    callback(this.overview);
    return this;
  }
}
