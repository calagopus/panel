import axios, { AxiosInstance } from 'axios';
import { transformKeysToCamelCase } from '../lib/transformers.ts';

export const axiosInstance: AxiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use((request) => {
  request.headers.set('Calagopus-User', localStorage.getItem('impersonated_user'));

  return request;
});

// Auto transform all data to camel case keys
axiosInstance.interceptors.response.use(
  (response) => {
    const contentType = response.headers['content-type'];
    if (typeof contentType === 'string' && contentType.includes('application/json') && response.data) {
      response.data = transformKeysToCamelCase(response.data);
    }

    return response;
  },
  (error) => {
    if (error.response && error.response.data) {
      const contentType = error.response.headers['content-type'];
      if (typeof contentType === 'string' && contentType.includes('application/json')) {
        error.response.data = transformKeysToCamelCase(error.response.data);
      }
    }

    return Promise.reject(error);
  },
);

export const untransformedAxiosInstance: AxiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

untransformedAxiosInstance.interceptors.request.use((request) => {
  request.headers.set('Calagopus-User', localStorage.getItem('impersonated_user'));

  return request;
});

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

export function getPaginationSet(data: Pagination<unknown>) {
  return {
    total: data.total,
    perPage: data.perPage,
    page: data.page,
  };
}

export function getEmptyPaginationSet<T>(): Pagination<T> {
  return {
    total: 0,
    perPage: 0,
    page: 0,
    data: [],
  };
}
