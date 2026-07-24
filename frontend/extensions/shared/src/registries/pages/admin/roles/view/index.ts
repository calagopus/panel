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

  public subNavigation = new SubNavigationRegistry<{ role: z.infer<typeof roleSchema> }>();
  public users: UsersRegistry = new UsersRegistry();

  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ role: z.infer<typeof roleSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  public enterUsers(callback: (registry: UsersRegistry) => unknown): this {
    callback(this.users);
    return this;
  }
}
