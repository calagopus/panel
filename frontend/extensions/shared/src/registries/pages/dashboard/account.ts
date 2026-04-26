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

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public accountContainers: ComponentListRegistry<AccountCardProps> = new ComponentListRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterAccountContainers(callback: (registry: ComponentListRegistry<AccountCardProps>) => unknown): this {
    callback(this.accountContainers);
    return this;
  }
}
