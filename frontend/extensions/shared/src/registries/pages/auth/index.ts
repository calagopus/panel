import type { FC } from 'react';
import { Registry } from 'shared';
import { CheckpointRegistry } from './checkpoint.ts';
import { ForgotPasswordRegistry } from './forgotPassword.ts';
import { LoginRegistry } from './login.ts';
import { OAuthRegistry } from './oauth.ts';
import { RegisterRegistry } from './register.ts';
import { ResetPasswordRegistry } from './resetPassword.ts';
import { VerifyEmailRegistry } from './verifyEmail.ts';

export class AuthRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.login.mergeFrom(other.login);
    this.register.mergeFrom(other.register);
    this.forgotPassword.mergeFrom(other.forgotPassword);
    this.resetPassword.mergeFrom(other.resetPassword);
    this.verifyEmail.mergeFrom(other.verifyEmail);
    this.checkpoint.mergeFrom(other.checkpoint);
    this.oauth.mergeFrom(other.oauth);

    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  /** @since 1.1.1 */
  public login: LoginRegistry = new LoginRegistry();
  /** @since 1.1.1 */
  public register: RegisterRegistry = new RegisterRegistry();
  /** @since 1.1.1 */
  public forgotPassword: ForgotPasswordRegistry = new ForgotPasswordRegistry();
  /** @since 1.1.1 */
  public resetPassword: ResetPasswordRegistry = new ResetPasswordRegistry();
  /** @since 1.2.0 */
  public verifyEmail: VerifyEmailRegistry = new VerifyEmailRegistry();
  /** @since 1.1.1 */
  public checkpoint: CheckpointRegistry = new CheckpointRegistry();
  /** @since 1.1.1 */
  public oauth: OAuthRegistry = new OAuthRegistry();

  /** @since 1.1.1 */
  public prependedComponents: FC[] = [];
  /** @since 1.1.1 */
  public appendedComponents: FC[] = [];

  /** @since 1.1.1 */
  public enterLogin(callback: (registry: LoginRegistry) => unknown): this {
    callback(this.login);
    return this;
  }

  /** @since 1.1.1 */
  public enterRegister(callback: (registry: RegisterRegistry) => unknown): this {
    callback(this.register);
    return this;
  }

  /** @since 1.1.1 */
  public enterForgotPassword(callback: (registry: ForgotPasswordRegistry) => unknown): this {
    callback(this.forgotPassword);
    return this;
  }

  /** @since 1.1.1 */
  public enterResetPassword(callback: (registry: ResetPasswordRegistry) => unknown): this {
    callback(this.resetPassword);
    return this;
  }

  /** @since 1.2.0 */
  public enterVerifyEmail(callback: (registry: VerifyEmailRegistry) => unknown): this {
    callback(this.verifyEmail);
    return this;
  }

  /** @since 1.1.1 */
  public enterCheckpoint(callback: (registry: CheckpointRegistry) => unknown): this {
    callback(this.checkpoint);
    return this;
  }

  /** @since 1.1.1 */
  public enterOAuth(callback: (registry: OAuthRegistry) => unknown): this {
    callback(this.oauth);
    return this;
  }

  /**
   * Adds a component rendered before every authentication page's content
   * @since 1.1.1
   */
  public prependComponent(component: FC): this {
    this.prependedComponents.push(component);
    return this;
  }

  /**
   * Adds a component rendered after every authentication page's content
   * @since 1.1.1
   */
  public appendComponent(component: FC): this {
    this.appendedComponents.push(component);
    return this;
  }
}
