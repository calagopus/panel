import type { FC } from 'react';
import { Registry } from 'shared';
import { AccountRegistry } from './account.ts';
import { ActivityRegistry } from './activity.ts';
import { ApiKeysRegistry } from './apiKeys.ts';
import { CommandSnippetsRegistry } from './commandSnippets.ts';
import { HomeRegistry } from './home.ts';
import { KeyboardShortcutsRegistry } from './keyboardShortcuts.ts';
import { OAuthLinksRegistry } from './oauthLinks.ts';
import { SecurityKeysRegistry } from './securityKeys.ts';
import { SessionsRegistry } from './sessions.ts';
import { SshKeysRegistry } from './sshKeys.ts';

export class DashboardRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.home.mergeFrom(other.home);
    this.account.mergeFrom(other.account);
    this.securityKeys.mergeFrom(other.securityKeys);
    this.apiKeys.mergeFrom(other.apiKeys);
    this.sshKeys.mergeFrom(other.sshKeys);
    this.commandSnippets.mergeFrom(other.commandSnippets);
    this.oauthLinks.mergeFrom(other.oauthLinks);
    this.sessions.mergeFrom(other.sessions);
    this.keyboardShortcuts.mergeFrom(other.keyboardShortcuts);
    this.activity.mergeFrom(other.activity);

    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  /** @since 1.0.0 */
  public home: HomeRegistry = new HomeRegistry();
  /** @since 1.0.0 */
  public account: AccountRegistry = new AccountRegistry();
  /** @since 1.0.0 */
  public securityKeys: SecurityKeysRegistry = new SecurityKeysRegistry();
  /** @since 1.0.0 */
  public apiKeys: ApiKeysRegistry = new ApiKeysRegistry();
  /** @since 1.0.0 */
  public sshKeys: SshKeysRegistry = new SshKeysRegistry();
  /** @since 1.0.0 */
  public commandSnippets: CommandSnippetsRegistry = new CommandSnippetsRegistry();
  /** @since 1.0.0 */
  public oauthLinks: OAuthLinksRegistry = new OAuthLinksRegistry();
  /** @since 1.0.0 */
  public sessions: SessionsRegistry = new SessionsRegistry();
  /** @since 1.0.0 */
  public keyboardShortcuts: KeyboardShortcutsRegistry = new KeyboardShortcutsRegistry();
  /** @since 1.0.0 */
  public activity: ActivityRegistry = new ActivityRegistry();

  /** @since 1.0.0 */
  public prependedComponents: FC[] = [];
  /** @since 1.0.0 */
  public appendedComponents: FC[] = [];

  /** @since 1.0.0 */
  public enterHome(callback: (registry: HomeRegistry) => unknown): this {
    callback(this.home);
    return this;
  }

  /** @since 1.0.0 */
  public enterAccount(callback: (registry: AccountRegistry) => unknown): this {
    callback(this.account);
    return this;
  }

  /** @since 1.0.0 */
  public enterSecurityKeys(callback: (registry: SecurityKeysRegistry) => unknown): this {
    callback(this.securityKeys);
    return this;
  }

  /** @since 1.0.0 */
  public enterApiKeys(callback: (registry: ApiKeysRegistry) => unknown): this {
    callback(this.apiKeys);
    return this;
  }

  /** @since 1.0.0 */
  public enterSshKeys(callback: (registry: SshKeysRegistry) => unknown): this {
    callback(this.sshKeys);
    return this;
  }

  /** @since 1.0.0 */
  public enterCommandSnippets(callback: (registry: CommandSnippetsRegistry) => unknown): this {
    callback(this.commandSnippets);
    return this;
  }

  /** @since 1.0.0 */
  public enterOAuthLinks(callback: (registry: OAuthLinksRegistry) => unknown): this {
    callback(this.oauthLinks);
    return this;
  }

  /** @since 1.0.0 */
  public enterSessions(callback: (registry: SessionsRegistry) => unknown): this {
    callback(this.sessions);
    return this;
  }

  /** @since 1.0.0 */
  public enterKeyboardShortcuts(callback: (registry: KeyboardShortcutsRegistry) => unknown): this {
    callback(this.keyboardShortcuts);
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
