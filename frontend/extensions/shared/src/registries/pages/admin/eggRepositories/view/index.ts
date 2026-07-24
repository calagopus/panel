import { Registry } from 'shared';
import { z } from 'zod';
import { adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { EggsRegistry } from './eggs.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.eggs.mergeFrom(other.eggs);

    return this;
  }

  public subNavigation = new SubNavigationRegistry<{ eggRepository: z.infer<typeof adminEggRepositorySchema> }>();
  public eggs: EggsRegistry = new EggsRegistry();

  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ eggRepository: z.infer<typeof adminEggRepositorySchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  public enterEggs(callback: (registry: EggsRegistry) => unknown): this {
    callback(this.eggs);
    return this;
  }
}
