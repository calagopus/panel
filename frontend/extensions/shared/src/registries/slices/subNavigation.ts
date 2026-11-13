import { Registry } from 'shared';
import type { ItemProp } from '@/elements/navigation/SubNavigation.tsx';

type ItemInterceptor<P> = (items: ItemProp[], props: P) => void;

export class SubNavigationRegistry<Props = {}> implements Registry {
  public mergeFrom(other: this): this {
    this.itemInterceptors.push(...other.itemInterceptors);

    return this;
  }

  /**
   * Mutate the items in place before they are filtered and rendered.
   * @since 1.0.3
   */
  public itemInterceptors: ItemInterceptor<Props>[] = [];

  /** @since 1.0.3 */
  public addItemInterceptor(interceptor: ItemInterceptor<Props>): this {
    this.itemInterceptors.push(interceptor);
    return this;
  }
}
