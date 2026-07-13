import axios, { AxiosInstance, AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';
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

// Auto transform all data to camel case keys
axiosInstance.interceptors.response.use(
  (response) => {
    captureServerName(response.headers);

    return response;
  },
  (error) => {
    if (error.response) {
      captureServerName(error.response.headers);
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
  return sessionStorage.getItem(IMPERSONATED_USER_KEY);
}

/**
 * Sets (or clears) the impersonated user for this tab. The impersonation id lives in
 * per-tab sessionStorage and is applied as a default header on both axios instances, so
 * requests are always issued as the identity this tab's auth state actually reflects —
 * rather than reading origin-wide localStorage per request, which switched other tabs.
 */
export function setImpersonatedUser(uuid: string | null) {
  if (uuid) {
    sessionStorage.setItem(IMPERSONATED_USER_KEY, uuid);
    axiosInstance.defaults.headers.common['Calagopus-User'] = uuid;
  } else {
    sessionStorage.removeItem(IMPERSONATED_USER_KEY);
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

export function getEmptyPaginationSet<T>(): Pagination<T> {
  return {
    total: 0,
    perPage: 0,
    page: 0,
    data: [],
  };
}
