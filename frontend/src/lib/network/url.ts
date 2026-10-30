export const openUrl = (url: string, target = '_blank') => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = target;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

// a response that becomes a download never loads a document into the iframe, so a load means the
// server answered with an error page instead
export const downloadUrl = (url: string, onFailed?: () => void) => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  iframe.addEventListener('load', () => {
    if (iframe.contentDocument?.URL === 'about:blank') return;

    iframe.remove();
    onFailed?.();
  });
  document.body.appendChild(iframe);

  setTimeout(() => iframe.remove(), 60_000);
};

export const openPopup = (url: string) => {
  const popup = window.open(
    url,
    '_blank',
    'popup=yes,width=1280,height=800,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes',
  );
  popup?.focus();

  return popup;
};

const getExplicitUrlPort = (url: string) => {
  const authority = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/, 1)[0];
  const match = /:(\d+)$/.exec(authority.slice(authority.lastIndexOf('@') + 1));
  return match ? parseInt(match[1]) : null;
};

export const urlIsMissingPort = (url: string) => {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) && getExplicitUrlPort(url) === null;
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

export const getUrlPortOr = (url: string, fallback: number) => getExplicitUrlPort(url) ?? fallback;
