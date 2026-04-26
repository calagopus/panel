export const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z0-9])/gi, (_, letter) => letter.toUpperCase());
};

export const toSnakeCase = (str: string): string => {
  return str.replace(/([A-Z]|\d+)/g, '_$1').toLowerCase();
};

export const transformKeysToCamelCase = (obj: object): object => {
  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeysToCamelCase(item));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: Record<string, object> = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        const newKey = toCamelCase(key);
        newObj[newKey] = transformKeysToCamelCase((obj as Record<string, object>)[key] as Record<string, object>);
      }
    }
    return newObj;
  }
  return obj;
};

export const transformKeysToSnakeCase = (obj: object): object => {
  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeysToSnakeCase(item));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: Record<string, object> = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        const newKey = toSnakeCase(key);
        newObj[newKey] = transformKeysToSnakeCase((obj as Record<string, object>)[key] as Record<string, object>);
      }
    }
    return newObj;
  }
  return obj;
};

export const base64ToArrayBuffer = (base64String: string): ArrayBuffer => {
  let paddedBase64 = base64String;
  while (paddedBase64.length % 4 !== 0) {
    paddedBase64 += '=';
  }

  paddedBase64 = paddedBase64.replace(/-/g, '+').replace(/_/g, '/');

  try {
    const binaryString = window.atob(paddedBase64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  } catch (error) {
    console.error('Error decoding base64 string:', error);
    console.error('Problematic string:', base64String);
    throw new Error(
      'Failed to decode base64 string: ' +
        (error && typeof error === 'object' && 'message' in error && error?.message) || 'Unknown error',
    );
  }
};

export const nullableString = (v: unknown) => (v === '' ? null : v);

export const nullableNumber = (v: unknown) => (v === '' || v === null ? null : Number(v));
