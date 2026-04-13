import React, { createElement } from 'react';

export function createBeforeCallHook<Fn extends (...args: Parameters<Fn>) => ReturnType<Fn>>(
  fn: Fn,
  hook: (original: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>,
): Fn {
  return ((...args: Parameters<Fn>) => {
    return hook(fn, ...args);
  }) as Fn;
}

export function createAfterCallHook<Fn extends (...args: Parameters<Fn>) => ReturnType<Fn>>(
  fn: Fn,
  hook: (original: Fn, result: ReturnType<Fn>, ...args: Parameters<Fn>) => ReturnType<Fn>,
): Fn {
  return ((...args: Parameters<Fn>) => {
    const result = fn(...args);
    return hook(fn, result, ...args);
  }) as Fn;
}

export type HookableFunction<Fn extends (...args: unknown[]) => unknown> = {
  addBeforeHook(hook: (original: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>): void;
  addAfterHook(hook: (original: Fn, result: ReturnType<Fn>, ...args: Parameters<Fn>) => ReturnType<Fn>): void;
} & Fn;

export function makeFunctionHookable<Fn extends (...args: unknown[]) => unknown>(fn: Fn): HookableFunction<Fn> {
  const beforeHooks: Array<(original: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>> = [];
  const afterHooks: Array<(original: Fn, result: ReturnType<Fn>, ...args: Parameters<Fn>) => ReturnType<Fn>> = [];

  const hookableFunction = ((...args: Parameters<Fn>): ReturnType<Fn> => {
    let result: ReturnType<Fn>;

    for (const beforeHook of beforeHooks) {
      result = beforeHook(fn, ...args);
    }
    result = fn(...args) as ReturnType<Fn>;
    for (const afterHook of afterHooks) {
      result = afterHook(fn, result, ...args);
    }

    return result;
  }) as HookableFunction<Fn>;

  hookableFunction.addBeforeHook = (hook: (original: Fn, ...args: Parameters<Fn>) => ReturnType<Fn>) => {
    beforeHooks.push(hook);
  };

  hookableFunction.addAfterHook = (
    hook: (original: Fn, result: ReturnType<Fn>, ...args: Parameters<Fn>) => ReturnType<Fn>,
  ) => {
    afterHooks.push(hook);
  };

  return hookableFunction;
}

export type HookableComponentBase<P> = {
  addPropsInterceptor(interceptor: (props: P) => P): void;
  addRenderInterceptor(interceptor: (element: React.ReactElement<P>, props: P) => React.ReactElement<P>): void;
  replaceBaseComponent(newComponent: React.ComponentType<P>): void;
};

export type HookableComponent<P extends object> = React.FC<P> & HookableComponentBase<P>;

export function makeComponentHookable<
  P extends object,
  // biome-ignore lint/suspicious/noExplicitAny: We want to allow any additional components without forcing the caller to specify them
  AdditionalComponents extends Record<string, React.FC<any>> = {},
>(
  Component: React.ComponentType<P>,
  additionalComponents?: AdditionalComponents,
): HookableComponent<P> & AdditionalComponents {
  let BaseComponent = Component;

  const propsInterceptors: Array<(props: P) => P> = [];
  const renderInterceptors: Array<(element: React.ReactElement<P>, props: P) => React.ReactElement<P>> = [];

  const HookableWrapper = (props: P) => {
    let modifiedProps = props;
    for (const interceptor of propsInterceptors) {
      modifiedProps = interceptor(modifiedProps);
    }

    let element = createElement(BaseComponent, modifiedProps);

    for (const interceptor of renderInterceptors) {
      element = interceptor(element, modifiedProps);
    }

    return element;
  };

  HookableWrapper.addPropsInterceptor = (interceptor: (props: P) => P) => {
    propsInterceptors.push(interceptor);
  };

  HookableWrapper.addRenderInterceptor = (
    interceptor: (element: React.ReactElement<P>, props: P) => React.ReactElement<P>,
  ) => {
    renderInterceptors.push(interceptor);
  };

  HookableWrapper.replaceBaseComponent = (newComponent: React.ComponentType<P>) => {
    BaseComponent = newComponent;
  };

  if (additionalComponents) {
    for (const key in additionalComponents) {
      (HookableWrapper as unknown as Record<string, React.FC<never>>)[key] = additionalComponents[key];
    }
  }

  return HookableWrapper as HookableComponent<P> & AdditionalComponents;
}
