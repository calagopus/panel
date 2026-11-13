import { Registry } from 'shared';
import { z } from 'zod';
import { adminFullUserSchema } from '@/lib/schemas/admin/users';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { ActivityRegistry } from './activity.ts';
import { OAuthLinksRegistry } from './oauthLinks.ts';
import { ServersRegistry } from './servers.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.servers.mergeFrom(other.servers);
    this.oauthLinks.mergeFrom(other.oauthLinks);
    this.activity.mergeFrom(other.activity);

    return this;
  }

  /** @since 1.1.1 */
  public subNavigation = new SubNavigationRegistry<{ user: z.infer<typeof adminFullUserSchema> }>();
  /** @since 1.1.1 */
  public servers: ServersRegistry = new ServersRegistry();
  /** @since 1.1.1 */
  public oauthLinks: OAuthLinksRegistry = new OAuthLinksRegistry();
  /** @since 1.1.1 */
  public activity: ActivityRegistry = new ActivityRegistry();

  /** @since 1.1.1 */
  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ user: z.infer<typeof adminFullUserSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.1 */
  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }

  /** @since 1.1.1 */
  public enterOAuthLinks(callback: (registry: OAuthLinksRegistry) => unknown): this {
    callback(this.oauthLinks);
    return this;
  }

  /** @since 1.1.1 */
  public enterActivity(callback: (registry: ActivityRegistry) => unknown): this {
    callback(this.activity);
    return this;
  }
}
