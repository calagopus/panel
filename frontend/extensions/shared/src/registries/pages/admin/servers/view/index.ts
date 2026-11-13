import { Registry } from 'shared';
import { z } from 'zod';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { AllocationsRegistry } from './allocations.ts';
import { BackupsRegistry } from './backups.ts';
import { DatabasesRegistry } from './databases.ts';
import { DevicesRegistry } from './devices.ts';
import { LogsRegistry } from './logs.ts';
import { ManagementRegistry } from './management.ts';
import { MountsRegistry } from './mounts.ts';
import { OverviewRegistry } from './overview.ts';
import { UpdateRegistry } from './update.ts';
import { VariablesRegistry } from './variables.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.overview.mergeFrom(other.overview);
    this.update.mergeFrom(other.update);
    this.allocations.mergeFrom(other.allocations);
    this.variables.mergeFrom(other.variables);
    this.mounts.mergeFrom(other.mounts);
    this.devices.mergeFrom(other.devices);
    this.backups.mergeFrom(other.backups);
    this.databases.mergeFrom(other.databases);
    this.logs.mergeFrom(other.logs);
    this.management.mergeFrom(other.management);

    return this;
  }

  /** @since 1.0.3 */
  public subNavigation = new SubNavigationRegistry<{ server: z.infer<typeof adminServerSchema> }>();
  /** @since 1.1.0 */
  public overview: OverviewRegistry = new OverviewRegistry();
  /** @since 1.0.3 */
  public update: UpdateRegistry = new UpdateRegistry();
  /** @since 1.0.3 */
  public allocations: AllocationsRegistry = new AllocationsRegistry();
  /** @since 1.0.3 */
  public variables: VariablesRegistry = new VariablesRegistry();
  /** @since 1.0.3 */
  public mounts: MountsRegistry = new MountsRegistry();
  /** @since 1.2.3 */
  public devices: DevicesRegistry = new DevicesRegistry();
  /** @since 1.1.1 */
  public backups: BackupsRegistry = new BackupsRegistry();
  /** @since 1.1.1 */
  public databases: DatabasesRegistry = new DatabasesRegistry();
  /** @since 1.0.3 */
  public logs: LogsRegistry = new LogsRegistry();
  /** @since 1.0.3 */
  public management: ManagementRegistry = new ManagementRegistry();

  /** @since 1.0.3 */
  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ server: z.infer<typeof adminServerSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.0 */
  public enterOverview(callback: (registry: OverviewRegistry) => unknown): this {
    callback(this.overview);
    return this;
  }

  /** @since 1.0.3 */
  public enterUpdate(callback: (registry: UpdateRegistry) => unknown): this {
    callback(this.update);
    return this;
  }

  /** @since 1.0.3 */
  public enterAllocations(callback: (registry: AllocationsRegistry) => unknown): this {
    callback(this.allocations);
    return this;
  }

  /** @since 1.0.3 */
  public enterVariables(callback: (registry: VariablesRegistry) => unknown): this {
    callback(this.variables);
    return this;
  }

  /** @since 1.0.3 */
  public enterMounts(callback: (registry: MountsRegistry) => unknown): this {
    callback(this.mounts);
    return this;
  }

  /** @since 1.2.3 */
  public enterDevices(callback: (registry: DevicesRegistry) => unknown): this {
    callback(this.devices);
    return this;
  }

  /** @since 1.1.1 */
  public enterBackups(callback: (registry: BackupsRegistry) => unknown): this {
    callback(this.backups);
    return this;
  }

  /** @since 1.1.1 */
  public enterDatabases(callback: (registry: DatabasesRegistry) => unknown): this {
    callback(this.databases);
    return this;
  }

  /** @since 1.0.3 */
  public enterLogs(callback: (registry: LogsRegistry) => unknown): this {
    callback(this.logs);
    return this;
  }

  /** @since 1.0.3 */
  public enterManagement(callback: (registry: ManagementRegistry) => unknown): this {
    callback(this.management);
    return this;
  }
}
