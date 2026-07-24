import { Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';

export class OverviewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.cards.mergeFrom(other.cards);

    return this;
  }

  public cards: ComponentListRegistry = new ComponentListRegistry();

  public enterCards(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.cards);
    return this;
  }
}
