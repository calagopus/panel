import { Registry } from 'shared';
import type { ItemProp } from '@/elements/SubNavigation.tsx';

type ItemInterceptor<P> = (items: ItemProp[], props: P) => void;

export class SubNavigationRegistry<Props = {}> implements Registry {
  public mergeFrom(other: this): this {
    this.itemInterceptors.push(...other.itemInterceptors);

    return this;
  }

  public itemInterceptors: ItemInterceptor<Props>[] = [];

  public addItemInterceptor(interceptor: ItemInterceptor<Props>): this {
    this.itemInterceptors.push(interceptor);
    return this;
  }
}
