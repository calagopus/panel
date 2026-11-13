import type { FC } from 'react';
import { Registry } from 'shared';

type PropsInterceptor<P> = (props: P) => P;

export class ContainerRegistry<Props = {}, AdditionalFC = {}> implements Registry {
  public mergeFrom(other: this): this {
    this.propsInterceptors.push(...other.propsInterceptors);
    this.prependedComponents.push(...other.prependedComponents);
    this.prependedContentComponents.push(...other.prependedContentComponents);
    this.appendedContentComponents.push(...other.appendedContentComponents);

    return this;
  }

  /**
   * The returned props replace the original ones and are passed to every component.
   * @since 1.0.3
   */
  public propsInterceptors: PropsInterceptor<Props>[] = [];
  /**
   * Rendered above the title area.
   * @since 1.0.0
   */
  public prependedComponents: FC<Props & AdditionalFC>[] = [];
  /**
   * Rendered between the title area and the content.
   * @since 1.0.0
   */
  public prependedContentComponents: FC<Props & AdditionalFC>[] = [];
  /**
   * Rendered after the content.
   * @since 1.0.0
   */
  public appendedContentComponents: FC<Props & AdditionalFC>[] = [];

  /**
   * Adds a props interceptor that can modify the props before they are passed to the container component
   * @since 1.0.3
   */
  public addPropsInterceptor(interceptor: PropsInterceptor<Props>): this {
    this.propsInterceptors.push(interceptor);

    return this;
  }

  /**
   * Adds a component to be rendered before everything else
   * @since 1.0.0
   */
  public prependComponent(component: FC<Props & AdditionalFC>): this {
    this.prependedComponents.push(component);

    return this;
  }

  /**
   * Adds a component to be rendered before the main content but after the title/search area
   * @since 1.0.0
   */
  public prependContentComponent(component: FC<Props & AdditionalFC>): this {
    this.prependedContentComponents.push(component);

    return this;
  }

  /**
   * Adds a component to be rendered after the main content
   * @since 1.0.0
   */
  public appendContentComponent(component: FC<Props & AdditionalFC>): this {
    this.appendedContentComponents.push(component);

    return this;
  }
}
