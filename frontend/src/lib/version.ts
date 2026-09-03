import { SemVer } from 'semver';

class CalagopusVersionInfo {
  public release: SemVer;
  public commit?: string;
  public branch?: string;

  constructor(version: string) {
    try {
      if (!version.includes('@')) {
        this.release = new SemVer(version);
      } else {
        const [p1, branch] = version.split('@');

        this.branch = branch;

        if (p1.includes(':')) {
          const [release, commit] = p1.split(':');

          this.release = new SemVer(release);
          this.commit = commit;
        } else {
          this.release = new SemVer(p1);
        }
      }
    } catch (err) {
      console.error('Error while parsing semver', err);
      this.release = new SemVer('0.0.0');
    }
  }

  public isStable() {
    return !this.commit && !this.branch;
  }

  public isNewerThan(version: string | CalagopusVersionInfo) {
    const parsedVersion = parseVersion(version);

    return this.release.compare(parsedVersion.release) === 1;
  }
}

export const parseVersion = (version: string | CalagopusVersionInfo) => {
  return version instanceof CalagopusVersionInfo ? version : new CalagopusVersionInfo(version);
};

export const isOutdated = (
  latest: string | CalagopusVersionInfo | null | undefined,
  current: string | CalagopusVersionInfo | null | undefined,
): boolean => {
  if (!latest || !current) return false;

  return parseVersion(latest).isNewerThan(current);
};
