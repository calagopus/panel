import type { FC } from 'react';
import { Registry } from 'shared';

type PropsInterceptor<P> = (props: P) => P;

export class ContainerRegistry<Props = {}> implements Registry {
  public mergeFrom(other: this): this {
    this.prependedComponents.push(...other.prependedComponents);
    this.prependedContentComponents.push(...other.prependedContentComponents);
    this.appendedContentComponents.push(...other.appendedContentComponents);

    return this;
  }

  public propsInterceptors: PropsInterceptor<Props>[] = [];
  public prependedComponents: FC<Props>[] = [];
  public prependedContentComponents: FC<Props>[] = [];
  public appendedContentComponents: FC<Props>[] = [];

  // Adds a props interceptor that can modify the props before they are passed to the container component
  public addPropsInterceptor(interceptor: PropsInterceptor<Props>): this {
    this.propsInterceptors.push(interceptor);

    return this;
  }

  // Adds a component to be rendered before everything else
  public prependComponent(component: FC<Props>): this {
    this.prependedComponents.push(component);

    return this;
  }

  // Adds a component to be rendered before the main content but after the title/search area
  public prependContentComponent(component: FC<Props>): this {
    this.prependedContentComponents.push(component);

    return this;
  }

  // Adds a component to be rendered after the main content
  public appendContentComponent(component: FC<Props>): this {
    this.appendedContentComponents.push(component);

    return this;
  }
}
