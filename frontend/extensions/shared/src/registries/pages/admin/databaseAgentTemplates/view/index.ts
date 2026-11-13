import { Registry } from 'shared';
import { z } from 'zod';
import { adminDatabaseAgentTemplateSchema } from '@/lib/schemas/admin/databaseAgentTemplates';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { InstancesRegistry } from './instances.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.instances.mergeFrom(other.instances);

    return this;
  }

  /** @since 1.1.1 */
  public subNavigation = new SubNavigationRegistry<{
    databaseAgentTemplate: z.infer<typeof adminDatabaseAgentTemplateSchema>;
  }>();
  /** @since 1.1.1 */
  public instances: InstancesRegistry = new InstancesRegistry();

  /** @since 1.1.1 */
  public enterSubNavigation(
    callback: (
      registry: SubNavigationRegistry<{ databaseAgentTemplate: z.infer<typeof adminDatabaseAgentTemplateSchema> }>,
    ) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.1 */
  public enterInstances(callback: (registry: InstancesRegistry) => unknown): this {
    callback(this.instances);
    return this;
  }
}
