import type { MantineColor } from '@mantine/core';
import { Registry } from 'shared';

export interface DiskUsageSection {
  id: string;
  label: string;
  color: MantineColor;
  /**
   * Bytes this section takes up of the total disk usage. `null` marks the remainder section,
   * which is sized to whatever the other sections leave over (stock: `files`).
   */
  bytes: number | null;
}

export interface DiskUsageBarProps {
  diskBytes: number;
  limitBytes: number;
}

type SectionInterceptor = (sections: DiskUsageSection[], props: DiskUsageBarProps) => void;
/**
 * Called as a React hook on every render of the bar, so it may use other hooks (e.g. `useQuery`)
 * to load the data its returned interceptor needs.
 */
type SectionHook = (props: DiskUsageBarProps) => (sections: DiskUsageSection[]) => void;

export class DiskUsageBarRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.sectionInterceptors.push(...other.sectionInterceptors);
    this.sectionHooks.push(...other.sectionHooks);

    return this;
  }

  /**
   * Mutate the sections in place, after the stock files and trash sections exist.
   * @since 1.2.8
   */
  public sectionInterceptors: SectionInterceptor[] = [];
  /**
   * Called as React hooks in the bar, each returns an interceptor that runs after `sectionInterceptors`.
   * @since 1.2.8
   */
  public sectionHooks: SectionHook[] = [];

  /** @since 1.2.8 */
  public addSectionInterceptor(interceptor: SectionInterceptor): this {
    this.sectionInterceptors.push(interceptor);
    return this;
  }

  /** @since 1.2.8 */
  public addSectionHook(hook: SectionHook): this {
    this.sectionHooks.push(hook);
    return this;
  }
}
