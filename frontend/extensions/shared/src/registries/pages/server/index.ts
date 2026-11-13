import type { FC } from 'react';
import { Registry } from 'shared';
import { ActivityRegistry } from './activity.ts';
import { BackupsRegistry } from './backups/index.ts';
import { ConsoleRegistry } from './console/index.ts';
import { DatabasesRegistry } from './databases/index.ts';
import { DevicesRegistry } from './devices.ts';
import { FilesRegistry } from './files/index.ts';
import { MountsRegistry } from './mounts.ts';
import { NetworkRegistry } from './network/index.ts';
import { SchedulesRegistry } from './schedules.ts';
import { SettingsRegistry } from './settings.ts';
import { StartupRegistry } from './startup.ts';
import { SubusersRegistry } from './subusers.ts';

export class ServerRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.console.mergeFrom(other.console);
    this.files.mergeFrom(other.files);
    this.databases.mergeFrom(other.databases);
    this.schedules.mergeFrom(other.schedules);
    this.subusers.mergeFrom(other.subusers);
    this.backups.mergeFrom(other.backups);
    this.network.mergeFrom(other.network);
    this.startup.mergeFrom(other.startup);
    this.mounts.mergeFrom(other.mounts);
    this.devices.mergeFrom(other.devices);
    this.settings.mergeFrom(other.settings);
    this.activity.mergeFrom(other.activity);

    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  /** @since 1.0.0 */
  public console: ConsoleRegistry = new ConsoleRegistry();
  /** @since 1.0.0 */
  public files: FilesRegistry = new FilesRegistry();
  /** @since 1.0.0 */
  public databases: DatabasesRegistry = new DatabasesRegistry();
  /** @since 1.2.3 */
  public schedules: SchedulesRegistry = new SchedulesRegistry();
  /** @since 1.0.0 */
  public subusers: SubusersRegistry = new SubusersRegistry();
  /** @since 1.0.0 */
  public backups: BackupsRegistry = new BackupsRegistry();
  /** @since 1.0.0 */
  public network: NetworkRegistry = new NetworkRegistry();
  /** @since 1.0.0 */
  public startup: StartupRegistry = new StartupRegistry();
  /** @since 1.0.0 */
  public mounts: MountsRegistry = new MountsRegistry();
  /** @since 1.2.3 */
  public devices: DevicesRegistry = new DevicesRegistry();
  /** @since 1.0.0 */
  public settings: SettingsRegistry = new SettingsRegistry();
  /** @since 1.0.0 */
  public activity: ActivityRegistry = new ActivityRegistry();

  /** @since 1.0.0 */
  public prependedComponents: FC[] = [];
  /** @since 1.0.0 */
  public appendedComponents: FC[] = [];

  /** @since 1.0.0 */
  public enterConsole(callback: (registry: ConsoleRegistry) => unknown): this {
    callback(this.console);
    return this;
  }

  /** @since 1.0.0 */
  public enterFiles(callback: (registry: FilesRegistry) => unknown): this {
    callback(this.files);
    return this;
  }

  /** @since 1.0.0 */
  public enterDatabases(callback: (registry: DatabasesRegistry) => unknown): this {
    callback(this.databases);
    return this;
  }

  /** @since 1.2.3 */
  public enterSchedules(callback: (registry: SchedulesRegistry) => unknown): this {
    callback(this.schedules);
    return this;
  }

  /** @since 1.0.0 */
  public enterSubusers(callback: (registry: SubusersRegistry) => unknown): this {
    callback(this.subusers);
    return this;
  }

  /** @since 1.0.0 */
  public enterBackups(callback: (registry: BackupsRegistry) => unknown): this {
    callback(this.backups);
    return this;
  }

  /** @since 1.0.0 */
  public enterNetwork(callback: (registry: NetworkRegistry) => unknown): this {
    callback(this.network);
    return this;
  }

  /** @since 1.0.0 */
  public enterStartup(callback: (registry: StartupRegistry) => unknown): this {
    callback(this.startup);
    return this;
  }

  /** @since 1.0.0 */
  public enterMounts(callback: (registry: MountsRegistry) => unknown): this {
    callback(this.mounts);
    return this;
  }

  /** @since 1.2.3 */
  public enterDevices(callback: (registry: DevicesRegistry) => unknown): this {
    callback(this.devices);
    return this;
  }

  /** @since 1.0.0 */
  public enterSettings(callback: (registry: SettingsRegistry) => unknown): this {
    callback(this.settings);
    return this;
  }

  /** @since 1.0.0 */
  public enterActivity(callback: (registry: ActivityRegistry) => unknown): this {
    callback(this.activity);
    return this;
  }

  /** @since 1.0.0 */
  public prependComponent(component: FC): this {
    this.prependedComponents.push(component);
    return this;
  }

  /** @since 1.0.0 */
  public appendComponent(component: FC): this {
    this.appendedComponents.push(component);
    return this;
  }
}
