import { ContainerRegistry, Registry } from 'shared';
import { FormContainerRegistry } from 'shared/src/registries/slices/form';
import type { Props as ContainerProps } from '@/elements/containers/AdminContentContainer.tsx';
import { adminServerCreateSchema } from '@/lib/schemas/admin/servers.ts';

export class CreateRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.formContainers.mergeFrom(other.formContainers);
    this.basicInformationFormContainer.mergeFrom(other.basicInformationFormContainer);
    this.serverAssignmentFormContainer.mergeFrom(other.serverAssignmentFormContainer);
    this.resourceLimitsFormContainer.mergeFrom(other.resourceLimitsFormContainer);
    this.serverConfigurationFormContainer.mergeFrom(other.serverConfigurationFormContainer);
    this.featureLimitsFormContainer.mergeFrom(other.featureLimitsFormContainer);
    this.allocationsFormContainer.mergeFrom(other.allocationsFormContainer);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public formContainers: FormContainerRegistry<typeof adminServerCreateSchema> = new FormContainerRegistry();
  public basicInformationFormContainer: FormContainerRegistry<typeof adminServerCreateSchema> =
    new FormContainerRegistry();
  public serverAssignmentFormContainer: FormContainerRegistry<typeof adminServerCreateSchema> =
    new FormContainerRegistry();
  public resourceLimitsFormContainer: FormContainerRegistry<typeof adminServerCreateSchema> =
    new FormContainerRegistry();
  public serverConfigurationFormContainer: FormContainerRegistry<typeof adminServerCreateSchema> =
    new FormContainerRegistry();
  public featureLimitsFormContainer: FormContainerRegistry<typeof adminServerCreateSchema> =
    new FormContainerRegistry();
  public allocationsFormContainer: FormContainerRegistry<typeof adminServerCreateSchema> = new FormContainerRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterFormContainers(
    callback: (registry: FormContainerRegistry<typeof adminServerCreateSchema>) => unknown,
  ): this {
    callback(this.formContainers);
    return this;
  }

  public enterBasicInformationFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerCreateSchema>) => unknown,
  ): this {
    callback(this.basicInformationFormContainer);
    return this;
  }

  public enterServerAssignmentFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerCreateSchema>) => unknown,
  ): this {
    callback(this.serverAssignmentFormContainer);
    return this;
  }

  public enterResourceLimitsFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerCreateSchema>) => unknown,
  ): this {
    callback(this.resourceLimitsFormContainer);
    return this;
  }

  public enterServerConfigurationFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerCreateSchema>) => unknown,
  ): this {
    callback(this.serverConfigurationFormContainer);
    return this;
  }

  public enterFeatureLimitsFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerCreateSchema>) => unknown,
  ): this {
    callback(this.featureLimitsFormContainer);
    return this;
  }

  public enterAllocationsFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerCreateSchema>) => unknown,
  ): this {
    callback(this.allocationsFormContainer);
    return this;
  }
}
