import { z } from 'zod';

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
  return Number.isFinite(int) && Number.isInteger(int) && int >= 1 && int <= 65535;
}

export function resolvePorts(ports: string[]): ResolvedPorts {
  const resolved = new Set<number>();
  const toRemove: string[] = [];

  for (const range of ports) {
    if (isValidPort(range)) {
      resolved.add(Number(range));
    } else if (range.includes('-')) {
      const [start, end] = range.split('-');

      if (isValidPort(start) && isValidPort(end)) {
        for (let i = Number(start); i <= Number(end); i++) {
          resolved.add(i);
        }
      }
    } else {
      toRemove.push(range);
    }
  }

  return { resolved: Array.from(resolved), toRemove };
}

function ipv6Bytes(address: string): number[] {
  const [head, tail] = address.split('::');

  const expand = (groups: string[]): number[] => {
    const bytes: number[] = [];

    for (const group of groups) {
      if (group.includes('.')) {
        bytes.push(...group.split('.').map(Number));
      } else {
        const int = parseInt(group, 16);
        bytes.push(int >> 8, int & 0xff);
      }
    }

    return bytes;
  };

  const headBytes = expand(head ? head.split(':') : []);
  const tailBytes = expand(tail ? tail.split(':') : []);

  return [...headBytes, ...new Array(16 - headBytes.length - tailBytes.length).fill(0), ...tailBytes];
}

function hasZeroedHostBits(bytes: number[], length: number): boolean {
  for (let i = 0; i < bytes.length; i++) {
    const networkBits = i * 8;

    if (networkBits >= length) {
      if (bytes[i] !== 0) return false;
    } else if (networkBits + 8 > length) {
      if ((bytes[i] & (0xff >> (length - networkBits))) !== 0) return false;
    }
  }

  return true;
}

export function isNetwork(value: string): boolean {
  const [address, prefix, ...rest] = value.split('/');
  if (rest.length > 0) return false;

  const family = z.ipv4().safeParse(address).success ? 'v4' : z.ipv6().safeParse(address).success ? 'v6' : null;
  if (!family) return false;
  if (prefix === undefined) return true;

  if (!/^\d+$/.test(prefix)) return false;

  const length = Number(prefix);
  if (length > (family === 'v4' ? 32 : 128)) return false;

  return hasZeroedHostBits(family === 'v4' ? address.split('.').map(Number) : ipv6Bytes(address), length);
}
