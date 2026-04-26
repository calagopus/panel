import { Registry } from 'shared';
import type { ContextMenuItem } from '@/elements/ContextMenu.tsx';

type ComponentItemInterceptor<P> = React.FC<{ items: ContextMenuItem[] } & P>;
type ItemInterceptor<P> = (items: ContextMenuItem[], props: P) => void;

export class ContextMenuRegistry<Props = {}> implements Registry {
  public mergeFrom(other: this): this {
    this.componentItemInterceptors.push(...other.componentItemInterceptors);
    this.itemInterceptors.push(...other.itemInterceptors);

    return this;
  }

  public componentItemInterceptors: ComponentItemInterceptor<Props>[] = [];
  public itemInterceptors: ItemInterceptor<Props>[] = [];

  public addComponentItemInterceptor(interceptor: ComponentItemInterceptor<Props>): this {
    this.componentItemInterceptors.push(interceptor);
    return this;
  }

  public addItemInterceptor(interceptor: ItemInterceptor<Props>): this {
    this.itemInterceptors.push(interceptor);
    return this;
  }
}
