type QueryKeyPart = string | number | boolean | null | undefined | Record<string, unknown>;

export type QueryKey = readonly QueryKeyPart[];

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
    token: (uuid: string) => ['admin', 'nodes', uuid, 'token'] as const,
    capacity: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'capacity'] as const,
    systemOverview: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'system', 'overview'] as const,
    allocations: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'allocations'] as const,
    availableAllocations: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'allocations', 'available'] as const,
    allocationIps: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'allocations', 'ips'] as const,
    databaseHosts: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'database-hosts'] as const,
    databaseAgentHosts: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'database-agent-hosts'] as const,
    servers: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'servers'] as const,
    transfers: (nodeUuid: string) => ['admin', 'nodes', nodeUuid, 'transfers'] as const,
  },

  servers: {
    all: () => ['admin', 'servers'] as const,
    detail: (uuid: string) => ['admin', 'servers', { uuid }] as const,
    activity: (serverUuid: string) => ['admin', 'servers', serverUuid, 'activity'] as const,
    allocations: (serverUuid: string) => ['admin', 'servers', serverUuid, 'allocations'] as const,
    databases: (serverUuid: string) => ['admin', 'servers', serverUuid, 'databases'] as const,
  },

  extensions: {
    all: () => ['admin', 'extensions'] as const,
    status: () => ['admin', 'extensions', 'status'] as const,
  },

  nests: {
    all: () => ['admin', 'nests'] as const,
    detail: (uuid: string) => ['admin', 'nests', { uuid }] as const,
    eggs: (nestUuid: string) => ['admin', 'nests', nestUuid, 'eggs'] as const,
  },

  eggs: {
    all: () => ['admin', 'eggs'] as const,
    detail: (uuid: string) => ['admin', 'eggs', { uuid }] as const,
    servers: (eggUuid: string) => ['admin', 'eggs', eggUuid, 'servers'] as const,
  },

  locations: {
    all: () => ['admin', 'locations'] as const,
    detail: (uuid: string) => ['admin', 'locations', { uuid }] as const,
    databaseHosts: (locationUuid: string) => ['admin', 'locations', locationUuid, 'database-hosts'] as const,
    databaseAgentHosts: (locationUuid: string) => ['admin', 'locations', locationUuid, 'database-agent-hosts'] as const,
    nodes: (locationUuid: string) => ['admin', 'locations', locationUuid, 'nodes'] as const,
  },

  mounts: {
    all: () => ['admin', 'mounts'] as const,
    detail: (uuid: string) => ['admin', 'mounts', { uuid }] as const,
  },

  mountAssignments: {
    all: () => ['admin', 'mount-assignments'] as const,
    mountsByNode: (nodeUuid: string) => ['admin', 'mount-assignments', 'node', nodeUuid] as const,
    mountsByEgg: (eggUuid: string) => ['admin', 'mount-assignments', 'egg', eggUuid] as const,
    mountsByServer: (serverUuid: string) => ['admin', 'mount-assignments', 'server', serverUuid] as const,
    availableMountsByServer: (serverUuid: string) =>
      ['admin', 'mount-assignments', 'server', serverUuid, 'available'] as const,
    nodesByMount: (mountUuid: string) => ['admin', 'mount-assignments', 'mount', mountUuid, 'nodes'] as const,
    eggsByMount: (mountUuid: string) => ['admin', 'mount-assignments', 'mount', mountUuid, 'eggs'] as const,
    serversByMount: (mountUuid: string) => ['admin', 'mount-assignments', 'mount', mountUuid, 'servers'] as const,
  },

  databaseHosts: {
    all: () => ['admin', 'database-hosts'] as const,
    detail: (uuid: string) => ['admin', 'database-hosts', { uuid }] as const,
    databases: (hostUuid: string) => ['admin', 'database-hosts', hostUuid, 'databases'] as const,
  },

  databaseAgentHosts: {
    all: () => ['admin', 'database-agent-hosts'] as const,
    detail: (uuid: string) => ['admin', 'database-agent-hosts', { uuid }] as const,
    token: (uuid: string) => ['admin', 'database-agent-hosts', uuid, 'token'] as const,
    capacity: (uuid: string) => ['admin', 'database-agent-hosts', uuid, 'capacity'] as const,
    systemOverview: (uuid: string) => ['admin', 'database-agent-hosts', uuid, 'system', 'overview'] as const,
  },

  databaseAgentTemplates: {
    all: () => ['admin', 'database-agent-templates'] as const,
    detail: (uuid: string) => ['admin', 'database-agent-templates', { uuid }] as const,
  },

  databaseInstances: {
    all: () => ['admin', 'database-instances'] as const,
    byHost: (hostUuid: string) => ['admin', 'database-instances', 'host', hostUuid] as const,
    byTemplate: (templateUuid: string) => ['admin', 'database-instances', 'template', templateUuid] as const,
    byServer: (serverUuid: string) => ['admin', 'database-instances', 'server', serverUuid] as const,
  },

  backups: {
    all: () => ['admin', 'backups'] as const,
    byNode: (nodeUuid: string) => ['admin', 'backups', 'node', nodeUuid] as const,
    byServer: (serverUuid: string) => ['admin', 'backups', 'server', serverUuid] as const,
    byBackupConfiguration: (uuid: string) => ['admin', 'backups', 'backup-configuration', uuid] as const,
    bySystemBackupPolicy: (uuid: string) => ['admin', 'backups', 'system-backup-policy', uuid] as const,
  },

  backupConfigurations: {
    all: () => ['admin', 'backup-configurations'] as const,
    detail: (uuid: string) => ['admin', 'backup-configurations', { uuid }] as const,
    locations: (uuid: string) => ['admin', 'backup-configurations', uuid, 'locations'] as const,
    nodes: (uuid: string) => ['admin', 'backup-configurations', uuid, 'nodes'] as const,
    servers: (uuid: string) => ['admin', 'backup-configurations', uuid, 'servers'] as const,
    stats: (uuid: string) => ['admin', 'backup-configurations', uuid, 'stats'] as const,
  },

  systemBackupPolicies: {
    all: () => ['admin', 'system-backup-policies'] as const,
    detail: (uuid: string) => ['admin', 'system-backup-policies', { uuid }] as const,
    nodes: (uuid: string) => ['admin', 'system-backup-policies', uuid, 'nodes'] as const,
    locations: (uuid: string) => ['admin', 'system-backup-policies', uuid, 'locations'] as const,
    servers: (uuid: string) => ['admin', 'system-backup-policies', uuid, 'servers'] as const,
  },

  oAuthProviders: {
    all: () => ['admin', 'oauth-providers'] as const,
    detail: (uuid: string) => ['admin', 'oauth-providers', { uuid }] as const,
    users: (providerUuid: string) => ['admin', 'oauth-providers', providerUuid, 'users'] as const,
    mappings: (providerUuid: string) => ['admin', 'oauth-providers', providerUuid, 'mappings'] as const,
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

  announcements: {
    all: () => ['admin', 'announcements'] as const,
    detail: (uuid: string) => ['admin', 'announcements', { uuid }] as const,
  },

  activity: {
    all: (userUuid: string | null) => ['admin', 'activity', { uuid: userUuid }] as const,
  },

  assets: {
    all: () => ['admin', 'assets'] as const,
  },

  updates: {
    nodes: () => ['admin', 'updates', 'nodes'] as const,
    databaseAgentHosts: () => ['admin', 'updates', 'database-agent-hosts'] as const,
  },

  health: {
    nodes: () => ['admin', 'health', 'nodes'] as const,
  },

  emailTemplates: {
    all: () => ['admin', 'emailTemplates'] as const,
    detail: (identifier: string) => ['admin', 'emailTemplates', { identifier }] as const,
  },
};

const server = (serverUuid: string) => ({
  detail: () => ['server', serverUuid, 'detail'] as const,
  gamedig: () => ['server', serverUuid, 'gamedig'] as const,
  activity: {
    all: (userUuid: string | null) => ['server', serverUuid, 'activity', { uuid: userUuid }] as const,
    byEvent: (userUuid: string | null, event: string) =>
      ['server', serverUuid, 'activity', { uuid: userUuid }, { event }] as const,
  },
  announcements: {
    all: () => ['server', serverUuid, 'announcements'] as const,
  },
  backups: {
    all: () => ['server', serverUuid, 'backups'] as const,
    detail: (backupUuid: string) => ['server', serverUuid, 'backups', { uuid: backupUuid }] as const,
    groups: {
      all: () => ['server', serverUuid, 'backups', 'groups'] as const,
      detail: (groupUuid: string) => ['server', serverUuid, 'backups', 'groups', { uuid: groupUuid }] as const,
    },
    system: () => ['server', serverUuid, 'backups', 'system'] as const,
  },
  databases: {
    all: () => ['server', serverUuid, 'databases'] as const,
    hosts: () => ['server', serverUuid, 'databases', 'hosts'] as const,
    detail: (databaseUuid: string) => ['server', serverUuid, 'databases', { uuid: databaseUuid }] as const,
    size: (databaseUuid: string) => ['server', serverUuid, 'databases', databaseUuid, 'size'] as const,
    schema: (databaseUuid: string) => ['server', serverUuid, 'databases', databaseUuid, 'schema'] as const,
    rows: (databaseUuid: string) => ['server', serverUuid, 'databases', databaseUuid, 'rows'] as const,
    columnTypes: (databaseUuid: string) => ['server', serverUuid, 'databases', databaseUuid, 'column-types'] as const,
    instances: {
      all: () => ['server', serverUuid, 'databases', 'instances'] as const,
      templates: () => ['server', serverUuid, 'databases', 'instances', 'templates'] as const,
      detail: (instanceUuid: string) =>
        ['server', serverUuid, 'databases', 'instances', { uuid: instanceUuid }] as const,
      databases: (instanceUuid: string) =>
        ['server', serverUuid, 'databases', 'instances', instanceUuid, 'databases'] as const,
      databaseSize: (instanceUuid: string, databaseUuid: string) =>
        ['server', serverUuid, 'databases', 'instances', instanceUuid, 'databases', databaseUuid, 'size'] as const,
      databaseSchema: (instanceUuid: string, databaseUuid: string) =>
        ['server', serverUuid, 'databases', 'instances', instanceUuid, 'databases', databaseUuid, 'schema'] as const,
      databaseRows: (instanceUuid: string, databaseUuid: string) =>
        ['server', serverUuid, 'databases', 'instances', instanceUuid, 'databases', databaseUuid, 'rows'] as const,
      databaseColumnTypes: (instanceUuid: string, databaseUuid: string) =>
        [
          'server',
          serverUuid,
          'databases',
          'instances',
          instanceUuid,
          'databases',
          databaseUuid,
          'column-types',
        ] as const,
      users: (instanceUuid: string) => ['server', serverUuid, 'databases', 'instances', instanceUuid, 'users'] as const,
    },
  },
  files: {
    all: () => ['server', serverUuid, 'files'] as const,
    directory: (browsingDirectory: string, sortMode: string) =>
      ['server', serverUuid, 'files', { browsingDirectory, sortMode }] as const,
    fileRevisions: (path: string) => ['server', serverUuid, 'files', 'revisions', path] as const,
    ignoreMatches: (pattern: string) => ['server', serverUuid, 'files', 'ignore-matches', pattern] as const,
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
    detail: (identifier: string) => ['user', 'api-keys', { identifier }] as const,
  },
  commandSnippets: {
    all: () => ['user', 'command-snippets'] as const,
  },
  eggs: {
    all: () => ['user', 'eggs'] as const,
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
