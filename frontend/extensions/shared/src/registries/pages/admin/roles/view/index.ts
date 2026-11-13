import { Registry } from 'shared';
import { z } from 'zod';
import { roleSchema } from '@/lib/schemas/user';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { UsersRegistry } from './users.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.users.mergeFrom(other.users);

    return this;
  }

  /** @since 1.1.1 */
  public subNavigation = new SubNavigationRegistry<{ role: z.infer<typeof roleSchema> }>();
  /** @since 1.1.1 */
  public users: UsersRegistry = new UsersRegistry();

  /** @since 1.1.1 */
  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ role: z.infer<typeof roleSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  /** @since 1.1.1 */
  public enterUsers(callback: (registry: UsersRegistry) => unknown): this {
    callback(this.users);
    return this;
  }
}
