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

  public nodeDetails: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  public systemInfo: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  public resources: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  public appendedCards: ComponentListRegistry<PageProps> = new ComponentListRegistry();

  public enterNodeDetails(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.nodeDetails);
    return this;
  }

  public enterSystemInfo(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.systemInfo);
    return this;
  }

  public enterResources(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.resources);
    return this;
  }

  public enterAppendedCards(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.appendedCards);
    return this;
  }
}
