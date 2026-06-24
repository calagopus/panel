import { Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';
import { z } from 'zod';
import { adminServerSchema } from '@/lib/schemas/admin/servers';

type PageProps = { server: z.infer<typeof adminServerSchema> };

export class OverviewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.featureLimits.mergeFrom(other.featureLimits);

    return this;
  }

  public featureLimits: ComponentListRegistry<PageProps> = new ComponentListRegistry();

  public enterFeatureLimits(callback: (registry: ComponentListRegistry<PageProps>) => unknown): this {
    callback(this.featureLimits);
    return this;
  }
}
