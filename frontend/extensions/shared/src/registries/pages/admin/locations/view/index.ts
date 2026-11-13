import { Registry } from 'shared';
import { z } from 'zod';
import { adminLocationSchema } from '@/lib/schemas/admin/locations';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { DatabaseAgentHostsRegistry } from './databaseAgentHosts.ts';
import { DatabaseHostsRegistry } from './databaseHosts.ts';
import { NodesRegistry } from './nodes.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.databaseHosts.mergeFrom(other.databaseHosts);
    this.databaseAgentHosts.mergeFrom(other.databaseAgentHosts);
    this.nodes.mergeFrom(other.nodes);

    return this;
  }

  /** @since 1.1.1 */
  public subNavigation = new SubNavigationRegistry<{ location: z.infer<typeof adminLocationSchema> }>();
  /** @since 1.1.1 */
  public databaseHosts: DatabaseHostsRegistry = new DatabaseHostsRegistry();
  /** @since 1.1.1 */
  public databaseAgentHosts: DatabaseAgentHostsRegistry = new DatabaseAgentHostsRegistry();
  /** @since 1.1.1 */
  public nodes: NodesRegistry = new NodesRegistry();

  /** @since 1.1.1 */
  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ location: z.infer<typeof adminLocationSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.1 */
  public enterDatabaseHosts(callback: (registry: DatabaseHostsRegistry) => unknown): this {
    callback(this.databaseHosts);
    return this;
  }

  /** @since 1.1.1 */
  public enterDatabaseAgentHosts(callback: (registry: DatabaseAgentHostsRegistry) => unknown): this {
    callback(this.databaseAgentHosts);
    return this;
  }

  /** @since 1.1.1 */
  public enterNodes(callback: (registry: NodesRegistry) => unknown): this {
    callback(this.nodes);
    return this;
  }
}
