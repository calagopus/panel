import { Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';

export class UpdatesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.cards.mergeFrom(other.cards);

    return this;
  }

  /** @since 1.1.1 */
  public cards: ComponentListRegistry = new ComponentListRegistry();

  /** @since 1.1.1 */
  public enterCards(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.cards);
    return this;
  }
}
