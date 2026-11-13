import type { ITerminalInitOnlyOptions, ITerminalOptions, Terminal } from '@xterm/xterm';
import { Registry } from 'shared';

type XTermInitHandler<P> = (options: ITerminalOptions & ITerminalInitOnlyOptions, props: P) => void;
type XTermHandler<P> = (term: Terminal, props: P) => void;

export class XTermRegistry<Props = {}> implements Registry {
  public mergeFrom(other: this): this {
    this.initHandlers.push(...other.initHandlers);
    this.beforePluginsHandlers.push(...other.beforePluginsHandlers);
    this.afterPluginsHandlers.push(...other.afterPluginsHandlers);
    this.afterOpenHandlers.push(...other.afterOpenHandlers);
    this.onUnmountHandlers.push(...other.onUnmountHandlers);

    return this;
  }

  /**
   * Mutate the options before the terminal is constructed.
   * @since 1.0.0
   */
  public initHandlers: XTermInitHandler<Props>[] = [];
  /**
   * Run right after construction, before any addon is loaded.
   * @since 1.0.0
   */
  public beforePluginsHandlers: XTermHandler<Props>[] = [];
  /**
   * Run after the stock addons are loaded, before the terminal is attached to the DOM.
   * @since 1.0.0
   */
  public afterPluginsHandlers: XTermHandler<Props>[] = [];
  /**
   * Run after the terminal is attached to the DOM and fitted.
   * @since 1.0.0
   */
  public afterOpenHandlers: XTermHandler<Props>[] = [];
  /**
   * Run right before the terminal is disposed.
   * @since 1.0.0
   */
  public onUnmountHandlers: XTermHandler<Props>[] = [];

  /** @since 1.0.0 */
  public addInitHandler(interceptor: XTermInitHandler<Props>): this {
    this.initHandlers.push(interceptor);
    return this;
  }

  /** @since 1.0.0 */
  public addBeforePluginsHandler(interceptor: XTermHandler<Props>): this {
    this.beforePluginsHandlers.push(interceptor);
    return this;
  }

  /** @since 1.0.0 */
  public addAfterPluginsHandler(interceptor: XTermHandler<Props>): this {
    this.afterPluginsHandlers.push(interceptor);
    return this;
  }

  /** @since 1.0.0 */
  public addAfterOpenHandler(interceptor: XTermHandler<Props>): this {
    this.afterOpenHandlers.push(interceptor);
    return this;
  }

  /** @since 1.0.0 */
  public addOnUnmountHandler(interceptor: XTermHandler<Props>): this {
    this.onUnmountHandlers.push(interceptor);
    return this;
  }
}
