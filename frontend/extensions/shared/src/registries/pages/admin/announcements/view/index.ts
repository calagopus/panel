import { Registry } from 'shared';
import { z } from 'zod';
import { adminAnnouncementSchema } from '@/lib/schemas/admin/announcements';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);

    return this;
  }

  public subNavigation = new SubNavigationRegistry<{ announcement: z.infer<typeof adminAnnouncementSchema> }>();

  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ announcement: z.infer<typeof adminAnnouncementSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }
}
