import { ContainerRegistry, Registry } from 'shared';
import { FormContainerRegistry } from 'shared/src/registries/slices/form';
import { z } from 'zod';
import type { Props as SubContainerProps } from '@/elements/containers/AdminSubContentContainer.tsx';
import { adminServerSchema, adminServerUpdateSchema } from '@/lib/schemas/admin/servers';

type PageProps = { server: z.infer<typeof adminServerSchema> };

export class UpdateRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subContainer.mergeFrom(other.subContainer);
    this.formContainers.mergeFrom(other.formContainers);
    this.basicInformationFormContainer.mergeFrom(other.basicInformationFormContainer);
    this.serverAssignmentFormContainer.mergeFrom(other.serverAssignmentFormContainer);
    this.resourceLimitsFormContainer.mergeFrom(other.resourceLimitsFormContainer);
    this.serverConfigurationFormContainer.mergeFrom(other.serverConfigurationFormContainer);
    this.featureLimitsFormContainer.mergeFrom(other.featureLimitsFormContainer);
    this.allocationsFormContainer.mergeFrom(other.allocationsFormContainer);

    return this;
  }

  public subContainer: ContainerRegistry<SubContainerProps<PageProps>> = new ContainerRegistry();
  public formContainers: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps> = new FormContainerRegistry();
  public basicInformationFormContainer: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps> =
    new FormContainerRegistry();
  public serverAssignmentFormContainer: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps> =
    new FormContainerRegistry();
  public resourceLimitsFormContainer: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps> =
    new FormContainerRegistry();
  public serverConfigurationFormContainer: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps> =
    new FormContainerRegistry();
  public featureLimitsFormContainer: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps> =
    new FormContainerRegistry();
  public allocationsFormContainer: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps> =
    new FormContainerRegistry();

  public enterSubContainer(callback: (registry: ContainerRegistry<SubContainerProps<PageProps>>) => unknown): this {
    callback(this.subContainer);
    return this;
  }

  public enterFormContainers(
    callback: (registry: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps>) => unknown,
  ): this {
    callback(this.formContainers);
    return this;
  }

  public enterBasicInformationFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps>) => unknown,
  ): this {
    callback(this.basicInformationFormContainer);
    return this;
  }

  public enterServerAssignmentFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps>) => unknown,
  ): this {
    callback(this.serverAssignmentFormContainer);
    return this;
  }

  public enterResourceLimitsFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps>) => unknown,
  ): this {
    callback(this.resourceLimitsFormContainer);
    return this;
  }

  public enterServerConfigurationFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps>) => unknown,
  ): this {
    callback(this.serverConfigurationFormContainer);
    return this;
  }

  public enterFeatureLimitsFormContainer(
    callback: (registry: FormContainerRegistry<typeof adminServerUpdateSchema, PageProps>) => unknown,
  ): this {
    callback(this.featureLimitsFormContainer);
    return this;
  }
}
