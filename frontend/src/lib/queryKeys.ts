const admin = {
  users: {
    all: () => ['admin', 'users'] as const,
    detail: (uuid: string) => ['admin', 'users', { uuid }] as const,
    servers: (userUuid: string) => ['admin', 'users', userUuid, 'servers'] as const,
    activity: (userUuid: string) => ['admin', 'users', userUuid, 'activity'] as const,
    oauthLinks: (userUuid: string) => ['admin', 'users', userUuid, 'oauth-links'] as const,
  },

  roles: {
    all: () => ['admin', 'roles'] as const,
    detail: (uuid: string) => ['admin', 'roles', { uuid }] as const,
    users: (roleUuid: string) => ['admin', 'roles', roleUuid, 'users'] as const,
  },

  nodes: {
    all: () => ['admin', 'nodes'] as const,
    detail: (uuid: string) => ['admin', 'nodes', { uuid }] as const,
    allocations: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'allocations'] as const,
    backups: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'backups'] as const,
    mounts: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'mounts'] as const,
    servers: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'servers'] as const,
    transfers: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'transfers'] as const,
  },

  servers: {
    all: () => ['admin', 'servers'] as const,
    detail: (uuid: string) => ['admin', 'servers', { uuid }] as const,
    activity: (serverUuid: string) => ['admin', 'servers', serverUuid, 'activity'] as const,
    allocations: (serverUuid: string) => ['admin', 'servers', serverUuid, 'allocations'] as const,
    backups: (serverUuid: string) => ['admin', 'servers', serverUuid, 'backups'] as const,
    mounts: (serverUuid: string) => ['admin', 'servers', serverUuid, 'mounts'] as const,
  },

  nests: {
    all: () => ['admin', 'nests'] as const,
    detail: (uuid: string) => ['admin', 'nests', { uuid }] as const,
    eggs: (nestUuid: string) => ['admin', 'nests', nestUuid, 'eggs'] as const,
  },

  eggs: {
    all: () => ['admin', 'eggs'] as const,
    detail: (uuid: string) => ['admin', 'eggs', { uuid }] as const,
    mounts: (eggUuid: string) => ['admin', 'eggs', eggUuid, 'mounts'] as const,
    servers: (eggUuid: string) => ['admin', 'eggs', eggUuid, 'servers'] as const,
  },

  locations: {
    all: () => ['admin', 'locations'] as const,
    detail: (uuid: string) => ['admin', 'locations', { uuid }] as const,
    databaseHosts: (locationUuid: string) => ['admin', 'locations', locationUuid, 'database-hosts'] as const,
    nodes: (locationUuid: string) => ['admin', 'locations', locationUuid, 'nodes'] as const,
  },

  mounts: {
    all: () => ['admin', 'mounts'] as const,
    detail: (uuid: string) => ['admin', 'mounts', { uuid }] as const,
    eggs: (mountUuid: string) => ['admin', 'mounts', mountUuid, 'eggs'] as const,
    nodes: (mountUuid: string) => ['admin', 'mounts', mountUuid, 'nodes'] as const,
    servers: (mountUuid: string) => ['admin', 'mounts', mountUuid, 'servers'] as const,
  },

  databaseHosts: {
    all: () => ['admin', 'database-hosts'] as const,
    detail: (uuid: string) => ['admin', 'database-hosts', { uuid }] as const,
    databases: (hostUuid: string) => ['admin', 'database-hosts', hostUuid, 'databases'] as const,
  },

  backupConfigurations: {
    all: () => ['admin', 'backup-configurations'] as const,
    detail: (uuid: string) => ['admin', 'backup-configurations', { uuid }] as const,
    backups: (uuid: string) => ['admin', 'backup-configurations', uuid, 'backups'] as const,
    locations: (uuid: string) => ['admin', 'backup-configurations', uuid, 'locations'] as const,
    nodes: (uuid: string) => ['admin', 'backup-configurations', uuid, 'nodes'] as const,
    servers: (uuid: string) => ['admin', 'backup-configurations', uuid, 'servers'] as const,
    stats: (uuid: string) => ['admin', 'backup-configurations', uuid, 'stats'] as const,
  },

  oAuthProviders: {
    all: () => ['admin', 'oauth-providers'] as const,
    detail: (uuid: string) => ['admin', 'oauth-providers', { uuid }] as const,
    users: (providerUuid: string) => ['admin', 'oauth-providers', providerUuid, 'users'] as const,
  },

  eggRepositories: {
    all: () => ['admin', 'egg-repositories'] as const,
    detail: (uuid: string) => ['admin', 'egg-repositories', { uuid }] as const,
    eggs: (repoUuid: string) => ['admin', 'egg-repositories', repoUuid, 'eggs'] as const,
  },

  eggConfigurations: {
    all: () => ['admin', 'egg-configurations'] as const,
    detail: (uuid: string) => ['admin', 'egg-configurations', { uuid }] as const,
  },

  activity: {
    all: () => ['admin', 'activity'] as const,
  },

  assets: {
    all: () => ['admin', 'assets'] as const,
  },

  updates: {
    nodes: () => ['admin', 'updates', 'nodes'] as const,
  },

  health: {
    nodes: () => ['admin', 'health', 'nodes'] as const,
  },
};

const server = (serverUuid: string) => ({
  activity: {
    all: () => ['server', serverUuid, 'activity'] as const,
  },
  allocations: {
    all: () => ['server', serverUuid, 'allocations'] as const,
  },
  backups: {
    all: () => ['server', serverUuid, 'backups'] as const,
    detail: (backupUuid: string) => ['server', serverUuid, 'backups', { uuid: backupUuid }] as const,
  },
  databases: {
    all: () => ['server', serverUuid, 'databases'] as const,
  },
  files: {
    all: () => ['server', serverUuid, 'files'] as const,
    directory: (path: string) => ['server', serverUuid, 'files', 'directory', path] as const,
  },
  mounts: {
    all: () => ['server', serverUuid, 'mounts'] as const,
  },
  network: {
    all: () => ['server', serverUuid, 'network'] as const,
  },
  schedules: {
    all: () => ['server', serverUuid, 'schedules'] as const,
    detail: (scheduleUuid: string) => ['server', serverUuid, 'schedules', { uuid: scheduleUuid }] as const,
  },
  subusers: {
    all: () => ['server', serverUuid, 'subusers'] as const,
  },
});

const user = {
  activity: {
    all: () => ['user', 'activity'] as const,
  },
  apiKeys: {
    all: () => ['user', 'api-keys'] as const,
  },
  commandSnippets: {
    all: () => ['user', 'command-snippets'] as const,
  },
  oauthLinks: {
    all: () => ['user', 'oauth-links'] as const,
  },
  securityKeys: {
    all: () => ['user', 'security-keys'] as const,
  },
  servers: {
    all: () => ['user', 'servers'] as const,
  },
  sessions: {
    all: () => ['user', 'sessions'] as const,
  },
  sshKeys: {
    all: () => ['user', 'ssh-keys'] as const,
  },
};

export const queryKeys = { admin, server, user };
