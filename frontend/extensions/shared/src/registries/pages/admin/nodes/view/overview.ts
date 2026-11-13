import { Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';
import { z } from 'zod';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes';

type PageProps = { node: z.infer<typeof adminNodeSchema> };

export class OverviewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.nodeDetails.mergeFrom(other.nodeDetails);
    this.systemInfo.mergeFrom(other.systemInfo);
    this.resources.mergeFrom(other.resources);
    this.appendedCards.mergeFrom(other.appendedCards);

    return this;
  }

  /**
   * Rows inside the node details card.
   * @since 1.1.0
   */
  public nodeDetails: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  /**
   * Rows inside the system information card.
   * @since 1.1.0
   */
  public systemInfo: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  /**
   * Rows inside the resources card.
   * @since 1.1.0
   */
  public resources: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  /**
   * Cards after all stock cards.
   * @since 1.1.0
   */
  public appendedCards: ComponentListRegistry<PageProps> = new ComponentListRegistry();

  /** @since 1.1.0 */
  public enterNodeDetails(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.nodeDetails);
    return this;
  }

  /** @since 1.1.0 */
  public enterSystemInfo(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.systemInfo);
    return this;
  }

  /** @since 1.1.0 */
  public enterResources(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.resources);
    return this;
  }

  /** @since 1.1.0 */
  public enterAppendedCards(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.appendedCards);
    return this;
  }
}
