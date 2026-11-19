use super::{
    ImportArgs, SourceContext, model::*, pterodactyl, source_bool, source_i64, source_optional_i64,
    source_optional_text, source_readable_uuid, source_text, source_timestamp,
};
use clap::{Args, FromArgMatches};
use shared::models::server_backup::BackupDisk;
use std::collections::{HashMap, HashSet};

#[derive(Args)]
pub struct PelicanArgs {
    #[arg(
        short = 'e',
        long = "environment",
        help = "the environment variable file location for the pelican panel",
        default_value = "/var/www/pelican/.env",
        value_hint = clap::ValueHint::FilePath
    )]
    environment: String,
    #[command(flatten)]
    import: ImportArgs,
}

pub struct PelicanCommand;

impl shared::extensions::commands::CliCommand<PelicanArgs> for PelicanCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = PelicanArgs::from_arg_matches(&arg_matches)?;

                super::run(SourceKind::Pelican, &args.environment, args.import, env).await
            })
        })
    }
}

fn first_tag(raw_tags: Option<&str>) -> String {
    raw_tags
        .and_then(|raw_tags| serde_json::from_str::<Vec<String>>(raw_tags).ok())
        .and_then(|tags| {
            tags.into_iter()
                .map(|tag| tag.trim().to_string())
                .find(|tag| !tag.is_empty())
        })
        .unwrap_or_else(|| "pelican".into())
}

/// Pelican replaced locations and nests with free-form tags, so one of each is created per
/// distinct first tag.
struct TagGroups {
    ids: HashMap<String, i64>,
}

impl TagGroups {
    fn new() -> Self {
        Self {
            ids: HashMap::new(),
        }
    }

    fn id(&mut self, tag: &str) -> (i64, bool) {
        let next = self.ids.len() as i64 + 1;
        match self.ids.get(tag) {
            Some(id) => (*id, false),
            None => {
                self.ids.insert(tag.to_string(), next);
                (next, true)
            }
        }
    }
}

fn env_var(key: &str) -> Option<String> {
    super::source_env::var(key).filter(|value| !value.is_empty() && value != "null")
}

fn mail_from_env() -> Option<SourceMail> {
    if env_var("MAIL_MAILER").as_deref() != Some("smtp") {
        return None;
    }

    Some(SourceMail {
        host: env_var("MAIL_HOST")?.into(),
        port: env_var("MAIL_PORT")?.parse().ok()?,
        username: env_var("MAIL_USERNAME").map(Into::into),
        password: env_var("MAIL_PASSWORD").map(Into::into),
        start_tls: env_var("MAIL_SCHEME")
            .or_else(|| env_var("MAIL_ENCRYPTION"))
            .is_some_and(|scheme| scheme == "tls" || scheme == "smtp"),
        from_address: env_var("MAIL_FROM_ADDRESS")?.into(),
        from_name: env_var("MAIL_FROM_NAME").map(Into::into),
    })
}

async fn read_backup_hosts(
    context: &SourceContext,
) -> Result<Option<(Vec<SourceBackupConfig>, HashMap<i64, String>)>, anyhow::Error> {
    if !context.has_table("backup_hosts").await? {
        return Ok(None);
    }

    let mut configs = Vec::new();
    let mut schemas = HashMap::new();

    for row in &context.table("backup_hosts", None).await? {
        let id = source_i64(row, "id")?;
        let schema = source_text(row, "schema")?;
        let configuration: serde_json::Value = source_optional_text(row, "configuration")?
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default();
        let text = |key: &str| -> compact_str::CompactString {
            configuration
                .get(key)
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .into()
        };

        let disk = if schema == "s3" {
            BackupDisk::S3
        } else {
            BackupDisk::Local
        };

        configs.push(SourceBackupConfig {
            id,
            name: source_text(row, "name")?,
            disk,
            s3: (disk == BackupDisk::S3).then(|| {
                shared::models::backup_configuration::BackupConfigsS3 {
                    region: text("region"),
                    access_key: text("key"),
                    secret_key: text("secret"),
                    bucket: text("bucket"),
                    endpoint: text("endpoint"),
                    path_style: configuration
                        .get("use_path_style_endpoint")
                        .is_some_and(|value| value.as_bool() == Some(true) || value == "true"),
                    compression_type: wings_api::CompressionType::Gz,
                    part_size: 1024 * 1024 * 1024,
                }
            }),
        });
        schemas.insert(id, schema);
    }

    Ok(Some((configs, schemas)))
}

pub(super) async fn read(
    context: &SourceContext,
    app_url: &str,
) -> Result<SourceData, anyhow::Error> {
    let mut settings = pterodactyl::read_settings(context, app_url).await?;
    if settings.app_name.is_none() {
        settings.app_name = env_var("APP_NAME").map(Into::into);
    }
    if settings.mail.is_none() {
        settings.mail = mail_from_env();
    }

    let backup_hosts = read_backup_hosts(context).await?;
    let mut node_backup_hosts: HashMap<i64, i64> = HashMap::new();
    if backup_hosts.is_some() && context.has_table("backup_host_node").await? {
        for row in &context.table("backup_host_node", None).await? {
            node_backup_hosts.insert(
                source_i64(row, "node_id")?,
                source_i64(row, "backup_host_id")?,
            );
        }
    }

    let mut admin_ids: HashSet<i64> = HashSet::new();
    if context.has_table("model_has_roles").await? {
        let admin_roles: HashSet<i64> = context
            .table("roles", None)
            .await?
            .iter()
            .filter(|row| {
                source_text(row, "name").is_ok_and(|name| name.eq_ignore_ascii_case("root admin"))
            })
            .filter_map(|row| source_i64(row, "id").ok())
            .collect();

        for row in &context.table("model_has_roles", None).await? {
            if admin_roles.contains(&source_i64(row, "role_id")?)
                && source_text(row, "model_type")?.eq_ignore_ascii_case("user")
            {
                admin_ids.insert(source_i64(row, "model_id")?);
            }
        }
    }

    let users = context
        .map_table("users", None, |table, row| {
            let id = source_i64(row, "id")?;
            let (totp_enabled, totp_secret) = if table.has("mfa_app_secret") {
                let secret = source_optional_text(row, "mfa_app_secret")?
                    .filter(|secret| !secret.is_empty())
                    .map(|secret| context.decrypt(&secret));
                (secret.is_some(), secret)
            } else if table.has("totp_secret") {
                (
                    source_bool(row, "use_totp")?,
                    source_optional_text(row, "totp_secret")?
                        .filter(|secret| !secret.is_empty())
                        .map(|secret| context.decrypt(&secret)),
                )
            } else {
                (false, None)
            };

            Ok(SourceUser {
                id,
                uuid: source_readable_uuid(row, "uuid"),
                external_id: source_optional_text(row, "external_id")?,
                username: source_text(row, "username")?,
                email: source_text(row, "email")?,
                name_first: if table.has("name_first") {
                    source_optional_text(row, "name_first")?
                } else {
                    None
                },
                name_last: if table.has("name_last") {
                    source_optional_text(row, "name_last")?
                } else {
                    None
                },
                password: source_optional_text(row, "password")?.unwrap_or_default(),
                admin: admin_ids.contains(&id)
                    || (table.has("root_admin") && source_bool(row, "root_admin")?),
                totp_enabled,
                totp_secret,
                language: source_optional_text(row, "language")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let mut locations = Vec::new();
    let mut location_groups = TagGroups::new();
    let nodes = context
        .map_table("nodes", None, |table, row| {
            let id = source_i64(row, "id")?;
            let created = source_timestamp(row, "created_at");

            let tag = first_tag(source_optional_text(row, "tags")?.as_deref());
            let (location_id, new) = location_groups.id(&tag);
            if new {
                locations.push(SourceLocation {
                    id: location_id,
                    description: Some(format!(
                        "generated from Pelican node tag `{tag}` during import"
                    )),
                    name: tag,
                    created,
                });
            }

            Ok(SourceNode {
                id,
                uuid: source_readable_uuid(row, "uuid"),
                location_id,
                backup_config_id: node_backup_hosts.get(&id).copied(),
                name: source_text(row, "name")?,
                description: source_optional_text(row, "description")?,
                public: source_bool(row, "public")?,
                maintenance_mode: source_bool(row, "maintenance_mode")?,
                scheme: source_text(row, "scheme")?,
                fqdn: source_text(row, "fqdn")?,
                daemon_listen: source_i64(row, "daemon_listen")?,
                daemon_connect: if table.has("daemon_connect") {
                    source_optional_i64(row, "daemon_connect")?
                } else {
                    None
                },
                daemon_sftp: source_i64(row, "daemon_sftp")?,
                sftp_alias: if table.has("daemon_sftp_alias") {
                    source_optional_text(row, "daemon_sftp_alias")?
                } else {
                    None
                },
                memory: source_i64(row, "memory")?,
                disk: source_i64(row, "disk")?,
                token_id: source_optional_text(row, "daemon_token_id")?.unwrap_or_default(),
                token: context
                    .decrypt(&source_optional_text(row, "daemon_token")?.unwrap_or_default()),
                created,
            })
        })
        .await?;

    let mut nests = Vec::new();
    let mut nest_groups = TagGroups::new();
    let eggs = context
        .map_table("eggs", None, |table, row| {
            let author = source_text(row, "author")?;
            let created = source_timestamp(row, "created_at");

            let tag = first_tag(source_optional_text(row, "tags")?.as_deref());
            let (nest_id, new) = nest_groups.id(&tag);
            if new {
                nests.push(SourceNest {
                    id: nest_id,
                    uuid: None,
                    author: author.clone(),
                    description: Some(format!(
                        "generated from Pelican egg tag `{tag}` during import"
                    )),
                    name: tag,
                    created,
                });
            }

            Ok(SourceEgg {
                id: source_i64(row, "id")?,
                uuid: source_readable_uuid(row, "uuid"),
                nest_id,
                author,
                name: source_text(row, "name")?,
                description: source_optional_text(row, "description")?,
                features: source_optional_text(row, "features")?,
                docker_images: source_optional_text(row, "docker_images")?,
                file_denylist: source_optional_text(row, "file_denylist")?,
                config_files: source_optional_text(row, "config_files")?,
                config_startup: source_optional_text(row, "config_startup")?,
                config_stop: source_optional_text(row, "config_stop")?,
                config_from: source_optional_i64(row, "config_from")?,
                copy_script_from: source_optional_i64(row, "copy_script_from")?,
                script_container: source_optional_text(row, "script_container")?,
                script_entry: source_optional_text(row, "script_entry")?,
                script_install: source_optional_text(row, "script_install")?,
                startup: if table.has("startup_commands") {
                    SourceEggStartup::Named(source_optional_text(row, "startup_commands")?)
                } else {
                    SourceEggStartup::Single(source_optional_text(row, "startup")?)
                },
                force_outgoing_ip: source_bool(row, "force_outgoing_ip")?,
                created,
            })
        })
        .await?;

    let mut host_nodes: HashMap<i64, Vec<i64>> = HashMap::new();
    if context.has_table("database_host_node").await? {
        for row in &context.table("database_host_node", None).await? {
            host_nodes
                .entry(source_i64(row, "database_host_id")?)
                .or_default()
                .push(source_i64(row, "node_id")?);
        }
    }
    let database_hosts = context
        .map_table("database_hosts", None, |table, row| {
            let id = source_i64(row, "id")?;

            Ok(SourceDatabaseHost {
                id,
                name: source_text(row, "name")?,
                host: source_text(row, "host")?,
                port: source_i64(row, "port")?,
                username: source_text(row, "username")?,
                password: context
                    .decrypt(&source_optional_text(row, "password")?.unwrap_or_default()),
                node_ids: if table.has("node_id") {
                    source_optional_i64(row, "node_id")?.map(|node_id| vec![node_id])
                } else {
                    host_nodes.remove(&id)
                },
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let servers = context
        .map_table("servers", None, |table, row| {
            Ok(SourceServer {
                id: source_i64(row, "id")?,
                uuid: source_readable_uuid(row, "uuid"),
                external_id: source_optional_text(row, "external_id")?,
                node_id: source_i64(row, "node_id")?,
                owner_id: source_i64(row, "owner_id")?,
                egg_id: source_i64(row, "egg_id")?,
                allocation_id: source_optional_i64(row, "allocation_id")?,
                name: source_text(row, "name")?,
                description: source_optional_text(row, "description")?,
                status: source_optional_text(row, "status")?,
                memory: source_i64(row, "memory")?,
                swap: source_i64(row, "swap")?,
                disk: source_i64(row, "disk")?,
                io: source_i64(row, "io")?,
                cpu: source_i64(row, "cpu")?,
                threads: source_optional_text(row, "threads")?,
                startup: source_optional_text(row, "startup")?.unwrap_or_default(),
                image: source_optional_text(row, "image")?.unwrap_or_default(),
                docker_labels: if table.has("docker_labels") {
                    source_optional_text(row, "docker_labels")?
                } else {
                    None
                },
                allocation_limit: source_optional_i64(row, "allocation_limit")?,
                database_limit: source_optional_i64(row, "database_limit")?,
                backup_limit: source_optional_i64(row, "backup_limit")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let host_schemas = backup_hosts.as_ref().map(|(_, schemas)| schemas);
    let backups = context
        .map_table("backups", None, |table, row| {
            let backup_config_id = if table.has("backup_host_id") {
                source_optional_i64(row, "backup_host_id")?
            } else {
                None
            };

            Ok(SourceBackup {
                id: source_i64(row, "id")?,
                uuid: source_readable_uuid(row, "uuid"),
                server_id: source_i64(row, "server_id")?,
                backup_config_id,
                name: source_optional_text(row, "name")?.unwrap_or_default(),
                successful: source_bool(row, "is_successful")?,
                locked: source_bool(row, "is_locked")?,
                ignored_files: source_optional_text(row, "ignored_files")?,
                disk: if table.has("disk") {
                    source_text(row, "disk")?
                } else {
                    backup_config_id
                        .and_then(|id| host_schemas?.get(&id).cloned())
                        .unwrap_or_else(|| "wings".into())
                },
                checksum: source_optional_text(row, "checksum")?,
                bytes: source_optional_i64(row, "bytes")?.unwrap_or(0),
                upload_id: source_optional_text(row, "upload_id")?,
                completed: source_timestamp(row, "completed_at"),
                deleted: if table.has("deleted_at") {
                    source_timestamp(row, "deleted_at")
                } else {
                    None
                },
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let (egg_mounts, node_mounts, server_mounts) = if context.has_table("mountables").await? {
        (
            pterodactyl::read_mount_links(
                context,
                "mountables",
                Some("LOWER(mountable_type) = 'egg'"),
                "mountable_id",
            )
            .await?,
            pterodactyl::read_mount_links(
                context,
                "mountables",
                Some("LOWER(mountable_type) = 'node'"),
                "mountable_id",
            )
            .await?,
            pterodactyl::read_mount_links(
                context,
                "mountables",
                Some("LOWER(mountable_type) = 'server'"),
                "mountable_id",
            )
            .await?,
        )
    } else {
        (
            pterodactyl::read_mount_links(context, "egg_mount", None, "egg_id").await?,
            pterodactyl::read_mount_links(context, "mount_node", None, "node_id").await?,
            pterodactyl::read_mount_links(context, "mount_server", None, "server_id").await?,
        )
    };

    Ok(SourceData {
        settings,
        backup_configs: match backup_hosts {
            Some((configs, _)) if !configs.is_empty() => configs,
            _ => vec![pterodactyl::backup_config_from_env()],
        },
        users,
        ssh_keys: pterodactyl::read_ssh_keys(context).await?,
        locations,
        nodes,
        nests,
        eggs,
        egg_variables: pterodactyl::read_egg_variables(context).await?,
        database_hosts,
        servers,
        databases: pterodactyl::read_databases(context).await?,
        server_variables: pterodactyl::read_server_variables(context).await?,
        backups,
        subusers: pterodactyl::read_subusers(context).await?,
        mounts: pterodactyl::read_mounts(context).await?,
        egg_mounts,
        node_mounts,
        server_mounts,
        schedules: pterodactyl::read_schedules(context).await?,
        tasks: pterodactyl::read_tasks(context).await?,
        allocations: pterodactyl::read_allocations(context).await?,
    })
}
