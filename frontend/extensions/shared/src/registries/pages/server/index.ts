import type { FC } from 'react';
import { Registry } from 'shared';
import { ActivityRegistry } from './activity.ts';
import { BackupsRegistry } from './backups/index.ts';
import { ConsoleRegistry } from './console.ts';
import { DatabasesRegistry } from './databases/index.ts';
import { FilesRegistry } from './files.ts';
import { MountsRegistry } from './mounts.ts';
import { NetworkRegistry } from './network/index.ts';
import { SettingsRegistry } from './settings.ts';
import { StartupRegistry } from './startup.ts';
import { SubusersRegistry } from './subusers.ts';

export class ServerRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.console.mergeFrom(other.console);
    this.files.mergeFrom(other.files);
    this.databases.mergeFrom(other.databases);
    this.subusers.mergeFrom(other.subusers);
    this.backups.mergeFrom(other.backups);
    this.network.mergeFrom(other.network);
    this.startup.mergeFrom(other.startup);
    this.mounts.mergeFrom(other.mounts);
    this.settings.mergeFrom(other.settings);
    this.activity.mergeFrom(other.activity);

    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  public console: ConsoleRegistry = new ConsoleRegistry();
  public files: FilesRegistry = new FilesRegistry();
  public databases: DatabasesRegistry = new DatabasesRegistry();
  public subusers: SubusersRegistry = new SubusersRegistry();
  public backups: BackupsRegistry = new BackupsRegistry();
  public network: NetworkRegistry = new NetworkRegistry();
  public startup: StartupRegistry = new StartupRegistry();
  public mounts: MountsRegistry = new MountsRegistry();
  public settings: SettingsRegistry = new SettingsRegistry();
  public activity: ActivityRegistry = new ActivityRegistry();

  public prependedComponents: FC[] = [];
  public appendedComponents: FC[] = [];

  public enterConsole(callback: (registry: ConsoleRegistry) => unknown): this {
    callback(this.console);
    return this;
  }

  public enterFiles(callback: (registry: FilesRegistry) => unknown): this {
    callback(this.files);
    return this;
  }

  public enterDatabases(callback: (registry: DatabasesRegistry) => unknown): this {
    callback(this.databases);
    return this;
  }

  public enterSubusers(callback: (registry: SubusersRegistry) => unknown): this {
    callback(this.subusers);
    return this;
  }

  public enterBackups(callback: (registry: BackupsRegistry) => unknown): this {
    callback(this.backups);
    return this;
  }

  public enterNetwork(callback: (registry: NetworkRegistry) => unknown): this {
    callback(this.network);
    return this;
  }

  public enterStartup(callback: (registry: StartupRegistry) => unknown): this {
    callback(this.startup);
    return this;
  }

  public enterMounts(callback: (registry: MountsRegistry) => unknown): this {
    callback(this.mounts);
    return this;
  }

  public enterSettings(callback: (registry: SettingsRegistry) => unknown): this {
    callback(this.settings);
    return this;
  }

  public enterActivity(callback: (registry: ActivityRegistry) => unknown): this {
    callback(this.activity);
    return this;
  }

  public prependComponent(component: FC): this {
    this.prependedComponents.push(component);
    return this;
  }

  public appendComponent(component: FC): this {
    this.appendedComponents.push(component);
    return this;
  }
}
