import { Registry } from 'shared';
import { z } from 'zod';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { BackupsRegistry } from './backups.ts';
import { LocationsRegistry } from './locations.ts';
import { NodesRegistry } from './nodes.ts';
import { ServersRegistry } from './servers.ts';
import { StatsRegistry } from './stats.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.stats.mergeFrom(other.stats);
    this.backups.mergeFrom(other.backups);
    this.locations.mergeFrom(other.locations);
    this.nodes.mergeFrom(other.nodes);
    this.servers.mergeFrom(other.servers);

    return this;
  }

  /** @since 1.1.4 */
  public subNavigation = new SubNavigationRegistry<{
    backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
  }>();
  /** @since 1.1.4 */
  public stats: StatsRegistry = new StatsRegistry();
  /** @since 1.1.4 */
  public backups: BackupsRegistry = new BackupsRegistry();
  /** @since 1.1.4 */
  public locations: LocationsRegistry = new LocationsRegistry();
  /** @since 1.1.4 */
  public nodes: NodesRegistry = new NodesRegistry();
  /** @since 1.1.4 */
  public servers: ServersRegistry = new ServersRegistry();

  /** @since 1.1.4 */
  public enterSubNavigation(
    callback: (
      registry: SubNavigationRegistry<{ backupConfiguration: z.infer<typeof adminBackupConfigurationSchema> }>,
    ) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.4 */
  public enterStats(callback: (registry: StatsRegistry) => unknown): this {
    callback(this.stats);
    return this;
  }

  /** @since 1.1.4 */
  public enterBackups(callback: (registry: BackupsRegistry) => unknown): this {
    callback(this.backups);
    return this;
  }

  /** @since 1.1.4 */
  public enterLocations(callback: (registry: LocationsRegistry) => unknown): this {
    callback(this.locations);
    return this;
  }

  /** @since 1.1.4 */
  public enterNodes(callback: (registry: NodesRegistry) => unknown): this {
    callback(this.nodes);
    return this;
  }

  /** @since 1.1.4 */
  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }
}
