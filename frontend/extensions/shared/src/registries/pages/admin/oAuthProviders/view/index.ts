import { Registry } from 'shared';
import { z } from 'zod';
import { adminOAuthProviderSchema } from '@/lib/schemas/admin/oauthProviders';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { MappingsRegistry } from './mappings.ts';
import { UsersRegistry } from './users.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.mappings.mergeFrom(other.mappings);
    this.users.mergeFrom(other.users);

    return this;
  }

  public subNavigation = new SubNavigationRegistry<{ oauthProvider: z.infer<typeof adminOAuthProviderSchema> }>();
  public mappings: MappingsRegistry = new MappingsRegistry();
  public users: UsersRegistry = new UsersRegistry();

  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ oauthProvider: z.infer<typeof adminOAuthProviderSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  public enterMappings(callback: (registry: MappingsRegistry) => unknown): this {
    callback(this.mappings);
    return this;
  }

  public enterUsers(callback: (registry: UsersRegistry) => unknown): this {
    callback(this.users);
    return this;
  }
}
