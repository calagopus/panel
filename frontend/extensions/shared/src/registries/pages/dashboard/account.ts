import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/AccountContentContainer.tsx';
import { AccountCardProps } from '@/pages/dashboard/account/DashboardAccount.tsx';
import { ComponentListRegistry } from '../../slices/componentList.ts';

export class AccountRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.accountContainers.mergeFrom(other.accountContainers);

    return this;
  }

  /** @since 1.0.0 */
  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  /**
   * Cards in the account page grid, blurred while two factor activation is required.
   * @since 1.0.0
   */
  public accountContainers: ComponentListRegistry<AccountCardProps> = new ComponentListRegistry();

  /** @since 1.0.0 */
  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  /** @since 1.0.0 */
  public enterAccountContainers(callback: (registry: ComponentListRegistry<AccountCardProps>) => unknown): this {
    callback(this.accountContainers);
    return this;
  }
}
