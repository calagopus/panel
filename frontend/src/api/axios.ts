import { decode, encode } from '@msgpack/msgpack';
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponseHeaders,
  InternalAxiosRequestConfig,
  RawAxiosResponseHeaders,
} from 'axios';
import { API_REQUEST_CANCELLED_CODE, ApiRequestEvent, ApiResponseEvent, globalTranslationHandle } from 'shared';
import { safeSessionStorageGet, safeSessionStorageRemove, safeSessionStorageSet } from '@/lib/safeStorage.ts';
import { getTranslations } from '@/providers/contexts/translationContext.ts';
import { getGlobalStore } from '@/stores/global.ts';

function captureServerName(headers: RawAxiosResponseHeaders | AxiosResponseHeaders | undefined) {
  const serverName = headers?.['x-server-name'];
  if (typeof serverName === 'string') {
    getGlobalStore().setServerName(serverName);
  }
}

export const axiosInstance: AxiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Content-negotiated MessagePack transport for endpoints that move large result sets.
 * The backend can still answer with JSON (its msgpack serialization fallback, proxy error
 * pages), so the transform sniffs the content type before decoding.
 */
export const msgpackResponseConfig: AxiosRequestConfig = {
  responseType: 'arraybuffer',
  headers: {
    Accept: 'application/msgpack',
  },
  transformResponse: [
    (data: ArrayBuffer | null, headers) => {
      if (!data || data.byteLength === 0) return null;
      if (String(headers['content-type']).includes('application/msgpack')) return decode(data);

      const text = new TextDecoder().decode(data);
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
  ],
};

export const msgpackConfig: AxiosRequestConfig = {
  ...msgpackResponseConfig,
  headers: {
    ...msgpackResponseConfig.headers,
    'Content-Type': 'application/msgpack',
  },
  transformRequest: [(data) => encode(data)],
};

function cancelledByExtension(config: InternalAxiosRequestConfig) {
  const message = globalTranslationHandle
    ? getTranslations().t('common.toast.requestBlockedByExtension', {})
    : 'This request was blocked by an extension.';

  return new AxiosError(message, API_REQUEST_CANCELLED_CODE, config);
}

axiosInstance.interceptors.request.use((config) => {
  // settings are fetched before the extension context exists, they decide which extensions load
  const handlers = window.extensionContext?.extensionRegistry.events.api.requestHandlers;
  if (!handlers?.handlers.length) return config;

  const event = handlers.emit(new ApiRequestEvent(config));
  if (event.cancelled) throw cancelledByExtension(event.data);

  return event.data;
});

axiosInstance.interceptors.response.use(
  (response) => {
    captureServerName(response.headers);

    const handlers = window.extensionContext?.extensionRegistry.events.api.responseHandlers;
    if (!handlers?.handlers.length) return response;

    const event = handlers.emit(new ApiResponseEvent(response));
    if (event.cancelled) return Promise.reject(cancelledByExtension(response.config));

    return event.data;
  },
  async (error) => {
    if (error.response) {
      captureServerName(error.response.headers);

      // With `responseType: 'blob'` the error body is a Blob
      if (error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          error.response.data = text ? JSON.parse(text) : null;
        } catch {
          // not JSON, keep the blob
        }
      }
    }

    if (
      error.response?.status === 401 &&
      error.config?.url?.startsWith('/api/') &&
      !error.config?.url?.startsWith('/api/auth/')
    ) {
      window.dispatchEvent(new Event('session-expired'));
    }

    return Promise.reject(error);
  },
);

const IMPERSONATED_USER_KEY = 'impersonated_user';

export function getImpersonatedUser(): string | null {
  return safeSessionStorageGet(IMPERSONATED_USER_KEY);
}

/**
 * Sets (or clears) the impersonated user for this tab. The impersonation id lives in
 * per-tab sessionStorage and is applied as a default header on the axios instance, so
 * requests are always issued as the identity this tab's auth state actually reflects -
 * rather than reading origin-wide localStorage per request, which switched other tabs.
 */
export function setImpersonatedUser(uuid: string | null) {
  if (uuid) {
    safeSessionStorageSet(IMPERSONATED_USER_KEY, uuid);
    axiosInstance.defaults.headers.common['Calagopus-User'] = uuid;
  } else {
    safeSessionStorageRemove(IMPERSONATED_USER_KEY);
    delete axiosInstance.defaults.headers.common['Calagopus-User'];
  }
}

setImpersonatedUser(getImpersonatedUser());

/**
 * Converts an error into a human readable response. Mostly just a generic helper to
 * make sure we display the message from the server back to the user if we can.
 */
export function httpErrorToHuman(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data
  ) {
    let { data } = error.response;

    // Some non-JSON requests can still return the error as a JSON block. In those cases, attempt
    // to parse it into JSON so we can display an actual error.
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // do nothing, bad json
      }
    }

    if (typeof data === 'object') {
      if ('errors' in data && Array.isArray(data.errors) && data.errors[0] && typeof data.errors[0] === 'string') {
        return data.errors[0];
      }

      // Errors from wings directory, mostly just for file uploads.
      if ('error' in data && typeof data.error === 'string') {
        return data.error;
      }
    }
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  } else {
    return String(error);
  }
}

/**
 * Pulls the HTTP status code off an axios-style error, or `null` when the error carries no
 * response (network failure, non-axios throw). Saves callers from re-deriving the same
 * `'response' in error` narrowing by hand.
 */
export function getHttpStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'status' in error.response &&
    typeof error.response.status === 'number'
  ) {
    return error.response.status;
  }

  return null;
}

export function getEmptyPaginationSet<T>(): Pagination<T> {
  return {
    total: 0,
    perPage: 0,
    page: 0,
    data: [],
  };
}
