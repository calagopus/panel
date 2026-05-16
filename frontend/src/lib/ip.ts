const hexChars = '0123456789ABCDEFabcdef';

export function isFullyHex(hex: string): boolean {
  for (const char of hex) {
    if (!hexChars.includes(char)) return false;
  }

  return true;
}

const MAX_IPV4_LONG = 4294967295;
const MAX_IPV6_LONG = BigInt('340282366920938463463374607431768211455');

function checkV4(ip: string): boolean {
  const segments = ip.split('.');
  if (segments.length > 4) return false;

  if (segments.length > 1) {
    for (const segment of segments) {
      const int = parseInt(segment);
      if (Number.isNaN(int)) return false;
      if (int < 0 || int > 0xff) return false;
    }
  } else {
    const int = parseInt(ip, isFullyHex(ip) ? 16 : 10);

    if (Number.isNaN(int)) return false;
    if (int < 0 || int > MAX_IPV4_LONG) return false;
  }

  return true;
}

export function isIP(ip: string, type: 'v4' | 'v6' | 'v6 | v4' = 'v6 | v4'): 'v4' | 'v6' | false {
  if (type !== 'v6' && !ip.includes(':')) {
    const res = checkV4(ip);
    if (res) return 'v4';
  }

  if (type !== 'v4') {
    const segments = ip.split(':');
    if (segments.length > 8 || segments.length === 2) return false;

    if (segments.length > 1) {
      if (segments[0] === '') segments.splice(0, 1);

      let doubleSegments = 0;
      for (const segment of segments) {
        if (doubleSegments > 1) return false;
        if (segment === '') {
          doubleSegments++;
          continue;
        }

        const int = parseInt(segment, 16);
        if (Number.isNaN(int)) return false;
        if (int < 0 || int > 0xffff) return false;
      }

      if (doubleSegments === 0 && segments.length !== 8) return false;
    } else {
      try {
        try {
          const int = BigInt(ip);
          if (int < 0 || int > MAX_IPV6_LONG) return false;
        } catch {
          const int = BigInt('0x'.concat(ip));
          if (int < 0 || int > MAX_IPV6_LONG) return false;
        }
      } catch {
        return false;
      }
    }

    return 'v6';
  }

  return false;
}

interface ResolvedPorts {
  resolved: number[];
  toRemove: string[];
}

export function isValidPort(port: string): boolean {
  const int = Number(port);
  return Number.isFinite(int) && Number.isInteger(int) && int >= 0 && int <= 65535;
}

export function resolvePorts(ports: string[]): ResolvedPorts {
  const resolved: number[] = [];
  const toRemove: string[] = [];

  for (const range of ports) {
    if (isValidPort(range)) {
      resolved.push(Number(range));
    } else if (range.includes('-')) {
      const [start, end] = range.split('-');

      if (isValidPort(start) && isValidPort(end)) {
        for (let i = Number(start); i <= Number(end); i++) {
          resolved.push(i);
        }
      }
    } else {
      toRemove.push(range);
    }
  }

  return { resolved, toRemove };
}
