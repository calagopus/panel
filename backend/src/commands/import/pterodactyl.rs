use super::{
    ImportArgs, SourceContext, model::*, source_bool, source_i64, source_optional_i64,
    source_optional_text, source_readable_uuid, source_text, source_timestamp,
};
use chrono::{DateTime, Utc};
use clap::{Args, FromArgMatches};
use compact_str::{CompactString, ToCompactString};
use shared::models::server_backup::BackupDisk;
use std::collections::{HashMap, HashSet};

#[derive(Args)]
pub struct PterodactylArgs {
    #[arg(
        short = 'e',
        long = "environment",
        help = "the environment variable file location for the pterodactyl panel",
        default_value = "/var/www/pterodactyl/.env",
        value_hint = clap::ValueHint::FilePath
    )]
    environment: String,
    #[command(flatten)]
    import: ImportArgs,
}

pub struct PterodactylCommand;

impl shared::extensions::commands::CliCommand<PterodactylArgs> for PterodactylCommand {
    fn get_command(&self, command: clap::Command) -> clap::Command {
        command
    }

    fn get_executor(self) -> Box<shared::extensions::commands::ExecutorFunc> {
        Box::new(|env, arg_matches| {
            Box::pin(async move {
                let args = PterodactylArgs::from_arg_matches(&arg_matches)?;

                super::run(SourceKind::Pterodactyl, &args.environment, args.import, env).await
            })
        })
    }
}

pub(super) fn backup_config_from_env() -> SourceBackupConfig {
    let disk = match super::source_env::var("APP_BACKUP_DRIVER").as_deref() {
        Some("btrfs") => BackupDisk::Btrfs,
        Some("zfs") => BackupDisk::Zfs,
        Some("s3") => BackupDisk::S3,
        _ => BackupDisk::Local,
    };

    SourceBackupConfig {
        id: 0,
        name: "global".into(),
        disk,
        s3: (disk == BackupDisk::S3).then(|| {
            shared::models::backup_configuration::BackupConfigsS3 {
                region: super::source_env::var("AWS_DEFAULT_REGION")
                    .unwrap_or_default()
                    .into(),
                access_key: super::source_env::var("AWS_ACCESS_KEY_ID")
                    .unwrap_or_default()
                    .into(),
                secret_key: super::source_env::var("AWS_SECRET_ACCESS_KEY")
                    .unwrap_or_default()
                    .into(),
                bucket: super::source_env::var("AWS_BACKUPS_BUCKET")
                    .unwrap_or_default()
                    .into(),
                endpoint: super::source_env::var("AWS_ENDPOINT")
                    .unwrap_or_default()
                    .into(),
                path_style: super::source_env::var("AWS_USE_PATH_STYLE_ENDPOINT")
                    .is_some_and(|v| is_laravel_true(&v)),
                compression_type: wings_api::CompressionType::Gz,
                part_size: super::source_env::var("BACKUP_MAX_PART_SIZE")
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(1024 * 1024 * 1024),
            }
        }),
    }
}

fn is_laravel_true(value: &str) -> bool {
    value.eq_ignore_ascii_case("true") || value.eq_ignore_ascii_case("(true)")
}

/// Pterodactyl 2.x built-in game tags, in the order it resolves an egg's game by.
const BUILT_IN_EGG_TAGS: &[&str] = &[
    "srcds",
    "bedrock",
    "minecraft",
    "rust",
    "garrysmod",
    "fivem",
    "voice",
];

#[derive(Clone)]
struct SourceTag {
    id: i64,
    name: String,
    slug: String,
    legacy_nest_id: Option<i64>,
}

async fn read_egg_tags(
    context: &SourceContext,
) -> Result<HashMap<i64, Vec<SourceTag>>, anyhow::Error> {
    if !context.has_table("tags").await? || !context.has_table("taggables").await? {
        return Ok(HashMap::new());
    }

    let tags: HashMap<i64, SourceTag> = context
        .map_table("tags", None, |_, row| {
            let id = source_i64(row, "id")?;

            Ok((
                id,
                SourceTag {
                    id,
                    name: source_text(row, "name")?,
                    slug: source_text(row, "slug")?,
                    legacy_nest_id: source_optional_i64(row, "legacy_nest_id")?,
                },
            ))
        })
        .await?
        .into_iter()
        .collect();

    let attachments = context
        .map_table("taggables", Some("taggable_type = 'egg'"), |_, row| {
            Ok((source_i64(row, "taggable_id")?, source_i64(row, "tag_id")?))
        })
        .await?;

    let mut egg_tags: HashMap<i64, Vec<SourceTag>> = HashMap::new();
    for (egg_id, tag_id) in attachments {
        if let Some(tag) = tags.get(&tag_id) {
            egg_tags.entry(egg_id).or_default().push(tag.clone());
        }
    }

    Ok(egg_tags)
}

struct TagNests {
    real_ids: HashSet<i64>,
    real_names: HashMap<String, i64>,
    synthesized: HashMap<String, i64>,
    next_id: i64,
    nests: Vec<SourceNest>,
}

impl TagNests {
    fn new(nests: &[SourceNest]) -> Self {
        Self {
            real_ids: nests.iter().map(|nest| nest.id).collect(),
            real_names: nests
                .iter()
                .map(|nest| (nest.name.trim().to_lowercase(), nest.id))
                .collect(),
            synthesized: HashMap::new(),
            next_id: nests.iter().map(|nest| nest.id).max().unwrap_or(0) + 1,
            nests: Vec::new(),
        }
    }

    fn pick_tag<'a>(&self, tags: &'a [SourceTag]) -> Option<&'a SourceTag> {
        tags.iter()
            .find(|tag| {
                tag.legacy_nest_id
                    .is_some_and(|nest_id| self.real_ids.contains(&nest_id))
            })
            .or_else(|| {
                tags.iter()
                    .filter(|tag| !BUILT_IN_EGG_TAGS.contains(&tag.slug.as_str()))
                    .min_by_key(|tag| tag.id)
            })
            .or_else(|| {
                BUILT_IN_EGG_TAGS
                    .iter()
                    .find_map(|slug| tags.iter().find(|tag| tag.slug == *slug))
            })
    }

    fn nest_id(
        &mut self,
        nest_id: Option<i64>,
        tags: Option<&Vec<SourceTag>>,
        author: &str,
        created: Option<DateTime<Utc>>,
    ) -> i64 {
        if let Some(nest_id) = nest_id.filter(|nest_id| self.real_ids.contains(nest_id)) {
            return nest_id;
        }

        let tag = tags.and_then(|tags| self.pick_tag(tags));
        if let Some(nest_id) = tag
            .and_then(|tag| tag.legacy_nest_id)
            .filter(|nest_id| self.real_ids.contains(nest_id))
        {
            return nest_id;
        }

        let (name, description) = match tag {
            Some(tag) => (
                tag.name.trim().to_string(),
                format!(
                    "generated from Pterodactyl egg tag `{}` during import",
                    tag.slug
                ),
            ),
            None => (
                "Pterodactyl".to_string(),
                "generated for untagged Pterodactyl eggs during import".to_string(),
            ),
        };

        let key = name.to_lowercase();
        if let Some(nest_id) = self
            .real_names
            .get(&key)
            .or_else(|| self.synthesized.get(&key))
        {
            return *nest_id;
        }

        let id = self.next_id;
        self.next_id += 1;
        self.synthesized.insert(key, id);
        self.nests.push(SourceNest {
            id,
            uuid: None,
            author: author.to_string(),
            name,
            description: Some(description),
            created,
        });

        id
    }
}

pub(super) async fn read_settings(
    context: &SourceContext,
    app_url: &str,
) -> Result<SourceSettings, anyhow::Error> {
    let mut values: HashMap<String, CompactString> = HashMap::new();
    if context.has_table("settings").await? {
        for row in &context.table("settings", None).await? {
            values.insert(
                source_text(row, "key")?,
                source_optional_text(row, "value")?
                    .unwrap_or_default()
                    .to_compact_string(),
            );
        }
    }

    let mut setting = |key: &str| {
        values
            .remove(&format!("settings::{key}"))
            .filter(|value| !value.is_empty())
    };

    let mail = match (
        setting("mail:mailers:smtp:host"),
        setting("mail:mailers:smtp:port").and_then(|port| port.parse::<u16>().ok()),
        setting("mail:from:address"),
    ) {
        (Some(host), Some(port), Some(from_address)) => Some(SourceMail {
            host,
            port,
            username: setting("mail:mailers:smtp:username"),
            password: setting("mail:mailers:smtp:password")
                .and_then(|password| context.decrypt(&password).ok()),
            start_tls: setting("mail:mailers:smtp:encryption").is_some_and(|e| e == "tls"),
            from_address,
            from_name: setting("mail:from:name"),
        }),
        _ => None,
    };

    Ok(SourceSettings {
        app_url: app_url.into(),
        app_name: setting("app:name"),
        mail,
    })
}

pub(super) async fn read_ssh_keys(
    context: &SourceContext,
) -> Result<Vec<SourceSshKey>, anyhow::Error> {
    context
        .map_table("user_ssh_keys", Some("deleted_at IS NULL"), |_, row| {
            Ok(SourceSshKey {
                id: source_i64(row, "id")?,
                user_id: source_i64(row, "user_id")?,
                name: source_text(row, "name")?,
                public_key: source_text(row, "public_key")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await
}

/// Pelican converted rule strings to lists by splitting on `|`, which also cut regex rules
/// containing an alternation into pieces. Glues such pieces back together.
fn rejoin_split_regex_rules(rules: Vec<CompactString>) -> Vec<CompactString> {
    let is_valid = |rule: &CompactString| {
        rule_validator::validate_rules(std::slice::from_ref(rule), &()).is_ok()
    };

    let mut rejoined = Vec::with_capacity(rules.len());
    let mut index = 0;

    while index < rules.len() {
        let rule = &rules[index];
        index += 1;

        if rule.starts_with("regex:") && !is_valid(rule) {
            let mut candidate = rule.clone();
            let mut repaired = None;
            for (offset, piece) in rules[index..].iter().enumerate() {
                candidate.push('|');
                candidate.push_str(piece);
                if is_valid(&candidate) {
                    repaired = Some((candidate, offset + 1));
                    break;
                }
            }

            if let Some((candidate, consumed)) = repaired {
                rejoined.push(candidate);
                index += consumed;
                continue;
            }
        }

        rejoined.push(rule.clone());
    }

    rejoined
}

pub(super) async fn read_egg_variables(
    context: &SourceContext,
) -> Result<Vec<SourceEggVariable>, anyhow::Error> {
    context
        .map_table("egg_variables", None, |table, row| {
            let rules = source_optional_text(row, "rules")?.unwrap_or_default();
            // Pelican stores a JSON list, Pterodactyl a pipe-separated string
            let rules = serde_json::from_str::<Vec<CompactString>>(&rules)
                .map(rejoin_split_regex_rules)
                .unwrap_or_else(|_| {
                    rejoin_split_regex_rules(rules.split('|').map(CompactString::from).collect())
                });

            Ok(SourceEggVariable {
                id: source_i64(row, "id")?,
                egg_id: source_i64(row, "egg_id")?,
                name: source_text(row, "name")?,
                description: source_optional_text(row, "description")?,
                env_variable: source_text(row, "env_variable")?,
                default_value: source_optional_text(row, "default_value")?,
                user_viewable: source_bool(row, "user_viewable")?,
                user_editable: source_bool(row, "user_editable")?,
                rules,
                order: if table.has("sort") {
                    source_optional_i64(row, "sort")?.unwrap_or(0)
                } else if table.has("sort_order") {
                    source_optional_i64(row, "sort_order")?.unwrap_or(0)
                } else {
                    0
                },
                created: source_timestamp(row, "created_at"),
            })
        })
        .await
}

pub(super) async fn read_databases(
    context: &SourceContext,
) -> Result<Vec<SourceDatabase>, anyhow::Error> {
    context
        .map_table("databases", None, |_, row| {
            Ok(SourceDatabase {
                id: source_i64(row, "id")?,
                server_id: source_i64(row, "server_id")?,
                database_host_id: source_i64(row, "database_host_id")?,
                name: source_text(row, "database")?,
                username: source_text(row, "username")?,
                password: context.decrypt(&source_text(row, "password")?),
                created: source_timestamp(row, "created_at"),
            })
        })
        .await
}

pub(super) async fn read_server_variables(
    context: &SourceContext,
) -> Result<Vec<SourceServerVariable>, anyhow::Error> {
    context
        .map_table("server_variables", None, |_, row| {
            Ok(SourceServerVariable {
                id: source_i64(row, "id")?,
                server_id: source_optional_i64(row, "server_id")?,
                variable_id: source_i64(row, "variable_id")?,
                value: source_optional_text(row, "variable_value")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await
}

pub(super) async fn read_subusers(
    context: &SourceContext,
) -> Result<Vec<SourceSubuser>, anyhow::Error> {
    context
        .map_table("subusers", None, |_, row| {
            Ok(SourceSubuser {
                id: source_i64(row, "id")?,
                user_id: source_i64(row, "user_id")?,
                server_id: source_i64(row, "server_id")?,
                permissions: source_optional_text(row, "permissions")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await
}

pub(super) async fn read_mounts(
    context: &SourceContext,
) -> Result<Vec<SourceMount>, anyhow::Error> {
    context
        .map_table("mounts", None, |_, row| {
            Ok(SourceMount {
                id: source_i64(row, "id")?,
                uuid: source_readable_uuid(row, "uuid"),
                name: source_text(row, "name")?,
                description: source_optional_text(row, "description")?,
                source: source_text(row, "source")?,
                target: source_text(row, "target")?,
                read_only: source_bool(row, "read_only")?,
                user_mountable: source_bool(row, "user_mountable")?,
            })
        })
        .await
}

pub(super) async fn read_mount_links(
    context: &SourceContext,
    table: &str,
    sql_where: Option<&str>,
    target_column: &str,
) -> Result<Vec<SourceMountLink>, anyhow::Error> {
    context
        .map_table(table, sql_where, |_, row| {
            Ok(SourceMountLink {
                mount_id: source_i64(row, "mount_id")?,
                target_id: source_i64(row, target_column)?,
            })
        })
        .await
}

pub(super) async fn read_schedules(
    context: &SourceContext,
) -> Result<Vec<SourceSchedule>, anyhow::Error> {
    let cron = |row: &super::SourceRow, column: &str| -> Result<String, anyhow::Error> {
        Ok(source_optional_text(row, column)?
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "*".into()))
    };

    context
        .map_table("schedules", None, |_, row| {
            Ok(SourceSchedule {
                id: source_i64(row, "id")?,
                server_id: source_i64(row, "server_id")?,
                name: source_optional_text(row, "name")?.unwrap_or_default(),
                enabled: source_bool(row, "is_active")?,
                only_when_online: source_bool(row, "only_when_online")?,
                cron_minute: cron(row, "cron_minute")?,
                cron_hour: cron(row, "cron_hour")?,
                cron_day_of_month: cron(row, "cron_day_of_month")?,
                cron_month: cron(row, "cron_month")?,
                cron_day_of_week: cron(row, "cron_day_of_week")?,
                last_run: source_timestamp(row, "last_run_at"),
                created: source_timestamp(row, "created_at"),
            })
        })
        .await
}

pub(super) async fn read_tasks(context: &SourceContext) -> Result<Vec<SourceTask>, anyhow::Error> {
    context
        .map_table("tasks", None, |_, row| {
            Ok(SourceTask {
                id: source_i64(row, "id")?,
                schedule_id: source_i64(row, "schedule_id")?,
                sequence_id: source_optional_i64(row, "sequence_id")?.unwrap_or(0),
                action: source_text(row, "action")?,
                payload: source_optional_text(row, "payload")?.unwrap_or_default(),
                time_offset: source_optional_i64(row, "time_offset")?.unwrap_or(0),
                continue_on_failure: source_bool(row, "continue_on_failure")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await
}

pub(super) async fn read_allocations(
    context: &SourceContext,
) -> Result<Vec<SourceAllocation>, anyhow::Error> {
    context
        .map_table("allocations", None, |_, row| {
            Ok(SourceAllocation {
                id: source_i64(row, "id")?,
                node_id: source_i64(row, "node_id")?,
                ip: source_text(row, "ip")?,
                ip_alias: source_optional_text(row, "ip_alias")?,
                port: source_i64(row, "port")?,
                server_id: source_optional_i64(row, "server_id")?,
                notes: source_optional_text(row, "notes")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await
}

pub(super) async fn read(
    context: &SourceContext,
    app_url: &str,
) -> Result<SourceData, anyhow::Error> {
    let users = context
        .map_table("users", None, |_, row| {
            Ok(SourceUser {
                id: source_i64(row, "id")?,
                uuid: source_readable_uuid(row, "uuid"),
                external_id: source_optional_text(row, "external_id")?,
                username: source_text(row, "username")?,
                email: source_text(row, "email")?,
                name_first: source_optional_text(row, "name_first")?,
                name_last: source_optional_text(row, "name_last")?,
                password: source_optional_text(row, "password")?.unwrap_or_default(),
                admin: source_bool(row, "root_admin")?,
                totp_enabled: source_bool(row, "use_totp")?,
                totp_secret: source_optional_text(row, "totp_secret")?
                    .filter(|secret| !secret.is_empty())
                    .map(|secret| context.decrypt(&secret)),
                language: None,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let locations = context
        .map_table("locations", None, |_, row| {
            Ok(SourceLocation {
                id: source_i64(row, "id")?,
                name: source_text(row, "short")?,
                description: source_optional_text(row, "long")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let nodes = context
        .map_table("nodes", None, |_, row| {
            Ok(SourceNode {
                id: source_i64(row, "id")?,
                uuid: source_readable_uuid(row, "uuid"),
                location_id: source_i64(row, "location_id")?,
                backup_config_id: None,
                name: source_text(row, "name")?,
                description: source_optional_text(row, "description")?,
                public: source_bool(row, "public")?,
                maintenance_mode: source_bool(row, "maintenance_mode")?,
                scheme: source_text(row, "scheme")?,
                fqdn: source_text(row, "fqdn")?,
                daemon_listen: source_i64(row, "daemonListen")?,
                daemon_connect: None,
                daemon_sftp: source_i64(row, "daemonSFTP")?,
                sftp_alias: None,
                memory: source_i64(row, "memory")?,
                disk: source_i64(row, "disk")?,
                token_id: source_optional_text(row, "daemon_token_id")?.unwrap_or_default(),
                token: context
                    .decrypt(&source_optional_text(row, "daemon_token")?.unwrap_or_default()),
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let mut nests = context
        .map_table("nests", None, |_, row| {
            Ok(SourceNest {
                id: source_i64(row, "id")?,
                uuid: Some(source_readable_uuid(row, "uuid")),
                author: source_text(row, "author")?,
                name: source_text(row, "name")?,
                description: source_optional_text(row, "description")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let egg_tags = read_egg_tags(context).await?;
    let mut tag_nests = TagNests::new(&nests);
    let eggs = context
        .map_table("eggs", None, |_, row| {
            let id = source_i64(row, "id")?;
            let author = source_text(row, "author")?;
            let created = source_timestamp(row, "created_at");

            Ok(SourceEgg {
                id,
                uuid: source_readable_uuid(row, "uuid"),
                nest_id: tag_nests.nest_id(
                    source_optional_i64(row, "nest_id")?,
                    egg_tags.get(&id),
                    &author,
                    created,
                ),
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
                startup: SourceEggStartup::Single(source_optional_text(row, "startup")?),
                force_outgoing_ip: source_bool(row, "force_outgoing_ip")?,
                created,
            })
        })
        .await?;
    nests.append(&mut tag_nests.nests);

    let database_hosts = context
        .map_table("database_hosts", None, |_, row| {
            Ok(SourceDatabaseHost {
                id: source_i64(row, "id")?,
                name: source_text(row, "name")?,
                host: source_text(row, "host")?,
                port: source_i64(row, "port")?,
                username: source_text(row, "username")?,
                password: context.decrypt(&source_text(row, "password")?),
                node_ids: source_optional_i64(row, "node_id")?.map(|node_id| vec![node_id]),
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let servers = context
        .map_table("servers", None, |_, row| {
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
                docker_labels: None,
                allocation_limit: source_optional_i64(row, "allocation_limit")?,
                database_limit: source_optional_i64(row, "database_limit")?,
                backup_limit: source_optional_i64(row, "backup_limit")?,
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    let backups = context
        .map_table("backups", None, |_, row| {
            Ok(SourceBackup {
                id: source_i64(row, "id")?,
                uuid: source_readable_uuid(row, "uuid"),
                server_id: source_i64(row, "server_id")?,
                backup_config_id: None,
                name: source_optional_text(row, "name")?.unwrap_or_default(),
                successful: source_bool(row, "is_successful")?,
                locked: source_bool(row, "is_locked")?,
                ignored_files: source_optional_text(row, "ignored_files")?,
                disk: source_text(row, "disk")?,
                checksum: source_optional_text(row, "checksum")?,
                bytes: source_optional_i64(row, "bytes")?.unwrap_or(0),
                upload_id: source_optional_text(row, "upload_id")?,
                completed: source_timestamp(row, "completed_at"),
                deleted: source_timestamp(row, "deleted_at"),
                created: source_timestamp(row, "created_at"),
            })
        })
        .await?;

    Ok(SourceData {
        settings: read_settings(context, app_url).await?,
        backup_configs: vec![backup_config_from_env()],
        users,
        ssh_keys: read_ssh_keys(context).await?,
        locations,
        nodes,
        nests,
        eggs,
        egg_variables: read_egg_variables(context).await?,
        database_hosts,
        servers,
        databases: read_databases(context).await?,
        server_variables: read_server_variables(context).await?,
        backups,
        subusers: read_subusers(context).await?,
        mounts: read_mounts(context).await?,
        egg_mounts: read_mount_links(context, "egg_mount", None, "egg_id").await?,
        node_mounts: read_mount_links(context, "mount_node", None, "node_id").await?,
        server_mounts: read_mount_links(context, "mount_server", None, "server_id").await?,
        schedules: read_schedules(context).await?,
        tasks: read_tasks(context).await?,
        allocations: read_allocations(context).await?,
    })
}
