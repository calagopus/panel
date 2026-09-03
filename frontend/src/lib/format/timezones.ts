import { zones } from 'tzdata';

export function getTimezoneOptions(): { value: string; label: string }[] {
  return Object.keys(zones)
    .sort()
    .map((zone) => ({
      value: zone,
      label: zone,
    }));
}
