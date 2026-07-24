import type { FC } from 'react';
import { Registry } from 'shared';
import { CheckpointRegistry } from './checkpoint.ts';
import { ForgotPasswordRegistry } from './forgotPassword.ts';
import { LoginRegistry } from './login.ts';
import { OAuthRegistry } from './oauth.ts';
import { RegisterRegistry } from './register.ts';
import { ResetPasswordRegistry } from './resetPassword.ts';

export class AuthRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.login.mergeFrom(other.login);
    this.register.mergeFrom(other.register);
    this.forgotPassword.mergeFrom(other.forgotPassword);
    this.resetPassword.mergeFrom(other.resetPassword);
    this.checkpoint.mergeFrom(other.checkpoint);
    this.oauth.mergeFrom(other.oauth);

    this.prependedComponents.push(...other.prependedComponents);
    this.appendedComponents.push(...other.appendedComponents);

    return this;
  }

  public login: LoginRegistry = new LoginRegistry();
  public register: RegisterRegistry = new RegisterRegistry();
  public forgotPassword: ForgotPasswordRegistry = new ForgotPasswordRegistry();
  public resetPassword: ResetPasswordRegistry = new ResetPasswordRegistry();
  public checkpoint: CheckpointRegistry = new CheckpointRegistry();
  public oauth: OAuthRegistry = new OAuthRegistry();

  public prependedComponents: FC[] = [];
  public appendedComponents: FC[] = [];

  public enterLogin(callback: (registry: LoginRegistry) => unknown): this {
    callback(this.login);
    return this;
  }

  public enterRegister(callback: (registry: RegisterRegistry) => unknown): this {
    callback(this.register);
    return this;
  }

  public enterForgotPassword(callback: (registry: ForgotPasswordRegistry) => unknown): this {
    callback(this.forgotPassword);
    return this;
  }

  public enterResetPassword(callback: (registry: ResetPasswordRegistry) => unknown): this {
    callback(this.resetPassword);
    return this;
  }

  public enterCheckpoint(callback: (registry: CheckpointRegistry) => unknown): this {
    callback(this.checkpoint);
    return this;
  }

  public enterOAuth(callback: (registry: OAuthRegistry) => unknown): this {
    callback(this.oauth);
    return this;
  }

  // Adds a component rendered before every authentication page's content
  public prependComponent(component: FC): this {
    this.prependedComponents.push(component);
    return this;
  }

  // Adds a component rendered after every authentication page's content
  public appendComponent(component: FC): this {
    this.appendedComponents.push(component);
    return this;
  }
}
