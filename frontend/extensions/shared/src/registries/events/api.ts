import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { CancellableEvent, EventHandler, EventHandlerList, EventHandlerOptions, Registry } from 'shared';

export const API_REQUEST_CANCELLED_CODE = 'ERR_EXTENSION_CANCELED';

export class ApiRequestEvent extends CancellableEvent<InternalAxiosRequestConfig> {}
export class ApiResponseEvent extends CancellableEvent<AxiosResponse> {}

export class ApiEventRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.requestHandlers.mergeFrom(other.requestHandlers);
    this.responseHandlers.mergeFrom(other.responseHandlers);

    return this;
  }

  /**
   * Mutate `data` to change the axios config, cancelling rejects with `API_REQUEST_CANCELLED_CODE`.
   * @since 1.2.6
   */
  public requestHandlers: EventHandlerList<ApiRequestEvent> = new EventHandlerList();
  /**
   * Run for successful responses only, cancelling turns the response into a rejection.
   * @since 1.2.6
   */
  public responseHandlers: EventHandlerList<ApiResponseEvent> = new EventHandlerList();

  /** @since 1.2.6 */
  public addRequestHandler(handler: EventHandler<ApiRequestEvent>, options?: EventHandlerOptions): this {
    this.requestHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeRequestHandler(handler: EventHandler<ApiRequestEvent>): this {
    this.requestHandlers.removeHandler(handler);
    return this;
  }

  /** @since 1.2.6 */
  public addResponseHandler(handler: EventHandler<ApiResponseEvent>, options?: EventHandlerOptions): this {
    this.responseHandlers.addHandler(handler, options);
    return this;
  }

  /** @since 1.2.6 */
  public removeResponseHandler(handler: EventHandler<ApiResponseEvent>): this {
    this.responseHandlers.removeHandler(handler);
    return this;
  }
}
