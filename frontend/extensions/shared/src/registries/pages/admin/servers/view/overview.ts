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

  public owner: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  public nodeAndLocation: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  public serverDetails: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  public resourceLimits: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  public featureLimits: ComponentListRegistry<PageProps> = new ComponentListRegistry();
  public appendedCards: ComponentListRegistry<PageProps> = new ComponentListRegistry();

  public enterOwner(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.owner);
    return this;
  }

  public enterNodeAndLocation(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.nodeAndLocation);
    return this;
  }

  public enterServerDetails(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.serverDetails);
    return this;
  }

  public enterResourceLimits(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.resourceLimits);
    return this;
  }

  public enterFeatureLimits(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.featureLimits);
    return this;
  }

  public enterAppendedCards(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.appendedCards);
    return this;
  }
}
