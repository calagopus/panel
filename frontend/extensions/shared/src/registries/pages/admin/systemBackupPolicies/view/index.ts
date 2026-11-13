import { Registry } from 'shared';
import { z } from 'zod';
import { adminSystemBackupPolicySchema } from '@/lib/schemas/admin/systemBackupPolicies.ts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { BackupsRegistry } from './backups.ts';
import { DatabaseAgentHostsRegistry } from './databaseAgentHosts.ts';
import { LocationsRegistry } from './locations.ts';
import { NodesRegistry } from './nodes.ts';
import { RunsRegistry } from './runs.ts';
import { ServersRegistry } from './servers.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.backups.mergeFrom(other.backups);
    this.databaseAgentHosts.mergeFrom(other.databaseAgentHosts);
    this.locations.mergeFrom(other.locations);
    this.nodes.mergeFrom(other.nodes);
    this.runs.mergeFrom(other.runs);
    this.servers.mergeFrom(other.servers);

    return this;
  }

  /** @since 1.1.4 */
  public subNavigation = new SubNavigationRegistry<{
    systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema>;
  }>();
  /** @since 1.1.4 */
  public backups: BackupsRegistry = new BackupsRegistry();
  /** @since 1.2.1 */
  public databaseAgentHosts: DatabaseAgentHostsRegistry = new DatabaseAgentHostsRegistry();
  /** @since 1.1.4 */
  public locations: LocationsRegistry = new LocationsRegistry();
  /** @since 1.1.4 */
  public nodes: NodesRegistry = new NodesRegistry();
  /** @since 1.2.9 */
  public runs: RunsRegistry = new RunsRegistry();
  /** @since 1.1.4 */
  public servers: ServersRegistry = new ServersRegistry();

  /** @since 1.1.4 */
  public enterSubNavigation(
    callback: (
      registry: SubNavigationRegistry<{ systemBackupPolicy: z.infer<typeof adminSystemBackupPolicySchema> }>,
    ) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.4 */
  public enterBackups(callback: (registry: BackupsRegistry) => unknown): this {
    callback(this.backups);
    return this;
  }

  /** @since 1.2.1 */
  public enterDatabaseAgentHosts(callback: (registry: DatabaseAgentHostsRegistry) => unknown): this {
    callback(this.databaseAgentHosts);
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

  /** @since 1.2.9 */
  public enterRuns(callback: (registry: RunsRegistry) => unknown): this {
    callback(this.runs);
    return this;
  }

  /** @since 1.1.4 */
  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }
}
