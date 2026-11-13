import { Registry } from 'shared';
import type { ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';

type ComponentItemInterceptor<P> = React.FC<{ items: ContextMenuItem[] } & P>;
type ItemInterceptor<P> = (items: ContextMenuItem[], props: P) => void;

export class ContextMenuRegistry<Props = {}> implements Registry {
  public mergeFrom(other: this): this {
    this.componentItemInterceptors.push(...other.componentItemInterceptors);
    this.itemInterceptors.push(...other.itemInterceptors);

    return this;
  }

  /**
   * Rendered next to the menu with the final items, for items needing hooks or state like a modal.
   * @since 1.0.3
   */
  public componentItemInterceptors: ComponentItemInterceptor<Props>[] = [];
  /**
   * Mutate the items in place before the menu is built.
   * @since 1.0.0
   */
  public itemInterceptors: ItemInterceptor<Props>[] = [];

  /** @since 1.0.3 */
  public addComponentItemInterceptor(interceptor: ComponentItemInterceptor<Props>): this {
    this.componentItemInterceptors.push(interceptor);
    return this;
  }

  /** @since 1.0.0 */
  public addItemInterceptor(interceptor: ItemInterceptor<Props>): this {
    this.itemInterceptors.push(interceptor);
    return this;
  }
}
