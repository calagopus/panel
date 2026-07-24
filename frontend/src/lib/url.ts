export const urlIsMissingPort = (url: string) => {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) && !parsed.port;
  } catch {
    return false;
  }
};

export const withUrlPort = (url: string, port: number) => {
  try {
    const parsed = new URL(url);
    parsed.port = String(port);
    return `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

export const getUrlConnectPort = (url: string) => {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    if (parsed.port) return parseInt(parsed.port);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
};

export const getUrlPortOr = (url: string, fallback: number) => {
  try {
    return parseInt(new URL(url).port) || fallback;
  } catch {
    return fallback;
  }
};
