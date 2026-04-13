import { ContainerRegistry, Registry } from 'shared';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminServerSchema } from '@/lib/schemas/admin/servers.ts';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { AllocationsRegistry } from './allocations.ts';
import { LogsRegistry } from './logs.ts';
import { ManagementRegistry } from './management.ts';
import { MountsRegistry } from './mounts.ts';
import { UpdateRegistry } from './update.ts';
import { VariablesRegistry } from './variables.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.subNavigation.mergeFrom(other.subNavigation);
    this.update.mergeFrom(other.update);
    this.allocations.mergeFrom(other.allocations);
    this.variables.mergeFrom(other.variables);
    this.mounts.mergeFrom(other.mounts);
    this.logs.mergeFrom(other.logs);
    this.management.mergeFrom(other.management);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps> = new ContainerRegistry();
  public subNavigation = new SubNavigationRegistry<{ server: z.infer<typeof adminServerSchema> }>();
  public update: UpdateRegistry = new UpdateRegistry();
  public allocations: AllocationsRegistry = new AllocationsRegistry();
  public variables: VariablesRegistry = new VariablesRegistry();
  public mounts: MountsRegistry = new MountsRegistry();
  public logs: LogsRegistry = new LogsRegistry();
  public management: ManagementRegistry = new ManagementRegistry();

  public enterSubContainer(callback: (registry: ContainerRegistry<SubContainerProps>) => unknown): this {
    callback(this.subContainer);
    return this;
  }

  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ server: z.infer<typeof adminServerSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  public enterUpdate(callback: (registry: UpdateRegistry) => unknown): this {
    callback(this.update);
    return this;
  }

  public enterAllocations(callback: (registry: AllocationsRegistry) => unknown): this {
    callback(this.allocations);
    return this;
  }

  public enterVariables(callback: (registry: VariablesRegistry) => unknown): this {
    callback(this.variables);
    return this;
  }

  public enterMounts(callback: (registry: MountsRegistry) => unknown): this {
    callback(this.mounts);
    return this;
  }

  public enterLogs(callback: (registry: LogsRegistry) => unknown): this {
    callback(this.logs);
    return this;
  }

  public enterManagement(callback: (registry: ManagementRegistry) => unknown): this {
    callback(this.management);
    return this;
  }
}
