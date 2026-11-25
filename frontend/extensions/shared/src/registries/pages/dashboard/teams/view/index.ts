import { Registry } from 'shared';
import { z } from 'zod';
import { userTeamSchema } from '@/lib/schemas/user/teams.ts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { ActivityRegistry } from './activity.ts';
import { MembersRegistry } from './members.ts';
import { PresetsRegistry } from './presets.ts';
import { ServersRegistry } from './servers.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.servers.mergeFrom(other.servers);
    this.members.mergeFrom(other.members);
    this.presets.mergeFrom(other.presets);
    this.activity.mergeFrom(other.activity);

    return this;
  }

  /** @since 1.3.0 */
  public subNavigation = new SubNavigationRegistry<{ team: z.infer<typeof userTeamSchema> }>();
  /** @since 1.3.0 */
  public servers: ServersRegistry = new ServersRegistry();
  /** @since 1.3.0 */
  public members: MembersRegistry = new MembersRegistry();
  /** @since 1.3.0 */
  public presets: PresetsRegistry = new PresetsRegistry();
  /** @since 1.3.0 */
  public activity: ActivityRegistry = new ActivityRegistry();

  /** @since 1.3.0 */
  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ team: z.infer<typeof userTeamSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.3.0 */
  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }

  /** @since 1.3.0 */
  public enterMembers(callback: (registry: MembersRegistry) => unknown): this {
    callback(this.members);
    return this;
  }

  /** @since 1.3.0 */
  public enterPresets(callback: (registry: PresetsRegistry) => unknown): this {
    callback(this.presets);
    return this;
  }

  /** @since 1.3.0 */
  public enterActivity(callback: (registry: ActivityRegistry) => unknown): this {
    callback(this.activity);
    return this;
  }
}
