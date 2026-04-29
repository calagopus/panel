use indexmap::IndexMap;
use serde::Serialize;
use std::{
    collections::HashSet,
    sync::{LazyLock, RwLock, RwLockReadGuard},
};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Clone)]
pub struct PermissionGroup {
    pub description: &'static str,
    pub permissions: IndexMap<&'static str, &'static str>,
}

impl PermissionGroup {
    pub fn add_permission(&mut self, key: &'static str, description: &'static str) {
        self.permissions.insert(key, description);
    }
}

#[derive(ToSchema, Serialize)]
pub struct PermissionMap {
    #[serde(skip)]
    list: HashSet<String>,
    #[serde(flatten)]
    map: IndexMap<&'static str, PermissionGroup>,
}

impl PermissionMap {
    pub(crate) fn new() -> Self {
        Self {
            list: HashSet::new(),
            map: IndexMap::new(),
        }
    }

    pub(crate) fn replace(&mut self, map: IndexMap<&'static str, PermissionGroup>) {
        self.list = map
            .iter()
            .flat_map(|(key, group)| {
                group
                    .permissions
                    .keys()
                    .map(|permission| format!("{key}.{permission}"))
                    .collect::<HashSet<_>>()
            })
            .collect();
        self.map = map;
    }

    #[inline]
    pub fn list(&self) -> &HashSet<String> {
        &self.list
    }

    pub fn validate_permissions(
        &self,
        permissions: &[compact_str::CompactString],
    ) -> Result<(), garde::Error> {
        for permission in permissions {
            if !self.list().contains(&**permission) {
                return Err(garde::Error::new(compact_str::format_compact!(
                    "invalid permission: {permission}"
                )));
            }
        }

        Ok(())
    }
}

pub(crate) static BASE_USER_PERMISSIONS: LazyLock<IndexMap<&'static str, PermissionGroup>> =
    LazyLock::new(|| {
        IndexMap::from([
            (
                "account",
                PermissionGroup {
                    description: "Permissions that control the ability to change account settings.",
                    permissions: IndexMap::from([
                        ("email", "Allows changing the account's email address."),
                        ("password", "Allows changing the account's password."),
                        (
                            "two-factor",
                            "Allows adding and removing two-factor authentication.",
                        ),
                        (
                            "avatar",
                            "Allows updating and removing the account's avatar.",
                        ),
                    ]),
                },
            ),
            (
                "servers",
                PermissionGroup {
                    description: "Permissions that control the ability to list servers and manage server groups.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new server groups."),
                        ("read", "Allows viewing servers and server groups."),
                        ("update", "Allows modifying server groups."),
                        ("delete", "Allows deleting server groups."),
                    ]),
                },
            ),
            (
                "api-keys",
                PermissionGroup {
                    description: "Permissions that control the ability to manage API keys on an account. API keys can never edit themselves or assign permissions they do not have.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new API keys."),
                        ("read", "Allows viewing API keys and their permissions."),
                        ("update", "Allows modifying other API keys."),
                        ("delete", "Allows deleting API keys."),
                        ("recreate", "Allows recreating API keys."),
                    ]),
                },
            ),
            (
                "security-keys",
                PermissionGroup {
                    description: "Permissions that control the ability to manage security keys on an account.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new security keys."),
                        ("read", "Allows viewing security keys."),
                        ("update", "Allows modifying security keys."),
                        ("delete", "Allows deleting security keys."),
                    ]),
                },
            ),
            (
                "ssh-keys",
                PermissionGroup {
                    description: "Permissions that control the ability to manage SSH keys on an account.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating or importing new SSH keys."),
                        ("read", "Allows viewing SSH keys."),
                        ("update", "Allows modifying other SSH keys."),
                        ("delete", "Allows deleting SSH keys."),
                    ]),
                },
            ),
            (
                "oauth-links",
                PermissionGroup {
                    description: "Permissions that control the ability to manage OAuth links on an account.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new OAuth links."),
                        ("read", "Allows viewing OAuth links."),
                        ("delete", "Allows deleting OAuth links."),
                    ]),
                },
            ),
            (
                "command-snippets",
                PermissionGroup {
                    description: "Permissions that control the ability to manage command snippets on an account.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new command snippets."),
                        ("read", "Allows viewing command snippets."),
                        ("update", "Allows modifying command snippets."),
                        ("delete", "Allows deleting command snippets."),
                    ]),
                },
            ),
            (
                "sessions",
                PermissionGroup {
                    description: "Permissions that control the ability to manage sessions on an account.",
                    permissions: IndexMap::from([
                        ("read", "Allows viewing sessions and their IP addresses."),
                        ("delete", "Allows deleting sessions."),
                    ]),
                },
            ),
            (
                "activity",
                PermissionGroup {
                    description: "Permissions that control the ability to view the activity log on an account.",
                    permissions: IndexMap::from([(
                        "read",
                        "Allows viewing the account's activity logs.",
                    )]),
                },
            ),
        ])
    });

pub(crate) static USER_PERMISSIONS: LazyLock<RwLock<PermissionMap>> =
    LazyLock::new(|| RwLock::new(PermissionMap::new()));

#[inline]
pub fn get_user_permissions() -> RwLockReadGuard<'static, PermissionMap> {
    USER_PERMISSIONS.read().unwrap()
}

#[inline]
pub fn validate_user_permissions(
    permissions: &[compact_str::CompactString],
    _context: &(),
) -> Result<(), garde::Error> {
    get_user_permissions().validate_permissions(permissions)
}

pub(crate) static BASE_ADMIN_PERMISSIONS: LazyLock<IndexMap<&'static str, PermissionGroup>> =
    LazyLock::new(|| {
        IndexMap::from([
            (
                "stats",
                PermissionGroup {
                    description: "Permissions that control the ability to view stats for the panel.",
                    permissions: IndexMap::from([("read", "Allows viewing panel statistics.")]),
                },
            ),
            (
                "settings",
                PermissionGroup {
                    description: "Permissions that control the ability to manage settings for the panel.",
                    permissions: IndexMap::from([
                        ("read", "Allows viewing panel settings and secrets."),
                        ("update", "Allows modifying panel settings and secrets."),
                    ]),
                },
            ),
            (
                "email-templates",
                PermissionGroup {
                    description: "Permissions that control the ability to manage email templates for the panel.",
                    permissions: IndexMap::from([
                        ("read", "Allows viewing email templates."),
                        ("update", "Allows modifying email templates."),
                    ]),
                },
            ),
            (
                "extensions",
                PermissionGroup {
                    description: "Permissions that control the ability to manage extensions for the panel.",
                    permissions: IndexMap::from([
                        ("read", "Allows viewing panel extensions."),
                        (
                            "manage",
                            "Allows installing, updating, and removing panel extensions, usually also used to manage extension settings.",
                        ),
                    ]),
                },
            ),
            (
                "assets",
                PermissionGroup {
                    description: "Permissions that control the ability to manage assets for the panel.",
                    permissions: IndexMap::from([
                        ("read", "Allows viewing panel assets."),
                        ("upload", "Allows creating and modifying assets."),
                        ("delete", "Allows deleting panel assets."),
                    ]),
                },
            ),
            (
                "users",
                PermissionGroup {
                    description: "Permissions that control the ability to manage users for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new users."),
                        ("read", "Allows viewing users."),
                        ("update", "Allows modifying users."),
                        (
                            "disable-two-factor",
                            "Allows removing two-factor authentication from users.",
                        ),
                        ("delete", "Allows deleting users."),
                        (
                            "email",
                            "Allows sending email actions to users, such as password resets.",
                        ),
                        ("activity", "Allows viewing a user's activity log."),
                        (
                            "oauth-links",
                            "Allows viewing and managing a user's OAuth links.",
                        ),
                        ("impersonate", "Allows impersonating other users."),
                    ]),
                },
            ),
            (
                "roles",
                PermissionGroup {
                    description: "Permissions that control the ability to manage roles for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new roles."),
                        ("read", "Allows viewing roles."),
                        ("update", "Allows modifying roles."),
                        ("delete", "Allows deleting roles."),
                    ]),
                },
            ),
            (
                "locations",
                PermissionGroup {
                    description: "Permissions that control the ability to manage locations for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new locations."),
                        ("read", "Allows viewing locations."),
                        ("update", "Allows modifying locations."),
                        ("delete", "Allows deleting locations."),
                        (
                            "database-hosts",
                            "Allows viewing and managing a location's database hosts.",
                        ),
                    ]),
                },
            ),
            (
                "backup-configurations",
                PermissionGroup {
                    description: "Permissions that control the ability to manage backup configurations for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new backup configurations."),
                        (
                            "read",
                            "Allows viewing backup configurations and their passwords.",
                        ),
                        (
                            "update",
                            "Allows modifying backup configurations and their passwords.",
                        ),
                        ("delete", "Allows deleting backup configurations."),
                        (
                            "backups",
                            "Allows viewing backups associated with a backup configuration.",
                        ),
                    ]),
                },
            ),
            (
                "nodes",
                PermissionGroup {
                    description: "Permissions that control the ability to manage nodes for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new nodes."),
                        ("read", "Allows viewing nodes and their tokens."),
                        ("update", "Allows modifying nodes."),
                        ("delete", "Allows deleting nodes."),
                        ("reset-token", "Allows resetting a node's token."),
                        (
                            "allocations",
                            "Allows viewing and managing a node's allocations.",
                        ),
                        ("mounts", "Allows viewing and managing a node's mounts."),
                        ("backups", "Allows viewing and managing a node's backups."),
                        ("power", "Allows executing mass-power actions on nodes."),
                        (
                            "transfers",
                            "Allows viewing and managing mass-server transfers between nodes.",
                        ),
                    ]),
                },
            ),
            (
                "servers",
                PermissionGroup {
                    description: "Permissions that control the ability to manage servers for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new servers."),
                        ("read", "Allows viewing servers."),
                        ("update", "Allows modifying servers."),
                        ("delete", "Allows deleting servers."),
                        (
                            "transfer",
                            "Allows transferring servers to other nodes or canceling ongoing transfers.",
                        ),
                        (
                            "allocations",
                            "Allows viewing and managing a server's allocations.",
                        ),
                        (
                            "variables",
                            "Allows viewing and managing a server's variables.",
                        ),
                        ("mounts", "Allows viewing and managing a server's mounts."),
                    ]),
                },
            ),
            (
                "nests",
                PermissionGroup {
                    description: "Permissions that control the ability to manage nests for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new nests."),
                        ("read", "Allows viewing nests."),
                        ("update", "Allows modifying nests."),
                        ("delete", "Allows deleting nests."),
                    ]),
                },
            ),
            (
                "eggs",
                PermissionGroup {
                    description: "Permissions that control the ability to manage eggs for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating and importing new eggs."),
                        ("read", "Allows viewing eggs."),
                        ("update", "Allows modifying eggs."),
                        ("delete", "Allows deleting eggs."),
                        ("mounts", "Allows viewing and managing an egg's mounts."),
                    ]),
                },
            ),
            (
                "egg-configurations",
                PermissionGroup {
                    description: "Permissions that control the ability to manage egg configurations for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new egg configurations."),
                        ("read", "Allows viewing egg configurations."),
                        ("update", "Allows modifying egg configurations."),
                        ("delete", "Allows deleting egg configurations."),
                    ]),
                },
            ),
            (
                "egg-repositories",
                PermissionGroup {
                    description: "Permissions that control the ability to manage egg repositories for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new egg repositories."),
                        ("read", "Allows viewing egg repositories."),
                        ("update", "Allows modifying egg repositories."),
                        ("delete", "Allows deleting egg repositories."),
                        (
                            "sync",
                            "Allows synchronizing egg repositories with their remote sources.",
                        ),
                    ]),
                },
            ),
            (
                "database-hosts",
                PermissionGroup {
                    description: "Permissions that control the ability to manage database hosts for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new database hosts."),
                        ("read", "Allows viewing database hosts."),
                        ("update", "Allows modifying database hosts."),
                        ("delete", "Allows deleting database hosts."),
                    ]),
                },
            ),
            (
                "oauth-providers",
                PermissionGroup {
                    description: "Permissions that control the ability to manage OAuth providers for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new OAuth providers."),
                        ("read", "Allows viewing OAuth providers."),
                        ("update", "Allows modifying OAuth providers."),
                        ("delete", "Allows deleting OAuth providers."),
                    ]),
                },
            ),
            (
                "mounts",
                PermissionGroup {
                    description: "Permissions that control the ability to manage mounts for the panel.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new mounts."),
                        ("read", "Allows viewing mounts."),
                        ("update", "Allows modifying mounts."),
                        ("delete", "Allows deleting mounts."),
                    ]),
                },
            ),
            (
                "activity",
                PermissionGroup {
                    description: "Permissions that control the ability to view the activity log for all admin operations.",
                    permissions: IndexMap::from([(
                        "read",
                        "Allows viewing the activity logs for all admin operations.",
                    )]),
                },
            ),
        ])
    });

pub(crate) static ADMIN_PERMISSIONS: LazyLock<RwLock<PermissionMap>> =
    LazyLock::new(|| RwLock::new(PermissionMap::new()));

#[inline]
pub fn get_admin_permissions() -> RwLockReadGuard<'static, PermissionMap> {
    ADMIN_PERMISSIONS.read().unwrap()
}

#[inline]
pub fn validate_admin_permissions(
    permissions: &[compact_str::CompactString],
    _context: &(),
) -> Result<(), garde::Error> {
    get_admin_permissions().validate_permissions(permissions)
}

pub(crate) static BASE_SERVER_PERMISSIONS: LazyLock<IndexMap<&'static str, PermissionGroup>> =
    LazyLock::new(|| {
        IndexMap::from([
            (
                "control",
                PermissionGroup {
                    description: "Permissions that control the ability to control the power state of a server, read the console, or send commands.",
                    permissions: IndexMap::from([
                        ("read-console", "Allows reading the server console logs."),
                        (
                            "console",
                            "Allows sending commands to the server instance via the console.",
                        ),
                        ("start", "Allows starting the server if it is stopped."),
                        ("stop", "Allows stopping the server if it is running."),
                        (
                            "restart",
                            "Allows restarting the server. This permits starting the server if it is offline, but not placing it in a completely stopped state.",
                        ),
                    ]),
                },
            ),
            (
                "subusers",
                PermissionGroup {
                    description: "Permissions that control the ability to manage subusers of a server. Users can never edit their own account or assign permissions they do not have.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new subusers for the server."),
                        ("read", "Allows viewing subusers and their permissions."),
                        ("update", "Allows modifying other subusers."),
                        ("delete", "Allows deleting subusers from the server."),
                    ]),
                },
            ),
            (
                "files",
                PermissionGroup {
                    description: "Permissions that control the ability to modify the filesystem for this server.",
                    permissions: IndexMap::from([
                        (
                            "create",
                            "Allows creating additional files and folders via the panel or direct upload.",
                        ),
                        (
                            "read",
                            "Allows viewing the contents of a directory, but not reading or downloading individual files.",
                        ),
                        (
                            "read-content",
                            "Allows viewing the contents of a specific file. This also permits downloading files.",
                        ),
                        (
                            "update",
                            "Allows updating the contents of an existing file or directory.",
                        ),
                        ("delete", "Allows deleting files or directories."),
                        ("archive", "Allows archiving the contents of a directory."),
                        ("sftp", "Allows connecting via SFTP to manage files."),
                    ]),
                },
            ),
            (
                "backups",
                PermissionGroup {
                    description: "Permissions that control the ability to manage server backups.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new backups for the server."),
                        ("read", "Allows viewing existing backups."),
                        ("download", "Allows downloading backups."),
                        ("restore", "Allows restoring backups."),
                        ("update", "Allows updating existing backups."),
                        ("delete", "Allows deleting backups."),
                    ]),
                },
            ),
            (
                "schedules",
                PermissionGroup {
                    description: "Permissions that control the ability to manage server schedules.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new schedules."),
                        ("read", "Allows viewing existing schedules."),
                        ("update", "Allows updating existing schedules."),
                        ("delete", "Allows deleting schedules."),
                    ]),
                },
            ),
            (
                "allocations",
                PermissionGroup {
                    description: "Permissions that control the ability to modify the port allocations for this server.",
                    permissions: IndexMap::from([
                        (
                            "read",
                            "Allows viewing all allocations currently assigned to this server. Users with any level of access can always view the primary allocation.",
                        ),
                        (
                            "create",
                            "Allows assigning additional allocations to the server.",
                        ),
                        (
                            "update",
                            "Allows changing the primary server allocation and attaching notes to allocations.",
                        ),
                        ("delete", "Allows deleting allocations from the server."),
                    ]),
                },
            ),
            (
                "startup",
                PermissionGroup {
                    description: "Permissions that control the ability to view and modify this server's startup parameters.",
                    permissions: IndexMap::from([
                        (
                            "read",
                            "Allows viewing the startup variables for the server.",
                        ),
                        ("update", "Allows modifying the startup variables."),
                        (
                            "command",
                            "Allows modifying the command used to start the server.",
                        ),
                        (
                            "docker-image",
                            "Allows modifying the Docker image used when running the server.",
                        ),
                    ]),
                },
            ),
            (
                "databases",
                PermissionGroup {
                    description: "Permissions that control the ability to manage databases on this server.",
                    permissions: IndexMap::from([
                        ("create", "Allows creating new databases."),
                        (
                            "read",
                            "Allows viewing databases associated with this server.",
                        ),
                        (
                            "read-password",
                            "Allows viewing the password associated with a database instance.",
                        ),
                        (
                            "update",
                            "Allows rotating the password on a database instance. Users without the read-password permission will not see the updated password.",
                        ),
                        (
                            "recreate",
                            "Allows deleting and recreating a database, in the process wiping all data.",
                        ),
                        (
                            "delete",
                            "Allows removing database instances from this server.",
                        ),
                    ]),
                },
            ),
            (
                "mounts",
                PermissionGroup {
                    description: "Permissions that control the ability to manage server mounts.",
                    permissions: IndexMap::from([
                        ("attach", "Allows attaching new mounts to the server."),
                        ("read", "Allows viewing existing mounts."),
                        ("detach", "Allows detaching mounts from the server."),
                    ]),
                },
            ),
            (
                "settings",
                PermissionGroup {
                    description: "Permissions that control the ability to manage settings on this server.",
                    permissions: IndexMap::from([
                        (
                            "rename",
                            "Allows renaming the server and changing its description.",
                        ),
                        ("timezone", "Allows changing the server's timezone."),
                        (
                            "auto-kill",
                            "Allows changing the server's auto-kill settings.",
                        ),
                        (
                            "auto-start",
                            "Allows changing the server's auto-start settings.",
                        ),
                        ("install", "Allows triggering a reinstall of the server."),
                        (
                            "cancel-install",
                            "Allows canceling the server's installation process.",
                        ),
                    ]),
                },
            ),
            (
                "activity",
                PermissionGroup {
                    description: "Permissions that control the ability to view the activity log on this server.",
                    permissions: IndexMap::from([(
                        "read",
                        "Allows viewing the server's activity logs.",
                    )]),
                },
            ),
        ])
    });

pub(crate) static SERVER_PERMISSIONS: LazyLock<RwLock<PermissionMap>> =
    LazyLock::new(|| RwLock::new(PermissionMap::new()));

#[inline]
pub fn get_server_permissions() -> RwLockReadGuard<'static, PermissionMap> {
    SERVER_PERMISSIONS.read().unwrap()
}

#[inline]
pub fn validate_server_permissions(
    permissions: &[compact_str::CompactString],
    _context: &(),
) -> Result<(), garde::Error> {
    get_server_permissions().validate_permissions(permissions)
}
