import { Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';
import { z } from 'zod';
import { adminServerSchema } from '@/lib/schemas/admin/servers';

type PageProps = { server: z.infer<typeof adminServerSchema> };

export class OverviewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.owner.mergeFrom(other.owner);
    this.nodeAndLocation.mergeFrom(other.nodeAndLocation);
    this.serverDetails.mergeFrom(other.serverDetails);
    this.resourceLimits.mergeFrom(other.resourceLimits);
    this.featureLimits.mergeFrom(other.featureLimits);
    this.appendedCards.mergeFrom(other.appendedCards);

    return this;
  }

  /**
   * Rows inside the owner card.
   * @since 1.1.0
   */
  public owner: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  /**
   * Rows inside the node and location card.
   * @since 1.1.0
   */
  public nodeAndLocation: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  /**
   * Rows inside the server details card.
   * @since 1.1.0
   */
  public serverDetails: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  /**
   * Rows inside the resource limits card.
   * @since 1.1.0
   */
  public resourceLimits: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  /**
   * Rows inside the feature limits card.
   * @since 1.1.0
   */
  public featureLimits: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  /**
   * Cards after all stock cards.
   * @since 1.1.0
   */
  public appendedCards: ComponentListRegistry<PageProps> = new ComponentListRegistry();

  /** @since 1.1.0 */
  public enterOwner(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.owner);
    return this;
  }

  /** @since 1.1.0 */
  public enterNodeAndLocation(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.nodeAndLocation);
    return this;
  }

  /** @since 1.1.0 */
  public enterServerDetails(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.serverDetails);
    return this;
  }

  /** @since 1.1.0 */
  public enterResourceLimits(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.resourceLimits);
    return this;
  }

  /** @since 1.1.0 */
  public enterFeatureLimits(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.featureLimits);
    return this;
  }

  /** @since 1.1.0 */
  public enterAppendedCards(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.appendedCards);
    return this;
  }
}
