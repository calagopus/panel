import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  customType,
  index,
  inet,
  integer,
  json,
  jsonb,
  PgColumn,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const UTF8_MAX_SCALAR_SIZE = 4;

export const bytea = customType<{
  data: string;
  notNull: false;
  default: false;
}>({
  dataType() {
    return 'bytea';
  },

  toDriver(val: string) {
    let newVal = val;
    if (val.startsWith('0x')) {
      newVal = val.slice(2);
    }

    return Buffer.from(newVal, 'hex');
  },

  fromDriver(val: unknown) {
    return (val as Buffer).toString('hex');
  },
});

export const databaseTypeEnum = pgEnum('database_type', ['MYSQL', 'POSTGRES', 'MONGODB']);
export const serverStatusEnum = pgEnum('server_status', ['INSTALLING', 'INSTALL_FAILED', 'RESTORING_BACKUP']);
export const serverAutoStartBehaviorEnum = pgEnum('server_auto_start_behavior', ['ALWAYS', 'UNLESS_STOPPED', 'NEVER']);
export const backupDiskEnum = pgEnum('backup_disk', ['LOCAL', 'S3', 'DDUP_BAK', 'BTRFS', 'ZFS', 'RESTIC']);
export const userToastPositionEnum = pgEnum('user_toast_position', [
  'TOP_LEFT',
  'TOP_CENTER',
  'TOP_RIGHT',
  'BOTTOM_LEFT',
  'BOTTOM_CENTER',
  'BOTTOM_RIGHT',
]);

// Tables
export const settingsTable = pgTable('settings', {
  key: varchar({ length: 255 }).primaryKey().notNull(),
  value: text().notNull(),
});

export const usersTable = pgTable(
  'users',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    role_uuid: uuid().references(() => rolesTable.uuid, { onDelete: 'set null' }),
    external_id: varchar({ length: 255 }),
    avatar: varchar({ length: 255 }),
    username: varchar({ length: 15 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    name_first: varchar({ length: 255 }).notNull(),
    name_last: varchar({ length: 255 }).notNull(),
    password: text(),
    admin: boolean().default(false).notNull(),
    totp_enabled: boolean().default(false).notNull(),
    totp_last_used: timestamp(),
    totp_secret: char({ length: 32 }),
    language: varchar({ length: 15 }).default('en').notNull(),
    toast_position: userToastPositionEnum().default('BOTTOM_RIGHT').notNull(),
    start_on_grouped_servers: boolean().default(false).notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    uniqueIndex('users_external_id_idx').on(cols.external_id),
    uniqueIndex('users_username_idx').on(sql`lower(${cols.username})`),
    uniqueIndex('users_email_idx').on(sql`lower(${cols.email})`),
  ],
);

export const adminActivitiesTable = pgTable(
  'admin_activities',
  {
    user_uuid: uuid().references(() => usersTable.uuid, { onDelete: 'set null' }),
    impersonator_uuid: uuid().references(() => usersTable.uuid, { onDelete: 'set null' }),
    api_key_uuid: uuid().references(() => userApiKeysTable.uuid, { onDelete: 'set null' }),
    event: varchar({ length: 255 }).notNull(),
    ip: inet(),
    data: jsonb().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('admin_activities_user_uuid_idx').on(cols.user_uuid),
    index('admin_activities_impersonator_uuid_idx').on(cols.impersonator_uuid),
    index('admin_activities_event_idx').on(cols.event),
    index('admin_activities_user_uuid_event_idx').on(cols.user_uuid, cols.event),
  ],
);

export const userActivitiesTable = pgTable(
  'user_activities',
  {
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    impersonator_uuid: uuid().references(() => usersTable.uuid, { onDelete: 'set null' }),
    api_key_uuid: uuid().references(() => userApiKeysTable.uuid, { onDelete: 'set null' }),
    event: varchar({ length: 255 }).notNull(),
    ip: inet(),
    data: jsonb().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('user_activities_user_uuid_idx').on(cols.user_uuid),
    index('user_activities_impersonator_uuid_idx').on(cols.impersonator_uuid),
    index('user_activities_user_uuid_event_idx').on(cols.user_uuid, cols.event),
  ],
);

export const userSessionsTable = pgTable(
  'user_sessions',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    key_id: char({ length: 16 }).notNull(),
    key: text().notNull(),
    ip: inet().notNull(),
    user_agent: varchar({ length: 255 }).notNull(),
    last_used: timestamp().defaultNow().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('user_sessions_user_uuid_idx').on(cols.user_uuid),
    uniqueIndex('user_sessions_key_idx').on(cols.key),
  ],
);

export const userRecoveryCodesTable = pgTable(
  'user_recovery_codes',
  {
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    code: char({ length: 10 }).notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    primaryKey({ name: 'user_recovery_codes_user_uuid_code_idx', columns: [cols.user_uuid, cols.code] }),
    index('user_recovery_codes_user_uuid_idx').on(cols.user_uuid),
  ],
);

export const userPasswordResetsTable = pgTable(
  'user_password_resets',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    token: text().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('user_password_resets_user_uuid_idx').on(cols.user_uuid),
    uniqueIndex('user_password_resets_token_idx').on(cols.token),
  ],
);

export const userSecurityKeysTable = pgTable(
  'user_security_keys',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    name: varchar({ length: 31 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    credential_id: bytea().notNull(),
    passkey: jsonb(),
    registration: jsonb(),
    last_used: timestamp(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('user_security_keys_user_uuid_idx').on(cols.user_uuid),
    uniqueIndex('user_security_keys_user_uuid_name_idx').on(cols.user_uuid, cols.name),
    uniqueIndex('user_security_keys_user_uuid_credential_id_idx').on(cols.user_uuid, cols.credential_id),
  ],
);

export const userSshKeysTable = pgTable(
  'user_ssh_keys',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    name: varchar({ length: 31 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    fingerprint: char({ length: 50 }).notNull(),
    public_key: bytea().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('user_ssh_keys_user_uuid_idx').on(cols.user_uuid),
    uniqueIndex('user_ssh_keys_user_uuid_name_idx').on(cols.user_uuid, cols.name),
    uniqueIndex('user_ssh_keys_user_uuid_fingerprint_idx').on(cols.user_uuid, cols.fingerprint),
  ],
);

export const userApiKeysTable = pgTable(
  'user_api_keys',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    name: varchar({ length: 31 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    key_start: char({ length: 16 }).notNull(),
    key: text().notNull(),
    allowed_ips: inet().array().default([]).notNull(),
    user_permissions: varchar({ length: 64 }).array().notNull(),
    admin_permissions: varchar({ length: 64 }).array().notNull(),
    server_permissions: varchar({ length: 64 }).array().notNull(),
    last_used: timestamp(),
    expires: timestamp(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('user_api_keys_user_uuid_idx').on(cols.user_uuid),
    uniqueIndex('user_api_keys_user_uuid_name_idx').on(cols.user_uuid, cols.name),
    uniqueIndex('user_api_keys_user_uuid_key_start_idx').on(cols.user_uuid, cols.key_start),
    uniqueIndex('user_api_keys_key_idx').on(cols.key),
  ],
);

export const userOauthLinksTable = pgTable(
  'user_oauth_links',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    oauth_provider_uuid: uuid()
      .references(() => oauthProvidersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    identifier: varchar({ length: 255 }).notNull(),
    last_used: timestamp(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('user_oauth_links_user_uuid_idx').on(cols.user_uuid),
    index('user_oauth_links_oauth_provider_uuid_idx').on(cols.oauth_provider_uuid),
    uniqueIndex('user_oauth_links_user_uuid_oauth_provider_uuid_idx').on(cols.user_uuid, cols.oauth_provider_uuid),
    uniqueIndex('user_oauth_links_oauth_provider_uuid_identifier_idx').on(cols.oauth_provider_uuid, cols.identifier),
  ],
);

export const userCommandSnippetsTable = pgTable(
  'user_command_snippets',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    name: varchar({ length: 31 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    eggs: uuid().array().default([]).notNull(),
    command: text().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('command_snippets_user_uuid_idx').on(cols.user_uuid),
    uniqueIndex('command_snippets_user_uuid_name_idx').on(cols.user_uuid, cols.name),
  ],
);

export const userServerGroupsTable = pgTable(
  'user_server_groups',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    name: varchar({ length: 31 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    order_: smallint().default(0).notNull(),
    server_order: uuid().array().default([]).notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [index('server_groups_user_uuid_idx').on(cols.user_uuid)],
);

export const rolesTable = pgTable(
  'roles',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    require_two_factor: boolean().default(false).notNull(),
    admin_permissions: varchar({ length: 64 }).array().notNull(),
    server_permissions: varchar({ length: 64 }).array().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [uniqueIndex('roles_name_idx').on(cols.name)],
);

export const oauthProvidersTable = pgTable(
  'oauth_providers',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    client_id: varchar({ length: 255 }).notNull(),
    client_secret: bytea().notNull(),
    auth_url: varchar({ length: 255 }).notNull(),
    token_url: varchar({ length: 255 }).notNull(),
    info_url: varchar({ length: 64 }).notNull(),
    scopes: varchar({ length: 64 }).array().notNull(),
    identifier_path: varchar({ length: 255 }).notNull(),
    email_path: varchar({ length: 255 }),
    username_path: varchar({ length: 255 }),
    name_first_path: varchar({ length: 255 }),
    name_last_path: varchar({ length: 255 }),
    enabled: boolean().default(false).notNull(),
    login_only: boolean().default(false).notNull(),
    login_bypass_2fa: boolean().default(true).notNull(),
    link_viewable: boolean().default(false).notNull(),
    user_manageable: boolean().default(false).notNull(),
    basic_auth: boolean().default(false).notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [uniqueIndex('oauth_providers_name_idx').on(cols.name)],
);

export const mountsTable = pgTable(
  'mounts',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    source: varchar({ length: 255 }).notNull(),
    target: varchar({ length: 255 }).notNull(),
    read_only: boolean().default(false).notNull(),
    user_mountable: boolean().default(false).notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    uniqueIndex('mounts_name_idx').on(cols.name),
    uniqueIndex('mounts_source_target_idx').on(cols.source, cols.target),
  ],
);

export const backupConfigurationsTable = pgTable(
  'backup_configurations',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    maintenance_enabled: boolean().default(false).notNull(),
    description: text(),
    backup_disk: backupDiskEnum().default('LOCAL').notNull(),
    backup_configs: jsonb().default({}).notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [uniqueIndex('backup_configurations_name_idx').on(cols.name)],
);

export const locationsTable = pgTable(
  'locations',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    backup_configuration_uuid: uuid().references(() => backupConfigurationsTable.uuid, { onDelete: 'set null' }),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('locations_backup_configuration_uuid_idx').on(cols.backup_configuration_uuid),
    uniqueIndex('locations_name_idx').on(cols.name),
  ],
);

export const locationDatabaseHostsTable = pgTable(
  'location_database_hosts',
  {
    location_uuid: uuid()
      .references(() => locationsTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    database_host_uuid: uuid()
      .references(() => databaseHostsTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    primaryKey({ name: 'location_database_hosts_pk', columns: [cols.location_uuid, cols.database_host_uuid] }),
    index('location_database_hosts_location_uuid_idx').on(cols.location_uuid),
    index('location_database_hosts_database_host_uuid_idx').on(cols.database_host_uuid),
  ],
);

export const nodesTable = pgTable(
  'nodes',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    location_uuid: uuid()
      .references(() => locationsTable.uuid)
      .notNull(),
    backup_configuration_uuid: uuid().references(() => backupConfigurationsTable.uuid, { onDelete: 'set null' }),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    deployment_enabled: boolean().default(false).notNull(),
    maintenance_enabled: boolean().default(false).notNull(),
    description: text(),
    public_url: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }),
    url: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    sftp_host: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }),
    sftp_port: integer().notNull(),
    memory: bigint({ mode: 'number' }).notNull(),
    disk: bigint({ mode: 'number' }).notNull(),
    token_id: char({ length: 16 }).notNull(),
    token: bytea().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('nodes_location_uuid_idx').on(cols.location_uuid),
    index('nodes_backup_configuration_uuid_idx').on(cols.backup_configuration_uuid),
    uniqueIndex('nodes_uuid_idx').on(cols.uuid),
    uniqueIndex('nodes_name_idx').on(cols.name),
    uniqueIndex('nodes_token_id_idx').on(cols.token_id),
    uniqueIndex('nodes_token_idx').on(cols.token),
  ],
);

export const nodeMountsTable = pgTable(
  'node_mounts',
  {
    node_uuid: uuid()
      .references(() => nodesTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    mount_uuid: uuid()
      .references(() => mountsTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    primaryKey({ name: 'node_mounts_pk', columns: [cols.node_uuid, cols.mount_uuid] }),
    index('node_mounts_node_uuid_idx').on(cols.node_uuid),
    index('node_mounts_mount_uuid_idx').on(cols.mount_uuid),
  ],
);

export const nodeAllocationsTable = pgTable(
  'node_allocations',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    node_uuid: uuid()
      .references(() => nodesTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    ip: inet().notNull(),
    ip_alias: varchar({ length: 255 }),
    port: integer().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('allocations_node_uuid_idx').on(cols.node_uuid),
    uniqueIndex('allocations_node_uuid_ip_port_idx').on(cols.node_uuid, sql`host(${cols.ip})`, cols.port),
  ],
);

export const eggRepositoriesTable = pgTable(
  'egg_repositories',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    git_repository: text().notNull(),
    last_synced: timestamp(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    uniqueIndex('egg_repositories_name_idx').on(cols.name),
    uniqueIndex('egg_repositories_git_repository_idx').on(cols.git_repository),
  ],
);

export const eggRepositoriesEggsTable = pgTable(
  'egg_repository_eggs',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    egg_repository_uuid: uuid()
      .references(() => eggRepositoriesTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    path: text().notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    author: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    exported_egg: json().notNull(),
  },
  (cols) => [
    index('egg_repository_eggs_egg_repository_uuid_idx').on(cols.egg_repository_uuid),
    uniqueIndex('egg_repository_eggs_egg_repository_uuid_path_idx').on(cols.egg_repository_uuid, cols.path),
  ],
);

export const eggConfigurationsTable = pgTable(
  'egg_configurations',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    order_: smallint().default(0).notNull(),
    eggs: uuid().array().default([]).notNull(),
    config_allocations: jsonb(),
    config_routes: jsonb(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    uniqueIndex('egg_configurations_name_idx').on(cols.name),
    index('egg_configurations_eggs_idx').on(cols.eggs),
  ],
);

export const nestsTable = pgTable(
  'nests',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    author: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [uniqueIndex('nests_name_idx').on(cols.name)],
);

export const nestEggsTable = pgTable(
  'nest_eggs',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    nest_uuid: uuid()
      .references(() => nestsTable.uuid)
      .notNull(),
    egg_repository_egg_uuid: uuid().references(() => eggRepositoriesEggsTable.uuid, { onDelete: 'set null' }),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    author: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    config_files: jsonb().notNull(),
    config_startup: jsonb().notNull(),
    config_stop: jsonb().notNull(),
    config_script: jsonb().notNull(),
    startup: text().notNull(),
    force_outgoing_ip: boolean().default(false).notNull(),
    separate_port: boolean().default(false).notNull(),
    features: text().array().notNull(),
    docker_images: json().notNull(),
    file_denylist: text().array().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('eggs_nest_uuid_idx').on(cols.nest_uuid),
    index('eggs_egg_repository_egg_uuid_idx').on(cols.egg_repository_egg_uuid),
    uniqueIndex('eggs_nest_uuid_name_idx').on(cols.nest_uuid, cols.name),
  ],
);

export const nestEggMountsTable = pgTable(
  'nest_egg_mounts',
  {
    egg_uuid: uuid()
      .references(() => nestEggsTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    mount_uuid: uuid()
      .references(() => mountsTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    primaryKey({ name: 'egg_mounts_pk', columns: [cols.egg_uuid, cols.mount_uuid] }),
    index('egg_mounts_egg_uuid_idx').on(cols.egg_uuid),
    index('egg_mounts_mount_uuid_idx').on(cols.mount_uuid),
  ],
);

export const nestEggVariablesTable = pgTable(
  'nest_egg_variables',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    egg_uuid: uuid()
      .references(() => nestEggsTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    description_translations: jsonb().default({}).notNull(),
    order_: smallint().default(0).notNull(),
    env_variable: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    default_value: text(),
    user_viewable: boolean().default(true).notNull(),
    user_editable: boolean().default(false).notNull(),
    secret: boolean().default(false).notNull(),
    rules: text().array().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('egg_variables_egg_uuid_idx').on(cols.egg_uuid),
    uniqueIndex('egg_variables_egg_uuid_name_idx').on(cols.egg_uuid, cols.name),
    uniqueIndex('egg_variables_egg_uuid_env_variable_idx').on(cols.egg_uuid, cols.env_variable),
  ],
);

export const databaseHostsTable = pgTable(
  'database_hosts',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    deployment_enabled: boolean().default(false).notNull(),
    maintenance_enabled: boolean().default(false).notNull(),
    type: databaseTypeEnum().notNull(),
    public_host: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }),
    public_port: integer(),
    credentials: jsonb().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    uniqueIndex('database_hosts_name_idx').on(cols.name),
  ],
);

export const serversTable = pgTable(
  'servers',
  {
    uuid: uuid().primaryKey().notNull(),
    uuid_short: integer().notNull(),
    external_id: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }),
    allocation_uuid: uuid().references((): PgColumn => serverAllocationsTable.uuid, { onDelete: 'set null' }),
    destination_allocation_uuid: uuid().references((): PgColumn => serverAllocationsTable.uuid, {
      onDelete: 'set null',
    }),
    node_uuid: uuid()
      .references(() => nodesTable.uuid)
      .notNull(),
    destination_node_uuid: uuid().references(() => nodesTable.uuid),
    owner_uuid: uuid()
      .references(() => usersTable.uuid)
      .notNull(),
    egg_uuid: uuid()
      .references(() => nestEggsTable.uuid)
      .notNull(),
    backup_configuration_uuid: uuid().references(() => backupConfigurationsTable.uuid, { onDelete: 'set null' }),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    description: text(),
    status: serverStatusEnum(),
    suspended: boolean().default(false).notNull(),
    memory: bigint({ mode: 'number' }).notNull(),
    memory_overhead: bigint({ mode: 'number' }).default(0).notNull(),
    swap: bigint({ mode: 'number' }).notNull(),
    disk: bigint({ mode: 'number' }).notNull(),
    io_weight: smallint(),
    cpu: integer().notNull(),
    pinned_cpus: smallint().array().notNull(),
    startup: text().notNull(),
    image: varchar({ length: 255 }).notNull(),
    auto_kill: jsonb().default({ enabled: false, seconds: 30 }).notNull(),
    auto_start_behavior: serverAutoStartBehaviorEnum().default('UNLESS_STOPPED').notNull(),
    timezone: varchar({ length: 255 }),
    hugepages_passthrough_enabled: boolean().default(false).notNull(),
    kvm_passthrough_enabled: boolean().default(false).notNull(),
    allocation_limit: integer().default(0).notNull(),
    database_limit: integer().default(0).notNull(),
    backup_limit: integer().default(0).notNull(),
    schedule_limit: integer().default(0).notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('servers_external_id_idx').on(cols.external_id),
    index('servers_allocation_uuid_idx').on(cols.allocation_uuid),
    index('servers_node_uuid_idx').on(cols.node_uuid),
    index('servers_owner_uuid_idx').on(cols.owner_uuid),
    index('servers_egg_uuid_idx').on(cols.egg_uuid),
    index('servers_backup_configuration_uuid_idx').on(cols.backup_configuration_uuid),
    uniqueIndex('servers_uuid_short_idx').on(cols.uuid_short),
  ],
);

export const serverAllocationsTable = pgTable(
  'server_allocations',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    server_uuid: uuid()
      .references(() => serversTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    allocation_uuid: uuid()
      .references(() => nodeAllocationsTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    notes: text(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('server_allocations_server_uuid_idx').on(cols.server_uuid),
    uniqueIndex('server_allocations_allocation_uuid_idx').on(cols.allocation_uuid),
  ],
);

export const serverSubusersTable = pgTable(
  'server_subusers',
  {
    server_uuid: uuid()
      .references(() => serversTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    user_uuid: uuid()
      .references(() => usersTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    permissions: varchar({ length: 32 }).array().notNull(),
    ignored_files: text().array().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    primaryKey({ name: 'server_subusers_pk', columns: [cols.server_uuid, cols.user_uuid] }),
    index('server_subusers_server_uuid_idx').on(cols.server_uuid),
    index('server_subusers_user_uuid_idx').on(cols.user_uuid),
  ],
);

export const serverActivitiesTable = pgTable(
  'server_activities',
  {
    server_uuid: uuid()
      .references(() => serversTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    user_uuid: uuid().references(() => usersTable.uuid, { onDelete: 'set null' }),
    impersonator_uuid: uuid().references(() => usersTable.uuid, { onDelete: 'set null' }),
    api_key_uuid: uuid().references(() => userApiKeysTable.uuid, { onDelete: 'set null' }),
    schedule_uuid: uuid().references(() => serverSchedulesTable.uuid, { onDelete: 'set null' }),
    event: varchar({ length: 255 }).notNull(),
    ip: inet(),
    data: jsonb().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('server_activities_server_uuid_idx').on(cols.server_uuid),
    index('server_activities_user_uuid_idx').on(cols.user_uuid),
    index('server_activities_impersonator_uuid_idx').on(cols.impersonator_uuid),
    index('server_activities_server_uuid_event_idx').on(cols.server_uuid, cols.event),
    index('server_activities_user_uuid_event_idx').on(cols.user_uuid, cols.event),
  ],
);

export const serverVariablesTable = pgTable(
  'server_variables',
  {
    server_uuid: uuid()
      .references(() => serversTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    variable_uuid: uuid()
      .references(() => nestEggVariablesTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    value: text().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    primaryKey({ name: 'server_variables_pk', columns: [cols.server_uuid, cols.variable_uuid] }),
    index('server_variables_server_uuid_idx').on(cols.server_uuid),
    index('server_variables_variable_uuid_idx').on(cols.variable_uuid),
  ],
);

export const serverMountsTable = pgTable(
  'server_mounts',
  {
    server_uuid: uuid()
      .references(() => serversTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    mount_uuid: uuid()
      .references(() => mountsTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    primaryKey({ name: 'server_mounts_pk', columns: [cols.server_uuid, cols.mount_uuid] }),
    index('server_mounts_server_uuid_idx').on(cols.server_uuid),
    index('server_mounts_mount_uuid_idx').on(cols.mount_uuid),
  ],
);

export const serverBackupsTable = pgTable(
  'server_backups',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    server_uuid: uuid().references(() => serversTable.uuid, { onDelete: 'set null' }),
    node_uuid: uuid()
      .references(() => nodesTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    backup_configuration_uuid: uuid().references(() => backupConfigurationsTable.uuid, { onDelete: 'set null' }),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    successful: boolean().default(false).notNull(),
    browsable: boolean().default(false).notNull(),
    streaming: boolean().default(false).notNull(),
    locked: boolean().default(false).notNull(),
    ignored_files: text().array().notNull(),
    checksum: varchar({ length: 255 }),
    bytes: bigint({ mode: 'number' }).default(0).notNull(),
    files: bigint({ mode: 'number' }).default(0).notNull(),
    disk: backupDiskEnum().notNull(),
    upload_id: text(),
    upload_path: text(),
    completed: timestamp(),
    deleted: timestamp(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('server_backups_server_uuid_idx').on(cols.server_uuid),
    index('server_backups_node_uuid_idx').on(cols.node_uuid),
    index('server_backups_backup_configuration_uuid_idx').on(cols.backup_configuration_uuid),
    index('server_backups_successful_idx').on(cols.successful),
    uniqueIndex('server_backups_uuid_idx').on(cols.uuid),
  ],
);

export const serverDatabasesTable = pgTable(
  'server_databases',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    server_uuid: uuid()
      .references(() => serversTable.uuid)
      .notNull(),
    database_host_uuid: uuid()
      .references(() => databaseHostsTable.uuid)
      .notNull(),
    name: varchar({ length: 31 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    locked: boolean().default(false).notNull(),
    username: char({ length: 20 }).notNull(),
    password: bytea().notNull(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('server_databases_server_uuid_idx').on(cols.server_uuid),
    index('server_databases_database_host_uuid_idx').on(cols.database_host_uuid),
    uniqueIndex('server_databases_server_uuid_database_idx').on(cols.server_uuid, cols.name),
  ],
);

export const serverSchedulesTable = pgTable(
  'server_schedules',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    server_uuid: uuid()
      .references(() => serversTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    name: varchar({ length: 255 * UTF8_MAX_SCALAR_SIZE }).notNull(),
    enabled: boolean().notNull(),
    triggers: jsonb().notNull(),
    condition: jsonb().notNull(),
    last_run: timestamp(),
    last_failure: timestamp(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [
    index('server_schedules_server_uuid_idx').on(cols.server_uuid),
    index('server_schedules_enabled_idx').on(cols.enabled),
    uniqueIndex('server_schedules_server_uuid_name_idx').on(cols.server_uuid, cols.name),
  ],
);

export const serverScheduleStepsTable = pgTable(
  'server_schedule_steps',
  {
    uuid: uuid().default(sql`gen_random_uuid()`).primaryKey().notNull(),
    schedule_uuid: uuid()
      .references(() => serverSchedulesTable.uuid, { onDelete: 'cascade' })
      .notNull(),
    action: jsonb().notNull(),
    order_: smallint().default(0).notNull(),
    error: text(),
    created: timestamp().defaultNow().notNull(),
  },
  (cols) => [index('server_schedule_steps_schedule_uuid_idx').on(cols.schedule_uuid)],
);
