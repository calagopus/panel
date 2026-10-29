use super::{
    convert_der_public_key,
    issues::{Decision, Decisions, Findings, Issue, IssueKey, Resolved, RowRef},
    model::*,
};
use base64::Engine;
use compact_str::{CompactString, ToCompactString};
use garde::Validate;
use indexmap::IndexMap;
use shared::models::{
    database_host::DatabaseCredentials,
    location::CreateLocationOptions,
    mount::CreateMountOptions,
    nest::CreateNestOptions,
    nest_egg::{
        CreateNestEggOptions, NestEggConfigScript, NestEggConfigStartup, NestEggConfigStop,
        ProcessConfigurationFile,
    },
    nest_egg_variable::CreateNestEggVariableOptions,
    node::CreateNodeOptions,
    server::ServerStatus,
    server_backup::BackupDisk,
    server_schedule::CreateServerScheduleOptions,
    server_schedule_step::CreateServerScheduleStepOptions,
    user::CreateUserOptions,
};
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    hash::Hash,
    str::FromStr,
};

pub struct Options {
    /// The limit given to servers whose source limit means "unlimited".
    pub unlimited_as: i32,
    pub default_language: CompactString,
    pub languages: Vec<CompactString>,
    pub server_permissions: HashSet<String>,
}

const IN_TARGET: i64 = -1;

struct Uniq<K> {
    seen: HashMap<K, i64>,
}

impl<K: Hash + Eq> Uniq<K> {
    fn new(existing: impl IntoIterator<Item = K>) -> Self {
        Self {
            seen: existing.into_iter().map(|key| (key, IN_TARGET)).collect(),
        }
    }

    fn holder(&self, key: &K) -> Option<i64> {
        self.seen.get(key).copied()
    }

    fn claim(&mut self, key: K, id: i64) {
        self.seen.insert(key, id);
    }
}

fn duplicate_message(what: &str, table: &str, holder: i64) -> String {
    if holder == IN_TARGET {
        format!("{what} already exists in the target database")
    } else {
        format!("{what} is already used by {table} #{holder}")
    }
}

struct Row {
    table: &'static str,
    id: i64,
    label: String,
    dropped: bool,
    skipped: bool,
}

impl Row {
    fn new(table: &'static str, id: i64, label: impl Into<String>) -> Self {
        Self {
            table,
            id,
            label: label.into(),
            dropped: false,
            skipped: false,
        }
    }
}

fn chars(value: &str) -> usize {
    value.chars().count()
}

fn truncate(value: &str, max: usize) -> String {
    value.chars().take(max).collect()
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|value| !value.trim().is_empty())
}

fn numbered(base: &str, max: usize, separator: &str, taken: impl Fn(&str) -> bool) -> String {
    for n in 2u32.. {
        let suffix = match separator {
            "(" => format!(" ({n})"),
            separator => format!("{separator}{n}"),
        };
        let candidate = format!(
            "{}{suffix}",
            truncate(base, max.saturating_sub(chars(&suffix)))
        );
        if !taken(&candidate) {
            return candidate;
        }
    }

    unreachable!()
}

fn sanitize_username(username: &str) -> String {
    let mut sanitized: String = username
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .take(15)
        .collect();
    while chars(&sanitized) < 3 {
        sanitized.push('_');
    }
    sanitized
}

fn garde_errors<T: Validate<Context = ()>>(value: &T) -> Vec<(String, String)> {
    match value.validate() {
        Ok(()) => Vec::new(),
        Err(report) => report
            .iter()
            .map(|(path, error)| (path.to_string(), error.to_string()))
            .collect(),
    }
}

fn parse_string_list(raw: Option<&str>) -> Result<Vec<CompactString>, ()> {
    let Some(raw) = raw.map(str::trim).filter(|raw| !raw.is_empty()) else {
        return Ok(Vec::new());
    };

    match serde_json::from_str::<serde_json::Value>(raw) {
        Ok(serde_json::Value::Null) => Ok(Vec::new()),
        Ok(serde_json::Value::Array(values)) => Ok(values
            .into_iter()
            .filter_map(|value| value.as_str().map(CompactString::from))
            .collect()),
        // PHP encodes a list with gaps in its keys as an object
        Ok(serde_json::Value::Object(values)) => Ok(values
            .into_iter()
            .filter_map(|(_, value)| value.as_str().map(CompactString::from))
            .collect()),
        _ => Err(()),
    }
}

fn parse_string_map(raw: Option<&str>) -> Result<IndexMap<CompactString, CompactString>, ()> {
    let Some(raw) = raw.map(str::trim).filter(|raw| !raw.is_empty()) else {
        return Ok(IndexMap::new());
    };

    match serde_json::from_str::<serde_json::Value>(raw) {
        Ok(serde_json::Value::Null) => Ok(IndexMap::new()),
        Ok(serde_json::Value::Object(values)) => Ok(values
            .into_iter()
            .filter_map(|(key, value)| value.as_str().map(|value| (key.into(), value.into())))
            .collect()),
        Ok(serde_json::Value::Array(values)) => Ok(values
            .into_iter()
            .filter_map(|value| value.as_str().map(|value| (value.into(), value.into())))
            .collect()),
        _ => Err(()),
    }
}

fn is_blank_json(raw: Option<&str>) -> bool {
    raw.map(str::trim)
        .is_none_or(|raw| raw.is_empty() || raw == "null")
}

fn parse_threads(raw: &str) -> Option<Vec<i16>> {
    let mut cpus = Vec::new();

    for part in raw
        .split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
    {
        match part.split_once('-') {
            Some((start, end)) => {
                let start: i16 = start.trim().parse().ok()?;
                let end: i16 = end.trim().parse().ok()?;
                if start > end || end - start > 1024 {
                    return None;
                }
                cpus.extend(start..=end);
            }
            None => cpus.push(part.parse().ok()?),
        }
    }

    cpus.sort_unstable();
    cpus.dedup();

    Some(cpus)
}

fn map_permission(permission: &str) -> Option<&'static [&'static str]> {
    Some(match permission {
        "websocket.connect" | "settings.change-icon" => &[],
        "control.console" => &["control.console", "control.read-console"],
        "control.start" => &["control.start"],
        "control.stop" => &["control.stop"],
        "control.restart" => &["control.restart"],
        "user.create" => &["subusers.create"],
        "user.read" => &["subusers.read"],
        "user.update" => &["subusers.update"],
        "user.delete" => &["subusers.delete"],
        "file.create" => &["files.create"],
        "file.read" => &["files.read"],
        "file.read-content" => &["files.read-content"],
        "file.update" => &["files.update"],
        "file.delete" => &["files.delete"],
        "file.archive" => &["files.archive"],
        "file.sftp" => &["files.sftp"],
        "backup.create" => &["backups.create"],
        "backup.read" => &["backups.read"],
        "backup.download" => &["backups.download"],
        "backup.restore" => &["backups.restore"],
        "backup.delete" => &["backups.delete"],
        "allocation.create" => &["allocations.create"],
        "allocation.read" => &["allocations.read"],
        "allocation.update" => &["allocations.update"],
        "allocation.delete" => &["allocations.delete"],
        "startup.read" => &["startup.read"],
        "startup.update" => &["startup.update"],
        "startup.docker-image" => &["startup.docker-image"],
        "database.create" => &["databases.create"],
        "database.read" => &["databases.read"],
        "database.update" => &["databases.update"],
        "database.view_password" | "database.view-password" => &["databases.read-password"],
        "database.delete" => &["databases.delete"],
        "schedule.create" => &["schedules.create"],
        "schedule.read" => &["schedules.read"],
        "schedule.update" => &["schedules.update"],
        "schedule.delete" => &["schedules.delete"],
        "mount.read" => &["mounts.read"],
        "mount.update" => &["mounts.attach", "mounts.detach"],
        "settings.rename" | "settings.description" => &["settings.rename"],
        "settings.reinstall" => &["settings.install"],
        "activity.read" => &["activity.read"],
        _ => return None,
    })
}

pub struct Validator<'a> {
    source: &'a SourceData,
    target: &'a TargetSnapshot,
    options: &'a Options,
    decisions: &'a Decisions,
    now: chrono::DateTime<chrono::Utc>,
    findings: Findings,
    dropped: HashMap<RowRef, RowRef>,
    plan: Plan,
}

pub fn build_plan(
    source: &SourceData,
    target: &TargetSnapshot,
    options: &Options,
    decisions: &Decisions,
) -> (Plan, Findings) {
    let mut validator = Validator {
        source,
        target,
        options,
        decisions,
        now: chrono::Utc::now(),
        findings: Findings::default(),
        dropped: HashMap::new(),
        plan: Plan::default(),
    };

    validator.run();

    (validator.plan, validator.findings)
}

impl Validator<'_> {
    fn note(&mut self, table: &'static str, note: impl Into<String>) {
        *self.findings.notes.entry((table, note.into())).or_default() += 1;
    }

    /// Reports a problem with a row. Returns `true` when the suggested fix was chosen and has
    /// to be applied by the caller, otherwise the row is dropped from this pass.
    fn problem(
        &mut self,
        row: &mut Row,
        field: &'static str,
        code: &'static str,
        value: &str,
        message: impl Into<String>,
        fix: Option<String>,
    ) -> bool {
        if row.skipped {
            return false;
        }

        let key = IssueKey {
            table: row.table,
            id: row.id,
            field,
            code,
        };
        let decision = self.decisions.get(&key, fix.is_some());
        let issue = Issue {
            key,
            label: row.label.clone(),
            value: value.to_string(),
            message: message.into(),
            fix,
        };

        match decision {
            Some(Decision::Fix) if issue.fix.is_some() => {
                self.findings.resolved.push(Resolved {
                    issue,
                    decision: Decision::Fix,
                });
                return true;
            }
            Some(_) => {
                row.skipped = true;
                self.findings.resolved.push(Resolved {
                    issue,
                    decision: Decision::Skip,
                });
            }
            None => {
                let provisional = self.decisions.provisional && issue.fix.is_some();
                self.findings.pending.push(issue);
                if provisional {
                    return true;
                }
            }
        }

        row.dropped = true;
        self.dropped
            .insert((row.table, row.id), (row.table, row.id));

        false
    }

    /// Resolves a reference to a parent row, dropping `row` when the parent is not imported.
    fn parent(
        &mut self,
        row: &mut Row,
        field: &'static str,
        parent_table: &'static str,
        parent_id: i64,
        map: &IdMap,
    ) -> Option<uuid::Uuid> {
        if let Some(uuid) = map.get(&parent_id) {
            return Some(*uuid);
        }

        if let Some(root) = self.dropped.get(&(parent_table, parent_id)).copied() {
            if !row.dropped {
                *self
                    .findings
                    .cascades
                    .entry(root)
                    .or_default()
                    .entry(row.table)
                    .or_default() += 1;
                self.dropped.insert((row.table, row.id), root);
            }
            row.dropped = true;
            row.skipped = true;
            return None;
        }

        self.problem(
            row,
            field,
            "dangling",
            &parent_id.to_string(),
            format!("references {parent_table} #{parent_id}, which does not exist in the source database"),
            None,
        );

        None
    }

    fn readable<T: Clone>(
        &mut self,
        row: &mut Row,
        field: &'static str,
        value: &Readable<T>,
    ) -> Option<T> {
        match value {
            Ok(value) => Some(value.clone()),
            Err(unreadable) => {
                self.problem(
                    row,
                    field,
                    "unreadable",
                    &unreadable.value,
                    unreadable.reason.clone(),
                    None,
                );
                None
            }
        }
    }

    fn optional_text(
        &mut self,
        row: &mut Row,
        field: &'static str,
        value: Option<String>,
        max: usize,
    ) -> Option<String> {
        let value = non_empty(value)?;
        if chars(&value) <= max {
            return Some(value);
        }

        let shortened = truncate(&value, max);
        if self.problem(
            row,
            field,
            "length",
            &value,
            format!("is {} characters long, the maximum is {max}", chars(&value)),
            Some(format!("truncate to {max} characters")),
        ) {
            Some(shortened)
        } else {
            Some(value)
        }
    }

    fn text(
        &mut self,
        row: &mut Row,
        field: &'static str,
        value: String,
        min: usize,
        max: usize,
        fallback: Option<String>,
    ) -> String {
        let length = chars(&value);

        if length > max {
            if self.problem(
                row,
                field,
                "length",
                &value,
                format!("is {length} characters long, the maximum is {max}"),
                Some(format!("truncate to {max} characters")),
            ) {
                return truncate(&value, max);
            }
        } else if length < min {
            let fix = fallback
                .as_ref()
                .map(|fallback| format!("use {fallback:?}"));
            if self.problem(
                row,
                field,
                "length",
                &value,
                format!("is {length} characters long, the minimum is {min}"),
                fix,
            ) && let Some(fallback) = fallback
            {
                return fallback;
            }
        }

        value
    }

    /// Renames a duplicate name, avoiding every name in `reserved` so the suggestion cannot
    /// take a name another source row already has.
    #[allow(clippy::too_many_arguments)]
    fn unique_name<K: Hash + Eq>(
        &mut self,
        row: &mut Row,
        field: &'static str,
        name: String,
        max: usize,
        uniq: &Uniq<K>,
        reserved: &HashSet<&str>,
        key: impl Fn(&str) -> K,
    ) -> String {
        let Some(holder) = uniq.holder(&key(&name)) else {
            return name;
        };

        let renamed = numbered(&name, max, "(", |candidate| {
            reserved.contains(candidate) || uniq.holder(&key(candidate)).is_some()
        });
        if self.problem(
            row,
            field,
            "duplicate",
            &name,
            duplicate_message("this name", row.table, holder),
            Some(format!("rename to {renamed:?}")),
        ) {
            renamed
        } else {
            name
        }
    }

    fn backstop<T: Validate<Context = ()>>(
        &mut self,
        row: &mut Row,
        fields: &[(&'static str, &str)],
        value: &T,
    ) {
        if row.dropped {
            return;
        }

        for (path, message) in garde_errors(value) {
            let (field, value) = fields
                .iter()
                .copied()
                .find(|(field, _)| {
                    path == *field
                        || path.starts_with(&format!("{field}."))
                        || path.starts_with(&format!("{field}["))
                })
                .unwrap_or(("row", path.as_str()));
            self.problem(row, field, "rule", value, message, None);
        }
    }

    fn run(&mut self) {
        let backup_configs = self.backup_configs();
        let default_backup_config = self.plan.backup_configs.first().map(|config| config.uuid);

        let users = self.users();
        self.ssh_keys(&users);
        let locations = self.locations(default_backup_config);
        let nodes = self.nodes(&locations, &backup_configs);
        let nests = self.nests();
        let eggs = self.eggs(&nests);
        let egg_variables = self.egg_variables(&eggs);
        let database_hosts = self.database_hosts(&nodes);
        let servers = self.servers(&users, &nodes, &eggs);
        self.databases(&servers, &database_hosts);
        self.server_variables(&servers, &egg_variables);
        self.backups(&servers, &backup_configs, default_backup_config);
        self.subusers(&users, &servers);
        let mounts = self.mounts();
        self.mount_links(&mounts, &eggs, &nodes, &servers);
        let schedules = self.schedules(&servers);
        self.tasks(&schedules);
        self.allocations(&nodes, &servers);
    }

    fn backup_configs(&mut self) -> IdMap {
        let source = self.source;
        let mut names: HashSet<String> = self
            .target
            .backup_configuration_names
            .iter()
            .cloned()
            .collect();
        let mut map = IdMap::new();

        for config in &source.backup_configs {
            let name = truncate(&config.name, 255);
            let name = if names.contains(&name) {
                numbered(&name, 255, "(", |candidate| names.contains(candidate))
            } else {
                name
            };
            names.insert(name.clone());

            let mut s3 = config.s3.clone();
            if let Some(s3) = &mut s3 {
                if s3.endpoint.is_empty() {
                    s3.endpoint =
                        compact_str::format_compact!("https://s3.{}.amazonaws.com", s3.region);
                }
                if s3.validate().is_err() {
                    self.note(
                        "backup_configurations",
                        "the S3 settings are incomplete, review the backup configuration after the import",
                    );
                }
            }

            let uuid = uuid::Uuid::new_v4();
            map.insert(config.id, uuid);
            self.plan.backup_configs.push(PlanBackupConfig {
                uuid,
                name,
                disk: config.disk,
                s3,
            });
        }

        map
    }

    fn users(&mut self) -> IdMap {
        let source = self.source;
        let mut map = IdMap::new();
        let mut uuids = Uniq::new(self.target.user_uuids.iter().copied());
        let mut usernames = Uniq::new(self.target.usernames.iter().map(|u| u.to_lowercase()));
        let mut emails = Uniq::new(self.target.emails.iter().map(|e| e.to_lowercase()));
        let mut external_ids = Uniq::new(self.target.user_external_ids.iter().cloned());

        let reserved: HashSet<String> = source
            .users
            .iter()
            .map(|user| user.username.trim().to_lowercase())
            .collect();

        for user in &source.users {
            let mut row = Row::new("users", user.id, user.email.as_str());

            let uuid = self.readable(&mut row, "uuid", &user.uuid);
            if let Some(uuid) = uuid
                && let Some(holder) = uuids.holder(&uuid)
            {
                self.problem(
                    &mut row,
                    "uuid",
                    "duplicate",
                    &uuid.to_string(),
                    duplicate_message("this uuid", "users", holder),
                    None,
                );
            }

            let mut external_id =
                self.optional_text(&mut row, "external_id", user.external_id.clone(), 255);
            if let Some(id) = &external_id
                && let Some(holder) = external_ids.holder(id)
                && self.problem(
                    &mut row,
                    "external_id",
                    "duplicate",
                    id,
                    duplicate_message("this external id", "users", holder),
                    Some("clear the external id".into()),
                )
            {
                external_id = None;
            }

            let mut username = user.username.trim().to_string();
            let length = chars(&username);
            let pattern_ok = username
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_');
            let taken = |candidate: &str| {
                let candidate = candidate.to_lowercase();
                reserved.contains(&candidate) || usernames.holder(&candidate).is_some()
            };
            if !(3..=15).contains(&length) || !pattern_ok {
                let mut suggestion = sanitize_username(&username);
                if taken(&suggestion) {
                    suggestion = numbered(&suggestion, 15, "_", taken);
                }
                if self.problem(
                    &mut row,
                    "username",
                    "rule",
                    &username,
                    "usernames must be 3-15 characters of a-z, A-Z, 0-9 and _",
                    Some(format!("rename to {suggestion:?}")),
                ) {
                    username = suggestion;
                }
            } else if let Some(holder) = usernames.holder(&username.to_lowercase()) {
                let suggestion = numbered(&username, 15, "_", taken);
                if self.problem(
                    &mut row,
                    "username",
                    "duplicate",
                    &username,
                    duplicate_message("this username", "users", holder),
                    Some(format!("rename to {suggestion:?}")),
                ) {
                    username = suggestion;
                }
            }

            let email = user.email.trim().to_string();
            if let Some(holder) = emails.holder(&email.to_lowercase()) {
                self.problem(
                    &mut row,
                    "email",
                    "duplicate",
                    &email,
                    duplicate_message("this email", "users", holder),
                    None,
                );
            }

            let name_first =
                self.optional_text(&mut row, "name_first", user.name_first.clone(), 255);
            let name_last = self.optional_text(&mut row, "name_last", user.name_last.clone(), 255);

            let mut totp_enabled = user.totp_enabled;
            let mut totp_secret = None;
            if totp_enabled {
                match &user.totp_secret {
                    Some(Ok(secret)) => totp_secret = Some(secret.clone()),
                    Some(Err(unreadable)) => {
                        if self.problem(
                            &mut row,
                            "totp_secret",
                            "unreadable",
                            &unreadable.value,
                            unreadable.reason.clone(),
                            Some("disable two-factor authentication for this user".into()),
                        ) {
                            totp_enabled = false;
                        }
                    }
                    None => {
                        totp_enabled = false;
                        self.note("users", "two-factor authentication was enabled without a secret and has been turned off");
                    }
                }
            }

            let language = match user.language.as_deref() {
                Some(language) if self.options.languages.iter().any(|l| l == language) => {
                    language.to_string()
                }
                Some(_) => {
                    self.note(
                        "users",
                        format!(
                            "languages the panel does not ship were replaced with {:?}",
                            self.options.default_language
                        ),
                    );
                    self.options.default_language.to_string()
                }
                None => self.options.default_language.to_string(),
            };

            self.backstop(
                &mut row,
                &[
                    ("external_id", external_id.as_deref().unwrap_or_default()),
                    ("username", &username),
                    ("email", &email),
                    ("name_first", name_first.as_deref().unwrap_or_default()),
                    ("name_last", name_last.as_deref().unwrap_or_default()),
                ],
                &CreateUserOptions {
                    role_uuid: None,
                    external_id: external_id.as_deref().map(Into::into),
                    username: username.as_str().into(),
                    email: email.as_str().into(),
                    name_first: name_first.as_deref().map(Into::into),
                    name_last: name_last.as_deref().map(Into::into),
                    password: None,
                    admin: user.admin,
                    frozen: false,
                    suspended: false,
                    verify_email: false,
                    send_email: false,
                    language: language.as_str().into(),
                },
            );

            let Some(uuid) = uuid.filter(|_| !row.dropped) else {
                continue;
            };

            uuids.claim(uuid, user.id);
            usernames.claim(username.to_lowercase(), user.id);
            emails.claim(email.to_lowercase(), user.id);
            if let Some(external_id) = &external_id {
                external_ids.claim(external_id.clone(), user.id);
            }
            map.insert(user.id, uuid);

            self.plan.users.push(PlanUser {
                source_id: user.id,
                uuid,
                external_id,
                username,
                email,
                name_first,
                name_last,
                password: Some(user.password.replacen("$2y$", "$2a$", 1))
                    .filter(|password| !password.is_empty()),
                admin: user.admin,
                totp_enabled,
                totp_secret,
                language,
                created: user.created.unwrap_or(self.now),
            });
        }

        map
    }

    fn ssh_keys(&mut self, users: &IdMap) {
        let source = self.source;
        let mut names: Uniq<(uuid::Uuid, String)> = Uniq::new([]);
        let mut fingerprints: HashSet<(uuid::Uuid, String)> = HashSet::new();

        let reserved: HashSet<&str> = source.ssh_keys.iter().map(|row| row.name.trim()).collect();

        for key in &source.ssh_keys {
            let mut row = Row::new("user_ssh_keys", key.id, key.name.as_str());

            let user_uuid = self.parent(&mut row, "user_id", "users", key.user_id, users);

            let der = key
                .public_key
                .lines()
                .filter(|line| !line.starts_with("-----"))
                .collect::<String>();
            let public_key = super::BASE64_ENGINE
                .decode(der.trim())
                .map_err(anyhow::Error::from)
                .and_then(|der| convert_der_public_key(&der));
            let public_key = match public_key {
                Ok(public_key) => Some(public_key),
                Err(err) => {
                    self.problem(
                        &mut row,
                        "public_key",
                        "unreadable",
                        &key.public_key,
                        format!("not a supported public key: {err}"),
                        None,
                    );
                    None
                }
            };

            let (Some(user_uuid), Some(public_key)) = (user_uuid, public_key) else {
                continue;
            };

            let fingerprint = public_key
                .fingerprint(russh::keys::HashAlg::Sha256)
                .to_string();
            if fingerprints.contains(&(user_uuid, fingerprint.clone())) {
                self.note(
                    "user_ssh_keys",
                    "keys a user had added more than once were imported once",
                );
                continue;
            }

            let name = key.name.trim().to_string();
            let fallback = format!("key {name}");
            let name = self.text(
                &mut row,
                "name",
                name,
                3,
                31,
                Some(truncate(fallback.trim(), 31)),
            );
            let name = self.unique_name(&mut row, "name", name, 31, &names, &reserved, |name| {
                (user_uuid, name.to_string())
            });

            let public_key = match public_key.to_bytes() {
                Ok(bytes) => bytes,
                Err(err) => {
                    self.problem(
                        &mut row,
                        "public_key",
                        "unreadable",
                        &key.public_key,
                        err.to_string(),
                        None,
                    );
                    continue;
                }
            };

            if row.dropped {
                continue;
            }

            names.claim((user_uuid, name.clone()), key.id);
            fingerprints.insert((user_uuid, fingerprint.clone()));

            self.plan.ssh_keys.push(PlanSshKey {
                source_id: key.id,
                user_uuid,
                name,
                fingerprint,
                public_key,
                created: key.created.unwrap_or(self.now),
            });
        }
    }

    fn locations(&mut self, backup_configuration_uuid: Option<uuid::Uuid>) -> IdMap {
        let source = self.source;
        let mut map = IdMap::new();
        let mut names = Uniq::new(self.target.location_names.iter().cloned());

        let reserved: HashSet<&str> = source.locations.iter().map(|row| row.name.trim()).collect();

        for location in &source.locations {
            let mut row = Row::new("locations", location.id, location.name.as_str());

            let name = self.text(
                &mut row,
                "name",
                location.name.trim().to_string(),
                1,
                255,
                Some(format!("location {}", location.id)),
            );
            let name = self.unique_name(
                &mut row,
                "name",
                name,
                255,
                &names,
                &reserved,
                str::to_string,
            );
            let description =
                self.optional_text(&mut row, "description", location.description.clone(), 1024);

            self.backstop(
                &mut row,
                &[
                    ("name", &name),
                    ("description", description.as_deref().unwrap_or_default()),
                ],
                &CreateLocationOptions {
                    backup_configuration_uuid,
                    name: name.as_str().into(),
                    description: description.as_deref().map(Into::into),
                    flag: None,
                },
            );

            if row.dropped {
                continue;
            }

            let uuid = uuid::Uuid::new_v4();
            names.claim(name.clone(), location.id);
            map.insert(location.id, uuid);

            self.plan.locations.push(PlanLocation {
                source_id: location.id,
                uuid,
                backup_configuration_uuid,
                name,
                description,
                created: location.created.unwrap_or(self.now),
            });
        }

        map
    }

    fn nodes(&mut self, locations: &IdMap, backup_configs: &IdMap) -> IdMap {
        let source = self.source;
        let mut map = IdMap::new();
        let mut uuids = Uniq::new(self.target.node_uuids.iter().copied());
        let mut names = Uniq::new(self.target.node_names.iter().cloned());
        let mut token_ids = Uniq::new(self.target.node_token_ids.iter().cloned());

        let reserved: HashSet<&str> = source.nodes.iter().map(|row| row.name.trim()).collect();

        for node in &source.nodes {
            let mut row = Row::new("nodes", node.id, node.name.as_str());

            let uuid = self.readable(&mut row, "uuid", &node.uuid);
            if let Some(uuid) = uuid
                && let Some(holder) = uuids.holder(&uuid)
            {
                self.problem(
                    &mut row,
                    "uuid",
                    "duplicate",
                    &uuid.to_string(),
                    duplicate_message("this uuid", "nodes", holder),
                    None,
                );
            }

            let location_uuid = self.parent(
                &mut row,
                "location_id",
                "locations",
                node.location_id,
                locations,
            );

            let name = self.text(
                &mut row,
                "name",
                node.name.trim().to_string(),
                1,
                255,
                Some(format!("node {}", node.id)),
            );
            let name = self.unique_name(
                &mut row,
                "name",
                name,
                255,
                &names,
                &reserved,
                str::to_string,
            );
            let description =
                self.optional_text(&mut row, "description", node.description.clone(), 1024);

            let scheme = node.scheme.trim().to_ascii_lowercase();
            let raw_url = format!("{}://{}:{}", scheme, node.fqdn.trim(), node.daemon_listen);
            let url = match reqwest::Url::parse(&raw_url) {
                Ok(url) if matches!(scheme.as_str(), "http" | "https") && url.host().is_some() => {
                    url.to_string()
                }
                _ => {
                    self.problem(
                        &mut row,
                        "fqdn",
                        "rule",
                        &raw_url,
                        "scheme, fqdn and daemon port do not form a valid http(s) url",
                        None,
                    );
                    raw_url
                }
            };
            let public_url = node
                .daemon_connect
                .filter(|port| *port != node.daemon_listen && (1..=65535).contains(port))
                .and_then(|port| {
                    reqwest::Url::parse(&format!("{}://{}:{}", scheme, node.fqdn.trim(), port)).ok()
                })
                .map(|url| url.to_string());

            let sftp_port = match u16::try_from(node.daemon_sftp) {
                Ok(port) if port > 0 => port,
                _ => {
                    self.problem(
                        &mut row,
                        "daemon_sftp",
                        "range",
                        &node.daemon_sftp.to_string(),
                        "the sftp port must be between 1 and 65535",
                        None,
                    );
                    0
                }
            };

            let sftp_host = match non_empty(node.sftp_alias.clone()) {
                Some(alias) if (3..=255).contains(&chars(&alias)) => Some(alias),
                Some(_) => {
                    self.note(
                        "nodes",
                        "sftp aliases that are not 3-255 characters long were dropped",
                    );
                    None
                }
                None => None,
            };

            let mut token_id = node.token_id.trim().to_string();
            let mut token = match &node.token {
                Ok(token) => Some(token.clone()),
                Err(_) => None,
            };
            let regenerate = Some(
                "generate new credentials, wings on this node must be reconfigured".to_string(),
            );
            let credentials_problem = if let Err(unreadable) = &node.token {
                Some((
                    "daemon_token",
                    "unreadable",
                    unreadable.value.clone(),
                    unreadable.reason.clone(),
                ))
            } else if token.as_ref().is_some_and(|token| token.is_empty()) {
                Some((
                    "daemon_token",
                    "rule",
                    String::new(),
                    "the token is empty".to_string(),
                ))
            } else if chars(&token_id) != 16 || !token_id.is_ascii() {
                Some((
                    "daemon_token_id",
                    "length",
                    token_id.clone(),
                    "the token id must be exactly 16 ASCII characters".to_string(),
                ))
            } else {
                token_ids.holder(&token_id).map(|holder| {
                    (
                        "daemon_token_id",
                        "duplicate",
                        token_id.clone(),
                        duplicate_message("this token id", "nodes", holder),
                    )
                })
            };
            if let Some((field, code, value, message)) = credentials_problem
                && self.problem(&mut row, field, code, &value, message, regenerate)
            {
                use rand::distr::SampleString;

                token_id = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 16);
                token = Some(
                    rand::distr::Alphanumeric
                        .sample_string(&mut rand::rng(), 64)
                        .into(),
                );
            }

            if node.memory < 0 || node.disk < 0 {
                self.note(
                    "nodes",
                    "negative memory or disk capacities were replaced with 0",
                );
            }
            let memory = node.memory.max(0);
            let disk = node.disk.max(0);

            if let Some(location_uuid) = location_uuid {
                self.backstop(
                    &mut row,
                    &[
                        ("name", &name),
                        ("description", description.as_deref().unwrap_or_default()),
                        ("url", &url),
                        ("public_url", public_url.as_deref().unwrap_or_default()),
                        ("sftp_host", sftp_host.as_deref().unwrap_or_default()),
                    ],
                    &CreateNodeOptions {
                        location_uuid,
                        backup_configuration_uuid: None,
                        name: name.as_str().into(),
                        description: description.as_deref().map(Into::into),
                        deployment_enabled: node.public,
                        maintenance_enabled: node.maintenance_mode,
                        public_url: public_url.as_deref().map(Into::into),
                        url: url.as_str().into(),
                        sftp_host: sftp_host.as_deref().map(Into::into),
                        sftp_port: sftp_port.max(1),
                        memory,
                        disk,
                    },
                );
            }

            let (Some(uuid), Some(location_uuid), Some(token)) = (uuid, location_uuid, token)
            else {
                continue;
            };
            if row.dropped {
                continue;
            }

            uuids.claim(uuid, node.id);
            names.claim(name.clone(), node.id);
            token_ids.claim(token_id.clone(), node.id);
            map.insert(node.id, uuid);

            self.plan.nodes.push(PlanNode {
                source_id: node.id,
                uuid,
                location_uuid,
                backup_configuration_uuid: node
                    .backup_config_id
                    .and_then(|id| backup_configs.get(&id).copied()),
                name,
                description,
                deployment_enabled: node.public,
                maintenance_enabled: node.maintenance_mode,
                url,
                public_url,
                sftp_host,
                sftp_port: sftp_port as i32,
                memory,
                disk,
                token_id,
                token,
                created: node.created.unwrap_or(self.now),
            });
        }

        map
    }

    fn nests(&mut self) -> IdMap {
        let source = self.source;
        let mut map = IdMap::new();
        let mut uuids = Uniq::new(self.target.nest_uuids.iter().copied());
        let mut names = Uniq::new(self.target.nest_names.iter().cloned());

        let reserved: HashSet<&str> = source.nests.iter().map(|row| row.name.trim()).collect();

        for nest in &source.nests {
            let mut row = Row::new("nests", nest.id, nest.name.as_str());

            let uuid = match &nest.uuid {
                Some(uuid) => self.readable(&mut row, "uuid", uuid),
                None => Some(uuid::Uuid::new_v4()),
            };
            if let Some(uuid) = uuid
                && let Some(holder) = uuids.holder(&uuid)
            {
                self.problem(
                    &mut row,
                    "uuid",
                    "duplicate",
                    &uuid.to_string(),
                    duplicate_message("this uuid", "nests", holder),
                    None,
                );
            }

            let author = self.text(
                &mut row,
                "author",
                nest.author.trim().to_string(),
                2,
                255,
                Some("unknown".into()),
            );
            let name = self.text(
                &mut row,
                "name",
                nest.name.trim().to_string(),
                1,
                255,
                Some(format!("nest {}", nest.id)),
            );
            let name = self.unique_name(
                &mut row,
                "name",
                name,
                255,
                &names,
                &reserved,
                str::to_string,
            );
            let description =
                self.optional_text(&mut row, "description", nest.description.clone(), 1024);

            self.backstop(
                &mut row,
                &[
                    ("author", &author),
                    ("name", &name),
                    ("description", description.as_deref().unwrap_or_default()),
                ],
                &CreateNestOptions {
                    author: author.as_str().into(),
                    name: name.as_str().into(),
                    description: description.as_deref().map(Into::into),
                },
            );

            let Some(uuid) = uuid.filter(|_| !row.dropped) else {
                continue;
            };

            uuids.claim(uuid, nest.id);
            names.claim(name.clone(), nest.id);
            map.insert(nest.id, uuid);

            self.plan.nests.push(PlanNest {
                source_id: nest.id,
                uuid,
                author,
                name,
                description,
                created: nest.created.unwrap_or(self.now),
            });
        }

        map
    }

    fn eggs(&mut self, nests: &IdMap) -> IdMap {
        let source = self.source;
        let by_id: HashMap<i64, &SourceEgg> = source.eggs.iter().map(|egg| (egg.id, egg)).collect();
        let mut map = IdMap::new();
        let mut uuids = Uniq::new(self.target.egg_uuids.iter().copied());
        let mut names: Uniq<(uuid::Uuid, String)> = Uniq::new([]);

        let reserved: HashSet<&str> = source.eggs.iter().map(|row| row.name.trim()).collect();

        for egg in &source.eggs {
            let mut row = Row::new("eggs", egg.id, egg.name.as_str());

            let uuid = self.readable(&mut row, "uuid", &egg.uuid);
            if let Some(uuid) = uuid
                && let Some(holder) = uuids.holder(&uuid)
            {
                self.problem(
                    &mut row,
                    "uuid",
                    "duplicate",
                    &uuid.to_string(),
                    duplicate_message("this uuid", "eggs", holder),
                    None,
                );
            }

            let nest_uuid = self.parent(&mut row, "nest_id", "nests", egg.nest_id, nests);

            let author = self.text(
                &mut row,
                "author",
                egg.author.trim().to_string(),
                2,
                255,
                Some("unknown".into()),
            );
            let name = self.text(
                &mut row,
                "name",
                egg.name.trim().to_string(),
                1,
                255,
                Some(format!("egg {}", egg.id)),
            );
            let name = match nest_uuid {
                Some(nest_uuid) => {
                    self.unique_name(&mut row, "name", name, 255, &names, &reserved, |name| {
                        (nest_uuid, name.to_string())
                    })
                }
                None => name,
            };
            let description =
                self.optional_text(&mut row, "description", egg.description.clone(), 1024);

            let config_parent = egg.config_from.and_then(|id| by_id.get(&id).copied());
            let script_parent = egg.copy_script_from.and_then(|id| by_id.get(&id).copied());
            let inherited =
                |own: &Option<String>, parent: Option<&Option<String>>| -> Option<String> {
                    if is_blank_json(own.as_deref()) {
                        parent.cloned().flatten().or_else(|| own.clone())
                    } else {
                        own.clone()
                    }
                };

            let features = inherited(&egg.features, config_parent.map(|parent| &parent.features));
            let features = parse_string_list(features.as_deref()).unwrap_or_else(|()| {
                self.note("eggs", "unreadable feature lists were imported empty");
                Vec::new()
            });
            let file_denylist = inherited(
                &egg.file_denylist,
                config_parent.map(|parent| &parent.file_denylist),
            );
            let file_denylist = parse_string_list(file_denylist.as_deref()).unwrap_or_else(|()| {
                self.note("eggs", "unreadable file denylists were imported empty");
                Vec::new()
            });

            let mut docker_images = match parse_string_map(egg.docker_images.as_deref()) {
                Ok(images) => images,
                Err(()) => {
                    self.problem(
                        &mut row,
                        "docker_images",
                        "unreadable",
                        egg.docker_images.as_deref().unwrap_or_default(),
                        "not a JSON object or list of docker images",
                        Some("import the egg without docker images".into()),
                    );
                    IndexMap::new()
                }
            };
            let mut seen_images = HashSet::new();
            let image_count = docker_images.len();
            docker_images.retain(|_, image| seen_images.insert(image.clone()));
            if docker_images.len() != image_count {
                self.note(
                    "eggs",
                    "docker images listed twice under different names were imported once",
                );
            }

            let mut startup_commands = match &egg.startup {
                SourceEggStartup::Single(startup) => IndexMap::from([(
                    "Default".into(),
                    startup.as_deref().unwrap_or_default().into(),
                )]),
                SourceEggStartup::Named(raw) => {
                    parse_string_map(raw.as_deref()).unwrap_or_default()
                }
            };
            let mut seen_commands = HashSet::new();
            startup_commands
                .retain(|_, command: &mut CompactString| seen_commands.insert(command.clone()));
            if startup_commands.is_empty() {
                self.note(
                    "eggs",
                    "eggs without a startup command were given an empty default command",
                );
                startup_commands.insert("Default".into(), "".into());
            }

            let config_files_raw = inherited(
                &egg.config_files,
                config_parent.map(|parent| &parent.config_files),
            );
            let config_files: Vec<ProcessConfigurationFile> =
                if is_blank_json(config_files_raw.as_deref()) {
                    Vec::new()
                } else {
                    let parsed = serde_json::from_str::<serde_json::Value>(
                        config_files_raw.as_deref().unwrap_or_default(),
                    )
                    .map_err(|err| err.to_string())
                    .and_then(|value| {
                        shared::deserialize::deserialize_nest_egg_config_files(value)
                            .map_err(|err| err.to_string())
                    });
                    match parsed {
                        Ok(files) => files
                            .into_iter()
                            .map(|(file, config)| ProcessConfigurationFile {
                                file,
                                create_new: config.create_new,
                                parser: config.parser,
                                replace: config.replace,
                            })
                            .collect(),
                        Err(err) => {
                            self.problem(
                                &mut row,
                                "config_files",
                                "unreadable",
                                config_files_raw.as_deref().unwrap_or_default(),
                                format!(
                                    "the configuration file definitions cannot be parsed: {err}"
                                ),
                                Some(
                                    "import the egg without configuration file definitions".into(),
                                ),
                            );
                            Vec::new()
                        }
                    }
                };

            let config_startup_raw = inherited(
                &egg.config_startup,
                config_parent.map(|parent| &parent.config_startup),
            );
            let mut config_startup: NestEggConfigStartup =
                if is_blank_json(config_startup_raw.as_deref()) {
                    NestEggConfigStartup::default()
                } else {
                    match serde_json::from_str(config_startup_raw.as_deref().unwrap_or_default()) {
                        Ok(config) => config,
                        Err(err) => {
                            self.problem(
                                &mut row,
                                "config_startup",
                                "unreadable",
                                config_startup_raw.as_deref().unwrap_or_default(),
                                format!("the startup detection cannot be parsed: {err}"),
                                Some("import the egg without startup detection".into()),
                            );
                            NestEggConfigStartup::default()
                        }
                    }
                };
            if config_startup.done.is_empty() {
                config_startup.done.push("".into());
            }

            let config_stop_raw = non_empty(inherited(
                &egg.config_stop,
                config_parent.map(|parent| &parent.config_stop),
            ));
            let config_stop = config_stop_raw
                .as_deref()
                .and_then(|raw| serde_json::from_str::<NestEggConfigStop>(raw).ok())
                .unwrap_or_else(|| match config_stop_raw.as_deref() {
                    Some("^C") => NestEggConfigStop {
                        r#type: "signal".into(),
                        value: Some("SIGINT".into()),
                    },
                    Some("^^C") => NestEggConfigStop {
                        r#type: "signal".into(),
                        value: Some("SIGKILL".into()),
                    },
                    other => NestEggConfigStop {
                        r#type: "command".into(),
                        value: other.map(Into::into),
                    },
                });

            let script = |own: &Option<String>, pick: fn(&SourceEgg) -> &Option<String>| {
                non_empty(own.clone())
                    .or_else(|| script_parent.and_then(|parent| non_empty(pick(parent).clone())))
            };
            let config_script = NestEggConfigScript {
                container: script(&egg.script_container, |egg| &egg.script_container)
                    .unwrap_or_else(|| "alpine:3.4".into())
                    .into(),
                entrypoint: script(&egg.script_entry, |egg| &egg.script_entry)
                    .unwrap_or_else(|| "ash".into())
                    .into(),
                content: script(&egg.script_install, |egg| &egg.script_install).unwrap_or_default(),
            };

            let (Some(uuid), Some(nest_uuid)) = (uuid, nest_uuid) else {
                continue;
            };

            let options = CreateNestEggOptions {
                nest_uuid,
                egg_repository_egg_uuid: None,
                egg_repository_egg_hash: None,
                author: author.as_str().into(),
                name: name.as_str().into(),
                description: description.as_deref().map(Into::into),
                config_files,
                config_startup,
                config_stop,
                config_script,
                startup_commands,
                force_outgoing_ip: egg.force_outgoing_ip,
                separate_port: false,
                features,
                docker_images,
                file_denylist,
            };
            self.backstop(
                &mut row,
                &[
                    ("author", &author),
                    ("name", &name),
                    ("description", description.as_deref().unwrap_or_default()),
                    ("startup_commands", ""),
                    (
                        "docker_images",
                        egg.docker_images.as_deref().unwrap_or_default(),
                    ),
                ],
                &options,
            );

            if row.dropped {
                continue;
            }

            uuids.claim(uuid, egg.id);
            names.claim((nest_uuid, name.clone()), egg.id);
            map.insert(egg.id, uuid);

            self.plan.eggs.push(PlanEgg {
                source_id: egg.id,
                uuid,
                nest_uuid,
                author,
                name,
                description,
                features: options.features,
                docker_images: options.docker_images,
                file_denylist: options.file_denylist,
                config_files: options.config_files,
                config_startup: options.config_startup,
                config_stop: options.config_stop,
                config_script: options.config_script,
                startup_commands: options.startup_commands,
                force_outgoing_ip: egg.force_outgoing_ip,
                created: egg.created.unwrap_or(self.now),
            });
        }

        map
    }

    fn egg_variables(&mut self, eggs: &IdMap) -> IdMap {
        let source = self.source;
        let mut map = IdMap::new();
        let mut env_variables: Uniq<(uuid::Uuid, String)> = Uniq::new([]);

        for variable in &source.egg_variables {
            let mut row = Row::new("egg_variables", variable.id, variable.env_variable.as_str());

            let egg_uuid = self.parent(&mut row, "egg_id", "eggs", variable.egg_id, eggs);

            let env_variable = variable.env_variable.trim().to_string();
            let padded = format!("{} ({env_variable})", variable.name.trim());
            let name = self.text(
                &mut row,
                "name",
                variable.name.trim().to_string(),
                3,
                255,
                Some(truncate(&padded, 255)),
            );
            let description =
                self.optional_text(&mut row, "description", variable.description.clone(), 1024);

            if let Some(egg_uuid) = egg_uuid
                && let Some(holder) = env_variables.holder(&(egg_uuid, env_variable.clone()))
            {
                self.problem(
                    &mut row,
                    "env_variable",
                    "duplicate",
                    &env_variable,
                    duplicate_message("this environment variable", "egg_variables", holder),
                    None,
                );
            }

            let mut rules: Vec<CompactString> = variable
                .rules
                .iter()
                .map(|rule| rule.trim().to_compact_string())
                .filter(|rule| !rule.is_empty())
                .collect();
            let unsupported: Vec<CompactString> = rules
                .iter()
                .filter(|rule| {
                    rule_validator::validate_rules(std::slice::from_ref(*rule), &()).is_err()
                })
                .cloned()
                .collect();
            if !unsupported.is_empty()
                && self.problem(
                    &mut row,
                    "rules",
                    "rule",
                    &rules.join("|"),
                    format!("unsupported validation rule(s): {}", unsupported.join(", ")),
                    Some("drop the unsupported rule(s)".into()),
                )
            {
                rules.retain(|rule| !unsupported.contains(rule));
            }

            let Some(egg_uuid) = egg_uuid else {
                continue;
            };

            let options = CreateNestEggVariableOptions {
                egg_uuid,
                name: name.as_str().into(),
                name_translations: BTreeMap::new(),
                description: description.as_deref().map(Into::into),
                description_translations: BTreeMap::new(),
                order: variable.order.clamp(0, i16::MAX as i64) as i16,
                env_variable: env_variable.as_str().into(),
                default_value: variable.default_value.clone(),
                user_viewable: variable.user_viewable,
                user_editable: variable.user_editable,
                secret: false,
                rules,
            };
            self.backstop(
                &mut row,
                &[
                    ("name", &name),
                    ("description", description.as_deref().unwrap_or_default()),
                    ("env_variable", &env_variable),
                    (
                        "default_value",
                        variable.default_value.as_deref().unwrap_or_default(),
                    ),
                    ("rules", ""),
                ],
                &options,
            );

            if row.dropped {
                continue;
            }

            let uuid = uuid::Uuid::new_v4();
            env_variables.claim((egg_uuid, env_variable.clone()), variable.id);
            map.insert(variable.id, uuid);

            self.plan.egg_variables.push(PlanEggVariable {
                source_id: variable.id,
                uuid,
                egg_uuid,
                name,
                description,
                order: options.order,
                env_variable,
                default_value: variable.default_value.clone(),
                user_viewable: variable.user_viewable,
                user_editable: variable.user_editable,
                rules: options.rules,
                created: variable.created.unwrap_or(self.now),
            });
        }

        map
    }

    fn database_hosts(&mut self, nodes: &IdMap) -> IdMap {
        let source = self.source;
        let mut map = IdMap::new();
        let mut names = Uniq::new(self.target.database_host_names.iter().cloned());

        let reserved: HashSet<&str> = source
            .database_hosts
            .iter()
            .map(|row| row.name.trim())
            .collect();

        for host in &source.database_hosts {
            let mut row = Row::new("database_hosts", host.id, host.name.as_str());

            let name = self.text(
                &mut row,
                "name",
                host.name.trim().to_string(),
                1,
                255,
                Some(format!("database host {}", host.id)),
            );
            let name = self.unique_name(
                &mut row,
                "name",
                name,
                255,
                &names,
                &reserved,
                str::to_string,
            );
            let password = self.readable(&mut row, "password", &host.password);

            let port = match u16::try_from(host.port) {
                Ok(port) if port > 0 => port,
                _ => {
                    self.problem(
                        &mut row,
                        "port",
                        "range",
                        &host.port.to_string(),
                        "the port must be between 1 and 65535",
                        None,
                    );
                    0
                }
            };

            let Some(password) = password else {
                continue;
            };

            let credentials = DatabaseCredentials::Details {
                host: host.host.trim().into(),
                port: port.max(1),
                username: host.username.as_str().into(),
                password: password.clone(),
            };
            self.backstop(
                &mut row,
                &[
                    ("host", &host.host),
                    ("username", &host.username),
                    ("password", "<hidden>"),
                ],
                &credentials,
            );

            if row.dropped {
                continue;
            }

            let (node_uuids, location_uuids) = match &host.node_ids {
                Some(node_ids) => (
                    node_ids
                        .iter()
                        .filter_map(|id| nodes.get(id).copied())
                        .collect(),
                    Vec::new(),
                ),
                None => (
                    Vec::new(),
                    self.plan
                        .locations
                        .iter()
                        .map(|location| location.uuid)
                        .collect(),
                ),
            };

            let uuid = uuid::Uuid::new_v4();
            names.claim(name.clone(), host.id);
            map.insert(host.id, uuid);

            self.plan.database_hosts.push(PlanDatabaseHost {
                source_id: host.id,
                uuid,
                name,
                host: host.host.trim().into(),
                port,
                username: host.username.as_str().into(),
                password,
                node_uuids,
                location_uuids,
                created: host.created.unwrap_or(self.now),
            });
        }

        map
    }

    fn unlimited(&mut self, what: &str, used: usize) -> i32 {
        let limit = self
            .options
            .unlimited_as
            .max(i32::try_from(used).unwrap_or(i32::MAX));
        self.note(
            "servers",
            format!("unlimited {what} limits were converted to a fixed limit (--unlimited-as)"),
        );
        limit
    }

    fn servers(&mut self, users: &IdMap, nodes: &IdMap, eggs: &IdMap) -> IdMap {
        let source = self.source;

        let mut used_databases: HashMap<i64, usize> = HashMap::new();
        for database in &source.databases {
            *used_databases.entry(database.server_id).or_default() += 1;
        }
        let mut used_backups: HashMap<i64, usize> = HashMap::new();
        for backup in source
            .backups
            .iter()
            .filter(|backup| backup.deleted.is_none())
        {
            *used_backups.entry(backup.server_id).or_default() += 1;
        }
        let mut used_schedules: HashMap<i64, usize> = HashMap::new();
        for schedule in &source.schedules {
            *used_schedules.entry(schedule.server_id).or_default() += 1;
        }
        let mut used_allocations: HashMap<i64, usize> = HashMap::new();
        for allocation in &source.allocations {
            if let Some(server_id) = allocation.server_id {
                *used_allocations.entry(server_id).or_default() += 1;
            }
        }

        let egg_plans: HashMap<uuid::Uuid, usize> = self
            .plan
            .eggs
            .iter()
            .enumerate()
            .map(|(index, egg)| (egg.uuid, index))
            .collect();

        let mut map = IdMap::new();
        let mut uuids = Uniq::new(self.target.server_uuids.iter().copied());
        let mut uuid_shorts = Uniq::new(self.target.server_uuid_shorts.iter().copied());

        for server in &source.servers {
            let mut row = Row::new("servers", server.id, server.name.as_str());

            let uuid = self.readable(&mut row, "uuid", &server.uuid);
            if let Some(uuid) = uuid {
                if let Some(holder) = uuids.holder(&uuid) {
                    self.problem(
                        &mut row,
                        "uuid",
                        "duplicate",
                        &uuid.to_string(),
                        duplicate_message("this uuid", "servers", holder),
                        None,
                    );
                } else if let Some(holder) = uuid_shorts.holder(&(uuid.as_fields().0 as i32)) {
                    self.problem(
                        &mut row,
                        "uuid",
                        "duplicate",
                        &uuid.to_string(),
                        duplicate_message(
                            "the short identifier (first 8 characters of the uuid)",
                            "servers",
                            holder,
                        ),
                        None,
                    );
                }
            }

            let node_uuid = self.parent(&mut row, "node_id", "nodes", server.node_id, nodes);
            let owner_uuid = self.parent(&mut row, "owner_id", "users", server.owner_id, users);
            let egg_uuid = self.parent(&mut row, "egg_id", "eggs", server.egg_id, eggs);
            let egg = egg_uuid
                .and_then(|uuid| egg_plans.get(&uuid))
                .map(|index| &self.plan.eggs[*index]);
            let egg_startup = egg.and_then(|egg| egg.startup_commands.values().next().cloned());
            let egg_image = egg.and_then(|egg| egg.docker_images.values().next().cloned());

            let external_id =
                self.optional_text(&mut row, "external_id", server.external_id.clone(), 255);
            let name = self.text(
                &mut row,
                "name",
                server.name.trim().to_string(),
                1,
                255,
                Some(format!("server {}", server.id)),
            );
            let description =
                self.optional_text(&mut row, "description", server.description.clone(), 1024);
            let startup = self.text(
                &mut row,
                "startup",
                server.startup.clone(),
                1,
                8192,
                egg_startup
                    .filter(|startup| !startup.is_empty())
                    .map(Into::into),
            );
            let image = self.text(
                &mut row,
                "image",
                server.image.trim().to_string(),
                2,
                255,
                egg_image.filter(|image| chars(image) >= 2).map(Into::into),
            );

            let (status, suspended) = match server.status.as_deref().map(str::trim) {
                None | Some("") => (None, false),
                Some("installing") => (Some(ServerStatus::Installing), false),
                Some("install_failed" | "reinstall_failed") => {
                    (Some(ServerStatus::InstallFailed), false)
                }
                Some("restoring_backup") => (Some(ServerStatus::RestoringBackup), false),
                Some("suspended") => (None, true),
                Some(_) => {
                    self.note(
                        "servers",
                        "unknown server states were imported as a normal, installed server",
                    );
                    (None, false)
                }
            };

            if server.memory < 0 || server.disk < 0 || server.cpu < 0 || server.swap < -1 {
                self.note(
                    "servers",
                    "negative resource limits were converted to unlimited",
                );
            }
            let memory = server.memory.max(0);
            let disk = server.disk.max(0);
            let cpu = server.cpu.clamp(0, i32::MAX as i64) as i32;
            let swap = server.swap.max(-1);
            let io_weight = match server.io {
                io if io <= 0 => None,
                io if (1..=1000).contains(&io) => Some(io as i16),
                io => {
                    self.note("servers", "block io weights outside 0-1000 were clamped");
                    Some(io.clamp(1, 1000) as i16)
                }
            };

            let pinned_cpus = match non_empty(server.threads.clone()) {
                Some(threads) => parse_threads(&threads).unwrap_or_else(|| {
                    self.note(
                        "servers",
                        "unreadable cpu pinning (threads) values were dropped",
                    );
                    Vec::new()
                }),
                None => Vec::new(),
            };

            let labels = match parse_string_map(server.docker_labels.as_deref()) {
                Ok(labels) if shared::models::server::validate_labels(&labels, &()).is_ok() => {
                    labels
                }
                _ => {
                    self.note(
                        "servers",
                        "docker labels the panel does not accept were dropped",
                    );
                    IndexMap::new()
                }
            };

            let databases = used_databases.get(&server.id).copied().unwrap_or(0);
            let database_limit = match server.database_limit {
                None => self.unlimited("database", databases),
                Some(limit) if limit < 0 => self.unlimited("database", databases),
                Some(limit) => limit.min(i32::MAX as i64) as i32,
            };

            let allocations = used_allocations.get(&server.id).copied().unwrap_or(0);
            let allocation_limit = match server.allocation_limit {
                None => 0,
                Some(limit) if limit < 0 => self.unlimited("allocation", allocations),
                Some(limit) => limit.min(i32::MAX as i64) as i32,
            };

            let backups = used_backups.get(&server.id).copied().unwrap_or(0);
            let mut backup_limit = match server.backup_limit {
                None => 0,
                Some(limit) if limit < 0 => self.unlimited("backup", backups),
                Some(limit) => limit.min(i32::MAX as i64) as i32,
            };
            if (backup_limit as usize) < backups {
                self.note(
                    "servers",
                    "backup limits below the number of existing backups were raised so the panel does not delete backups to make room",
                );
                backup_limit = i32::try_from(backups).unwrap_or(i32::MAX);
            }

            let schedule_limit =
                i32::try_from(used_schedules.get(&server.id).copied().unwrap_or(0))
                    .unwrap_or(i32::MAX)
                    .max(10);

            let (Some(uuid), Some(node_uuid), Some(owner_uuid), Some(egg_uuid)) =
                (uuid, node_uuid, owner_uuid, egg_uuid)
            else {
                continue;
            };
            if row.dropped {
                continue;
            }

            uuids.claim(uuid, server.id);
            uuid_shorts.claim(uuid.as_fields().0 as i32, server.id);
            map.insert(server.id, uuid);

            self.plan.servers.push(PlanServer {
                source_id: server.id,
                uuid,
                uuid_short: uuid.as_fields().0 as i32,
                external_id,
                node_uuid,
                owner_uuid,
                egg_uuid,
                name,
                description,
                status,
                suspended,
                memory,
                swap,
                disk,
                io_weight,
                cpu,
                pinned_cpus,
                startup,
                image,
                labels,
                allocation_limit,
                database_limit,
                backup_limit,
                schedule_limit,
                created: server.created.unwrap_or(self.now),
            });
        }

        map
    }

    fn databases(&mut self, servers: &IdMap, hosts: &IdMap) {
        let source = self.source;
        let mut names: Uniq<(uuid::Uuid, String)> = Uniq::new([]);

        for database in &source.databases {
            let mut row = Row::new("databases", database.id, database.name.as_str());

            let server_uuid = self.parent(
                &mut row,
                "server_id",
                "servers",
                database.server_id,
                servers,
            );
            let host_uuid = self.parent(
                &mut row,
                "database_host_id",
                "database_hosts",
                database.database_host_id,
                hosts,
            );
            let password = self.readable(&mut row, "password", &database.password);

            // the name and username belong to a database that already exists on the host, so
            // they can only be taken as they are or not at all
            if database.name.is_empty() || database.name.len() > 124 {
                self.problem(
                    &mut row,
                    "database",
                    "length",
                    &database.name,
                    "database names must be 1-124 bytes long",
                    None,
                );
            }
            if database.username.is_empty() || database.username.len() > 20 {
                self.problem(
                    &mut row,
                    "username",
                    "length",
                    &database.username,
                    "database usernames must be 1-20 bytes long",
                    None,
                );
            }
            if let Some(server_uuid) = server_uuid
                && let Some(holder) = names.holder(&(server_uuid, database.name.clone()))
            {
                self.problem(
                    &mut row,
                    "database",
                    "duplicate",
                    &database.name,
                    duplicate_message("this database name", "databases", holder),
                    None,
                );
            }

            let (Some(server_uuid), Some(database_host_uuid), Some(password)) =
                (server_uuid, host_uuid, password)
            else {
                continue;
            };
            if row.dropped {
                continue;
            }

            names.claim((server_uuid, database.name.clone()), database.id);

            self.plan.databases.push(PlanDatabase {
                source_id: database.id,
                server_uuid,
                database_host_uuid,
                name: database.name.clone(),
                username: database.username.clone(),
                password,
                created: database.created.unwrap_or(self.now),
            });
        }
    }

    fn server_variables(&mut self, servers: &IdMap, egg_variables: &IdMap) {
        let source = self.source;
        let mut latest: HashMap<(uuid::Uuid, uuid::Uuid), usize> = HashMap::new();
        let mut rows: Vec<Option<PlanServerVariable>> = Vec::new();

        for variable in &source.server_variables {
            let Some(server_uuid) = variable.server_id.and_then(|id| servers.get(&id).copied())
            else {
                continue;
            };
            let Some(variable_uuid) = egg_variables.get(&variable.variable_id).copied() else {
                self.note(
                    "server_variables",
                    "values of egg variables that are not imported were dropped",
                );
                continue;
            };

            if let Some(previous) = latest.insert((server_uuid, variable_uuid), rows.len()) {
                rows[previous] = None;
                self.note(
                    "server_variables",
                    "a server had several values for one variable, the newest one was kept",
                );
            }

            rows.push(Some(PlanServerVariable {
                source_id: variable.id,
                server_uuid,
                variable_uuid,
                value: variable.value.clone().unwrap_or_default(),
                created: variable.created.unwrap_or(self.now),
            }));
        }

        let mut variables_by_egg: HashMap<uuid::Uuid, Vec<usize>> = HashMap::new();
        for (index, variable) in self.plan.egg_variables.iter().enumerate() {
            variables_by_egg
                .entry(variable.egg_uuid)
                .or_default()
                .push(index);
        }

        struct Checked {
            env_variable: String,
            rules: Vec<CompactString>,
            value: String,
            default: String,
            row: Option<usize>,
        }

        for server_index in 0..self.plan.servers.len() {
            let server_uuid = self.plan.servers[server_index].uuid;
            let server_name = self.plan.servers[server_index].name.clone();
            let Some(variable_indexes) =
                variables_by_egg.get(&self.plan.servers[server_index].egg_uuid)
            else {
                continue;
            };

            let mut checked: Vec<Checked> = variable_indexes
                .iter()
                .map(|index| {
                    let variable = &self.plan.egg_variables[*index];
                    let row = latest.get(&(server_uuid, variable.uuid)).copied();
                    let default = variable.default_value.clone().unwrap_or_default();
                    Checked {
                        env_variable: variable.env_variable.clone(),
                        rules: variable.rules.clone(),
                        value: row
                            .and_then(|row| rows[row].as_ref())
                            .map_or_else(|| default.clone(), |row| row.value.clone()),
                        default,
                        row,
                    }
                })
                .collect();

            for _ in 0..=checked.len() * 2 {
                let failed = {
                    let data: HashMap<&str, (&[CompactString], &str)> = checked
                        .iter()
                        .map(|c| {
                            (
                                c.env_variable.as_str(),
                                (c.rules.as_slice(), c.value.as_str()),
                            )
                        })
                        .collect();
                    let Ok(validator) = rule_validator::Validator::new(data) else {
                        break;
                    };
                    match validator.validate() {
                        Ok(()) => break,
                        Err(error) => error,
                    }
                };

                let Some(index) = checked.iter().position(|c| {
                    failed
                        .strip_prefix(c.env_variable.as_str())
                        .is_some_and(|rest| rest.starts_with(": "))
                }) else {
                    break;
                };
                let message = failed[checked[index].env_variable.len() + 2..].to_string();
                let failing = &checked[index];

                match failing.row.filter(|_| failing.value != failing.default) {
                    Some(row_index) => {
                        let source_id = rows[row_index].as_ref().map_or(0, |row| row.source_id);
                        let mut row = Row::new(
                            "server_variables",
                            source_id,
                            format!("{} on server {server_name}", failing.env_variable),
                        );
                        if self.problem(
                            &mut row,
                            "variable_value",
                            "rule",
                            &failing.value,
                            format!("violates the variable's rules ({message}), which blocks saving any startup variable of this server"),
                            Some(format!("reset to the egg default {:?}", failing.default)),
                        ) {
                            if let Some(row) = &mut rows[row_index] {
                                row.value = failing.default.clone();
                            }
                            checked[index].value = checked[index].default.clone();
                        } else {
                            rows[row_index] = None;
                            checked.remove(index);
                        }
                    }
                    None => {
                        self.note(
                            "server_variables",
                            "egg defaults that violate their own rules are in use, the server owner has to set a value before startup variables can be saved",
                        );
                        checked.remove(index);
                    }
                }
            }
        }

        self.plan.server_variables = rows.into_iter().flatten().collect();
    }

    fn backups(
        &mut self,
        servers: &IdMap,
        backup_configs: &IdMap,
        default_config: Option<uuid::Uuid>,
    ) {
        let source = self.source;
        let node_by_server: HashMap<uuid::Uuid, uuid::Uuid> = self
            .plan
            .servers
            .iter()
            .map(|server| (server.uuid, server.node_uuid))
            .collect();
        let mut uuids = Uniq::new(self.target.backup_uuids.iter().copied());

        for backup in &source.backups {
            let mut row = Row::new("backups", backup.id, backup.name.as_str());

            let uuid = self.readable(&mut row, "uuid", &backup.uuid);
            if let Some(uuid) = uuid
                && let Some(holder) = uuids.holder(&uuid)
            {
                self.problem(
                    &mut row,
                    "uuid",
                    "duplicate",
                    &uuid.to_string(),
                    duplicate_message("this uuid", "backups", holder),
                    None,
                );
            }

            let server_uuid =
                self.parent(&mut row, "server_id", "servers", backup.server_id, servers);
            let name = self.text(
                &mut row,
                "name",
                backup.name.trim().to_string(),
                1,
                255,
                Some("Backup".into()),
            );
            let checksum = self.optional_text(&mut row, "checksum", backup.checksum.clone(), 255);

            let disk = match backup.disk.as_str() {
                "wings" => BackupDisk::Local,
                "s3" => BackupDisk::S3,
                "ddup-bak" => BackupDisk::DdupBak,
                "btrfs" => BackupDisk::Btrfs,
                "zfs" => BackupDisk::Zfs,
                "restic" => BackupDisk::Restic,
                other => {
                    self.problem(
                        &mut row,
                        "disk",
                        "unsupported",
                        other,
                        "this backup storage type is not supported, the backup could not be restored or downloaded",
                        None,
                    );
                    BackupDisk::Local
                }
            };

            let ignored_files = parse_string_list(backup.ignored_files.as_deref())
                .unwrap_or_else(|()| {
                    self.note(
                        "backups",
                        "unreadable ignored file lists were imported empty",
                    );
                    Vec::new()
                })
                .into_iter()
                .map(Into::into)
                .collect();

            let (Some(uuid), Some(server_uuid)) = (uuid, server_uuid) else {
                continue;
            };
            let Some(node_uuid) = node_by_server.get(&server_uuid).copied() else {
                continue;
            };
            if row.dropped {
                continue;
            }

            uuids.claim(uuid, backup.id);

            self.plan.backups.push(PlanBackup {
                source_id: backup.id,
                uuid,
                server_uuid,
                node_uuid,
                backup_configuration_uuid: backup
                    .backup_config_id
                    .and_then(|id| backup_configs.get(&id).copied())
                    .or(default_config),
                name,
                successful: backup.successful,
                locked: backup.locked,
                ignored_files,
                disk,
                checksum,
                bytes: backup.bytes.max(0),
                upload_id: backup.upload_id.clone(),
                completed: backup.completed,
                deleted: backup.deleted,
                created: backup.created.unwrap_or(self.now),
            });
        }
    }

    fn subusers(&mut self, users: &IdMap, servers: &IdMap) {
        let source = self.source;
        let owners: HashMap<uuid::Uuid, uuid::Uuid> = self
            .plan
            .servers
            .iter()
            .map(|server| (server.uuid, server.owner_uuid))
            .collect();
        let mut seen: HashMap<(uuid::Uuid, uuid::Uuid), usize> = HashMap::new();

        for subuser in &source.subusers {
            let mut row = Row::new("subusers", subuser.id, "");

            let user_uuid = self.parent(&mut row, "user_id", "users", subuser.user_id, users);
            let server_uuid =
                self.parent(&mut row, "server_id", "servers", subuser.server_id, servers);
            let (Some(user_uuid), Some(server_uuid)) = (user_uuid, server_uuid) else {
                continue;
            };

            if owners.get(&server_uuid) == Some(&user_uuid) {
                self.note(
                    "subusers",
                    "subuser entries of a server's own owner were dropped",
                );
                continue;
            }

            let raw_permissions =
                parse_string_list(subuser.permissions.as_deref()).unwrap_or_else(|()| {
                    self.note(
                        "subusers",
                        "unreadable permission lists were imported without permissions",
                    );
                    Vec::new()
                });

            let mut permissions: Vec<CompactString> = Vec::new();
            for permission in raw_permissions {
                match map_permission(&permission) {
                    Some(mapped) => {
                        for mapped in mapped {
                            if !permissions.iter().any(|p| p == mapped) {
                                permissions.push((*mapped).into());
                            }
                        }
                    }
                    None => self.note(
                        "subusers",
                        format!("the permission {permission:?} has no equivalent and was dropped"),
                    ),
                }
            }

            let known = permissions.len();
            permissions.retain(|permission| {
                self.options
                    .server_permissions
                    .contains(permission.as_str())
            });
            if permissions.len() != known {
                self.note(
                    "subusers",
                    "permissions the panel no longer knows were dropped",
                );
            }

            if let Some(existing) = seen.get(&(server_uuid, user_uuid)) {
                self.note("subusers", "a user was a subuser of the same server more than once, the permissions were merged");
                let existing = &mut self.plan.subusers[*existing];
                for permission in permissions {
                    if !existing.permissions.contains(&permission) {
                        existing.permissions.push(permission);
                    }
                }
                continue;
            }

            seen.insert((server_uuid, user_uuid), self.plan.subusers.len());
            self.plan.subusers.push(PlanSubuser {
                source_id: subuser.id,
                server_uuid,
                user_uuid,
                permissions,
                created: subuser.created.unwrap_or(self.now),
            });
        }
    }

    fn mounts(&mut self) -> IdMap {
        let source = self.source;
        let mut map = IdMap::new();
        let mut uuids = Uniq::new(self.target.mount_uuids.iter().copied());
        let mut names = Uniq::new(self.target.mount_names.iter().cloned());
        let mut paths = Uniq::new(self.target.mount_paths.iter().cloned());

        let reserved: HashSet<&str> = source.mounts.iter().map(|row| row.name.trim()).collect();

        for mount in &source.mounts {
            let mut row = Row::new("mounts", mount.id, mount.name.as_str());

            let uuid = self.readable(&mut row, "uuid", &mount.uuid);
            if let Some(uuid) = uuid
                && let Some(holder) = uuids.holder(&uuid)
            {
                self.problem(
                    &mut row,
                    "uuid",
                    "duplicate",
                    &uuid.to_string(),
                    duplicate_message("this uuid", "mounts", holder),
                    None,
                );
            }

            let name = self.text(
                &mut row,
                "name",
                mount.name.trim().to_string(),
                1,
                255,
                Some(format!("mount {}", mount.id)),
            );
            let name = self.unique_name(
                &mut row,
                "name",
                name,
                255,
                &names,
                &reserved,
                str::to_string,
            );
            let description =
                self.optional_text(&mut row, "description", mount.description.clone(), 1024);

            if let Some(holder) = paths.holder(&(mount.source.clone(), mount.target.clone())) {
                self.problem(
                    &mut row,
                    "source",
                    "duplicate",
                    &format!("{} -> {}", mount.source, mount.target),
                    duplicate_message("this source and target pair", "mounts", holder),
                    None,
                );
            }

            self.backstop(
                &mut row,
                &[
                    ("name", &name),
                    ("description", description.as_deref().unwrap_or_default()),
                    ("source", &mount.source),
                    ("target", &mount.target),
                ],
                &CreateMountOptions {
                    name: name.as_str().into(),
                    description: description.as_deref().map(Into::into),
                    source: mount.source.as_str().into(),
                    target: mount.target.as_str().into(),
                    read_only: mount.read_only,
                    user_mountable: mount.user_mountable,
                },
            );

            let Some(uuid) = uuid.filter(|_| !row.dropped) else {
                continue;
            };

            uuids.claim(uuid, mount.id);
            names.claim(name.clone(), mount.id);
            paths.claim((mount.source.clone(), mount.target.clone()), mount.id);
            map.insert(mount.id, uuid);

            self.plan.mounts.push(PlanMount {
                source_id: mount.id,
                uuid,
                name,
                description,
                source: mount.source.clone(),
                target: mount.target.clone(),
                read_only: mount.read_only,
                user_mountable: mount.user_mountable,
            });
        }

        map
    }

    fn mount_links(&mut self, mounts: &IdMap, eggs: &IdMap, nodes: &IdMap, servers: &IdMap) {
        let source = self.source;

        let resolve = |links: &[SourceMountLink], targets: &IdMap| {
            let mut seen = HashSet::new();
            links
                .iter()
                .filter_map(|link| {
                    Some((*targets.get(&link.target_id)?, *mounts.get(&link.mount_id)?))
                })
                .filter(|pair| seen.insert(*pair))
                .collect::<Vec<_>>()
        };

        self.plan.egg_mounts = resolve(&source.egg_mounts, eggs);
        self.plan.node_mounts = resolve(&source.node_mounts, nodes);
        self.plan.server_mounts = resolve(&source.server_mounts, servers);

        let dropped =
            source.egg_mounts.len() + source.node_mounts.len() + source.server_mounts.len()
                - self.plan.egg_mounts.len()
                - self.plan.node_mounts.len()
                - self.plan.server_mounts.len();
        if dropped > 0 {
            *self
                .findings
                .notes
                .entry(("mounts", "mount assignments that are duplicated or point at rows that are not imported were dropped".into()))
                .or_default() += dropped;
        }
    }

    fn schedules(&mut self, servers: &IdMap) -> IdMap {
        let source = self.source;
        let mut map = IdMap::new();
        let mut names: Uniq<(uuid::Uuid, String)> = Uniq::new([]);

        let reserved: HashSet<&str> = source.schedules.iter().map(|row| row.name.trim()).collect();

        for schedule in &source.schedules {
            let mut row = Row::new("schedules", schedule.id, schedule.name.as_str());

            let server_uuid = self.parent(
                &mut row,
                "server_id",
                "servers",
                schedule.server_id,
                servers,
            );
            let Some(server_uuid) = server_uuid else {
                continue;
            };

            let name = self.text(
                &mut row,
                "name",
                schedule.name.trim().to_string(),
                1,
                255,
                Some("Schedule".into()),
            );
            let name = self.unique_name(&mut row, "name", name, 255, &names, &reserved, |name| {
                (server_uuid, name.to_string())
            });

            let expression = format!(
                "0 {} {} {} {} {}",
                schedule.cron_minute.trim(),
                schedule.cron_hour.trim(),
                schedule.cron_day_of_month.trim(),
                schedule.cron_month.trim(),
                schedule.cron_day_of_week.trim()
            );
            let mut enabled = schedule.enabled;
            let triggers = match croner::Cron::from_str(&expression) {
                Ok(cron) => vec![wings_api::ScheduleTrigger::Cron {
                    schedule: Box::new(cron),
                    week_interval: 1,
                    week_anchor: None,
                }],
                Err(err) => {
                    if self.problem(
                        &mut row,
                        "cron",
                        "rule",
                        &expression[2..],
                        format!("not a cron expression the panel understands: {err}"),
                        Some("import the schedule disabled and without a trigger".into()),
                    ) {
                        enabled = false;
                    }
                    Vec::new()
                }
            };

            let condition = if schedule.only_when_online {
                wings_api::ScheduleCondition::Or {
                    conditions: vec![
                        wings_api::ScheduleCondition::ServerState {
                            state: wings_api::ServerState::Starting,
                        },
                        wings_api::ScheduleCondition::ServerState {
                            state: wings_api::ServerState::Running,
                        },
                    ],
                }
            } else {
                wings_api::ScheduleCondition::None
            };

            let options = CreateServerScheduleOptions {
                server_uuid,
                name: name.as_str().into(),
                enabled,
                triggers,
                condition,
            };
            self.backstop(&mut row, &[("name", &name)], &options);

            if row.dropped {
                continue;
            }

            let uuid = uuid::Uuid::new_v4();
            names.claim((server_uuid, name.clone()), schedule.id);
            map.insert(schedule.id, uuid);

            self.plan.schedules.push(PlanSchedule {
                source_id: schedule.id,
                uuid,
                server_uuid,
                name,
                enabled,
                triggers: options.triggers,
                condition: options.condition,
                last_run: schedule.last_run,
                created: schedule.created.unwrap_or(self.now),
            });
        }

        map
    }

    fn tasks(&mut self, schedules: &IdMap) {
        const MAX_SLEEP: u64 = 24 * 60 * 60 * 1000;

        let source = self.source;
        let mut tasks: Vec<&SourceTask> = source.tasks.iter().collect();
        tasks.sort_by_key(|task| (task.schedule_id, task.sequence_id, task.id));
        let mut next_order: HashMap<uuid::Uuid, i16> = HashMap::new();

        for task in tasks {
            let mut row = Row::new("tasks", task.id, task.action.as_str());

            let Some(schedule_uuid) = self.parent(
                &mut row,
                "schedule_id",
                "schedules",
                task.schedule_id,
                schedules,
            ) else {
                continue;
            };

            let action = match task.action.as_str() {
                "command" => Some(wings_api::ScheduleActionInner::SendCommand {
                    command: wings_api::ScheduleDynamicParameter::Raw(task.payload.as_str().into()),
                    ignore_failure: task.continue_on_failure,
                }),
                "power" => {
                    let action = match task.payload.trim() {
                        "start" => Some(wings_api::ServerPowerAction::Start),
                        "stop" => Some(wings_api::ServerPowerAction::Stop),
                        "restart" => Some(wings_api::ServerPowerAction::Restart),
                        "kill" => Some(wings_api::ServerPowerAction::Kill),
                        other => {
                            self.problem(
                                &mut row,
                                "payload",
                                "unsupported",
                                other,
                                "not a power action (start, stop, restart, kill)",
                                None,
                            );
                            None
                        }
                    };
                    action.map(|action| wings_api::ScheduleActionInner::SendPower {
                        action,
                        ignore_failure: task.continue_on_failure,
                    })
                }
                "backup" => Some(wings_api::ScheduleActionInner::CreateBackup {
                    name: None,
                    backup_group_uuid: None,
                    ignored_files: task
                        .payload
                        .lines()
                        .map(str::trim)
                        .filter(|line| !line.is_empty())
                        .map(CompactString::from)
                        .collect(),
                    foreground: true,
                    ignore_failure: task.continue_on_failure,
                    output_into: None,
                }),
                other => {
                    self.problem(
                        &mut row,
                        "action",
                        "unsupported",
                        other,
                        "this task type has no equivalent schedule step",
                        None,
                    );
                    None
                }
            };
            let Some(action) = action else {
                continue;
            };

            let step = CreateServerScheduleStepOptions {
                schedule_uuid,
                action,
                order: 0,
            };
            self.backstop(&mut row, &[("action", &task.payload)], &step);
            if row.dropped {
                continue;
            }

            let created = task.created.unwrap_or(self.now);
            let order = next_order.entry(schedule_uuid).or_insert(0);

            if task.time_offset > 0 {
                *order = order.saturating_add(1);
                self.plan.schedule_steps.push(PlanScheduleStep {
                    source_id: task.id,
                    schedule_uuid,
                    action: wings_api::ScheduleActionInner::Sleep {
                        duration: (task.time_offset as u64)
                            .saturating_mul(1000)
                            .min(MAX_SLEEP),
                    },
                    order: *order,
                    created,
                });
            }

            *order = order.saturating_add(1);
            self.plan.schedule_steps.push(PlanScheduleStep {
                source_id: task.id,
                schedule_uuid,
                action: step.action,
                order: *order,
                created,
            });
        }
    }

    fn allocations(&mut self, nodes: &IdMap, servers: &IdMap) {
        let source = self.source;
        let primary: HashMap<i64, i64> = source
            .servers
            .iter()
            .filter_map(|server| Some((server.allocation_id?, server.id)))
            .collect();
        let mut keys: Uniq<(uuid::Uuid, String, i32)> = Uniq::new([]);

        for allocation in &source.allocations {
            let mut row = Row::new(
                "allocations",
                allocation.id,
                format!("{}:{}", allocation.ip, allocation.port),
            );

            let node_uuid = self.parent(&mut row, "node_id", "nodes", allocation.node_id, nodes);

            let ip = match std::net::IpAddr::from_str(allocation.ip.trim()) {
                Ok(ip) => Some(sqlx::types::ipnetwork::IpNetwork::from(ip)),
                Err(err) => {
                    self.problem(
                        &mut row,
                        "ip",
                        "rule",
                        &allocation.ip,
                        format!("not an ip address: {err}"),
                        None,
                    );
                    None
                }
            };

            let port = match i32::try_from(allocation.port) {
                Ok(port) if (1..=65535).contains(&port) => port,
                _ => {
                    self.problem(
                        &mut row,
                        "port",
                        "range",
                        &allocation.port.to_string(),
                        "the port must be between 1 and 65535",
                        None,
                    );
                    0
                }
            };

            let (Some(node_uuid), Some(ip)) = (node_uuid, ip) else {
                continue;
            };

            let key = (node_uuid, ip.ip().to_string(), port);
            if let Some(holder) = keys.holder(&key) {
                self.problem(
                    &mut row,
                    "port",
                    "duplicate",
                    &format!("{}:{port}", ip.ip()),
                    duplicate_message("this ip and port", "allocations", holder),
                    None,
                );
            }
            if row.dropped {
                continue;
            }

            let ip_alias = match non_empty(allocation.ip_alias.clone()) {
                Some(alias) if alias.len() > 255 => {
                    self.note(
                        "allocations",
                        "ip aliases longer than 255 bytes were dropped",
                    );
                    None
                }
                alias => alias,
            };

            // Pelican keeps the primary allocation on the server row as well, and the two
            // sides can disagree
            let server_id = allocation
                .server_id
                .or_else(|| primary.get(&allocation.id).copied());
            let server_uuid = server_id.and_then(|id| servers.get(&id).copied());
            if server_id.is_some() && server_uuid.is_none() {
                self.note("allocations", "allocations assigned to a server that is not imported were imported unassigned");
            }

            let uuid = uuid::Uuid::new_v4();
            let created = allocation.created.unwrap_or(self.now);
            keys.claim(key, allocation.id);

            self.plan.allocations.push(PlanAllocation {
                source_id: allocation.id,
                uuid,
                node_uuid,
                ip,
                ip_alias,
                port,
                created,
            });

            if let (Some(server_id), Some(server_uuid)) = (server_id, server_uuid) {
                self.plan.server_allocations.push(PlanServerAllocation {
                    source_id: allocation.id,
                    uuid: uuid::Uuid::new_v4(),
                    server_uuid,
                    allocation_uuid: uuid,
                    notes: non_empty(allocation.notes.clone()).map(|notes| truncate(&notes, 1024)),
                    primary: primary.get(&allocation.id) == Some(&server_id),
                    created,
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::issues::OnInvalid;
    use super::*;

    fn uuid_for(kind: u128, id: i64) -> Readable<uuid::Uuid> {
        Ok(uuid::Uuid::from_u128(((id as u128) << 96) | kind))
    }

    fn options() -> Options {
        use include_dir::{Dir, DirEntry, File};

        // the garde backstop validates languages against shared::FRONTEND_LANGUAGES
        static TRANSLATIONS: [DirEntry<'static>; 2] = [
            DirEntry::File(File::new("translations/en.json", b"{}")),
            DirEntry::File(File::new("translations/de.json", b"{}")),
        ];
        static ROOT: [DirEntry<'static>; 1] =
            [DirEntry::Dir(Dir::new("translations", &TRANSLATIONS))];
        static FRONTEND: Dir<'static> = Dir::new("", &ROOT);

        shared::register_frontend(shared::EmbeddedFrontend {
            assets: &FRONTEND,
            index_html: "",
        });

        Options {
            unlimited_as: 0,
            default_language: "en".into(),
            languages: vec!["en".into(), "de".into()],
            server_permissions: shared::permissions::base_server_permission_keys(),
        }
    }

    fn source() -> SourceData {
        SourceData {
            settings: SourceSettings {
                app_url: "https://panel.example.com".into(),
                app_name: None,
                mail: None,
            },
            backup_configs: vec![],
            users: vec![],
            ssh_keys: vec![],
            locations: vec![],
            nodes: vec![],
            nests: vec![],
            eggs: vec![],
            egg_variables: vec![],
            database_hosts: vec![],
            servers: vec![],
            databases: vec![],
            server_variables: vec![],
            backups: vec![],
            subusers: vec![],
            mounts: vec![],
            egg_mounts: vec![],
            node_mounts: vec![],
            server_mounts: vec![],
            schedules: vec![],
            tasks: vec![],
            allocations: vec![],
        }
    }

    fn user(id: i64) -> SourceUser {
        SourceUser {
            id,
            uuid: uuid_for(1, id),
            external_id: None,
            username: format!("user{id}"),
            email: format!("user{id}@example.com"),
            name_first: Some("First".into()),
            name_last: Some("Last".into()),
            password: "$2a$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234".into(),
            admin: false,
            totp_enabled: false,
            totp_secret: None,
            language: Some("en".into()),
            created: None,
        }
    }

    fn location(id: i64) -> SourceLocation {
        SourceLocation {
            id,
            name: format!("location{id}"),
            description: None,
            created: None,
        }
    }

    fn node(id: i64) -> SourceNode {
        SourceNode {
            id,
            uuid: uuid_for(2, id),
            location_id: 1,
            backup_config_id: None,
            name: format!("node{id}"),
            description: None,
            public: true,
            maintenance_mode: false,
            scheme: "https".into(),
            fqdn: format!("node{id}.example.com"),
            daemon_listen: 8080,
            daemon_connect: None,
            daemon_sftp: 2022,
            sftp_alias: None,
            memory: 4096,
            disk: 4096,
            token_id: format!("tokenid{id:09}"),
            token: Ok(format!("{id:0>64}").into()),
            created: None,
        }
    }

    fn nest(id: i64) -> SourceNest {
        SourceNest {
            id,
            uuid: Some(uuid_for(3, id)),
            author: "author@example.com".into(),
            name: format!("nest{id}"),
            description: None,
            created: None,
        }
    }

    fn egg(id: i64, nest_id: i64) -> SourceEgg {
        SourceEgg {
            id,
            uuid: uuid_for(4, id),
            nest_id,
            author: "author@example.com".into(),
            name: format!("egg{id}"),
            description: None,
            features: Some("[]".into()),
            docker_images: Some(r#"{"Java 21":"ghcr.io/example/java:21"}"#.into()),
            file_denylist: Some("[]".into()),
            config_files: Some("{}".into()),
            config_startup: Some(r#"{"done":"Done"}"#.into()),
            config_stop: Some("stop".into()),
            config_from: None,
            copy_script_from: None,
            script_container: Some("alpine".into()),
            script_entry: Some("ash".into()),
            script_install: Some("echo".into()),
            startup: SourceEggStartup::Single(Some("java -jar server.jar".into())),
            force_outgoing_ip: false,
            created: None,
        }
    }

    fn egg_variable(id: i64, egg_id: i64) -> SourceEggVariable {
        SourceEggVariable {
            id,
            egg_id,
            name: format!("Variable {id}"),
            description: None,
            env_variable: format!("VAR_{id}"),
            default_value: Some("value".into()),
            user_viewable: true,
            user_editable: true,
            rules: vec!["required".into(), "string".into()],
            order: 1,
            created: None,
        }
    }

    fn database_host(id: i64) -> SourceDatabaseHost {
        SourceDatabaseHost {
            id,
            name: format!("host{id}"),
            host: "127.0.0.1".into(),
            port: 3306,
            username: "root".into(),
            password: Ok("password".into()),
            node_ids: None,
            created: None,
        }
    }

    fn server(id: i64) -> SourceServer {
        SourceServer {
            id,
            uuid: uuid_for(5, id),
            external_id: None,
            node_id: 1,
            owner_id: 1,
            egg_id: 1,
            allocation_id: None,
            name: format!("server{id}"),
            description: Some("description".into()),
            status: None,
            memory: 1024,
            swap: 0,
            disk: 1024,
            io: 500,
            cpu: 100,
            threads: None,
            startup: "java -jar server.jar".into(),
            image: "ghcr.io/example/java:21".into(),
            docker_labels: None,
            allocation_limit: Some(5),
            database_limit: Some(5),
            backup_limit: Some(5),
            created: None,
        }
    }

    fn database(id: i64, server_id: i64) -> SourceDatabase {
        SourceDatabase {
            id,
            server_id,
            database_host_id: 1,
            name: format!("s{server_id}_db{id}"),
            username: format!("u{server_id}_user{id}"),
            password: Ok("password".into()),
            created: None,
        }
    }

    fn server_variable(
        id: i64,
        server_id: i64,
        variable_id: i64,
        value: Option<&str>,
    ) -> SourceServerVariable {
        SourceServerVariable {
            id,
            server_id: Some(server_id),
            variable_id,
            value: value.map(Into::into),
            created: None,
        }
    }

    fn backup(id: i64, server_id: i64) -> SourceBackup {
        SourceBackup {
            id,
            uuid: uuid_for(6, id),
            server_id,
            backup_config_id: None,
            name: format!("backup{id}"),
            successful: true,
            locked: false,
            ignored_files: None,
            disk: "wings".into(),
            checksum: None,
            bytes: 1024,
            upload_id: None,
            completed: None,
            deleted: None,
            created: None,
        }
    }

    fn subuser(id: i64, user_id: i64, server_id: i64, permissions: &str) -> SourceSubuser {
        SourceSubuser {
            id,
            user_id,
            server_id,
            permissions: Some(permissions.into()),
            created: None,
        }
    }

    fn mount(id: i64) -> SourceMount {
        SourceMount {
            id,
            uuid: uuid_for(7, id),
            name: format!("mount{id}"),
            description: None,
            source: format!("/srv/source{id}"),
            target: format!("/mnt/target{id}"),
            read_only: false,
            user_mountable: false,
        }
    }

    fn schedule(id: i64, server_id: i64) -> SourceSchedule {
        SourceSchedule {
            id,
            server_id,
            name: format!("schedule{id}"),
            enabled: true,
            only_when_online: false,
            cron_minute: "*/5".into(),
            cron_hour: "*".into(),
            cron_day_of_month: "*".into(),
            cron_month: "*".into(),
            cron_day_of_week: "*".into(),
            last_run: None,
            created: None,
        }
    }

    fn task(
        id: i64,
        schedule_id: i64,
        sequence_id: i64,
        action: &str,
        payload: &str,
    ) -> SourceTask {
        SourceTask {
            id,
            schedule_id,
            sequence_id,
            action: action.into(),
            payload: payload.into(),
            time_offset: 0,
            continue_on_failure: false,
            created: None,
        }
    }

    fn allocation(id: i64, ip: &str, port: i64) -> SourceAllocation {
        SourceAllocation {
            id,
            node_id: 1,
            ip: ip.into(),
            ip_alias: None,
            port,
            server_id: None,
            notes: None,
            created: None,
        }
    }

    fn with_server() -> SourceData {
        let mut source = source();
        source.users.push(user(1));
        source.locations.push(location(1));
        source.nodes.push(node(1));
        source.nests.push(nest(1));
        source.eggs.push(egg(1, 1));
        source.servers.push(server(1));
        source
    }

    fn plan(source: &SourceData, policy: OnInvalid) -> (Plan, Findings) {
        build_plan(
            source,
            &TargetSnapshot::default(),
            &options(),
            &Decisions::new(policy),
        )
    }

    fn issues<'a>(findings: &'a Findings) -> impl Iterator<Item = &'a Issue> {
        findings
            .pending
            .iter()
            .chain(findings.resolved.iter().map(|r| &r.issue))
    }

    fn find<'a>(findings: &'a Findings, table: &str, id: i64, code: &str) -> Option<&'a Issue> {
        issues(findings).find(|i| i.key.table == table && i.key.id == id && i.key.code == code)
    }

    fn decision(findings: &Findings, table: &str, id: i64) -> Option<Decision> {
        findings
            .resolved
            .iter()
            .find(|r| r.issue.key.table == table && r.issue.key.id == id)
            .map(|r| r.decision)
    }

    fn valid_username(name: &str) -> bool {
        (3..=15).contains(&name.chars().count())
            && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
    }

    // build_plan
    #[test]
    fn a_clean_source_plans_everything() {
        let mut source = with_server();
        source.egg_variables.push(egg_variable(1, 1));
        source.database_hosts.push(database_host(1));
        source.databases.push(database(1, 1));
        source
            .server_variables
            .push(server_variable(1, 1, 1, Some("abc")));
        source.backups.push(backup(1, 1));
        source.users.push(user(2));
        source
            .subusers
            .push(subuser(1, 2, 1, r#"["control.console"]"#));
        source.mounts.push(mount(1));
        source.schedules.push(schedule(1, 1));
        source.tasks.push(task(1, 1, 1, "command", "say hi"));
        source.allocations.push(allocation(1, "127.0.0.1", 25565));

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        assert!(findings.pending.is_empty(), "{:?}", findings.pending);
        assert!(findings.resolved.is_empty());
        assert_eq!(plan.users.len(), 2);
        assert_eq!(plan.locations.len(), 1);
        assert_eq!(plan.nodes.len(), 1);
        assert_eq!(plan.nests.len(), 1);
        assert_eq!(plan.eggs.len(), 1);
        assert_eq!(plan.egg_variables.len(), 1);
        assert_eq!(plan.database_hosts.len(), 1);
        assert_eq!(plan.servers.len(), 1);
        assert_eq!(plan.databases.len(), 1);
        assert_eq!(plan.server_variables.len(), 1);
        assert_eq!(plan.backups.len(), 1);
        assert_eq!(plan.subusers.len(), 1);
        assert_eq!(plan.mounts.len(), 1);
        assert_eq!(plan.schedules.len(), 1);
        assert_eq!(plan.schedule_steps.len(), 1);
        assert_eq!(plan.allocations.len(), 1);
    }

    #[test]
    fn ask_leaves_problems_pending_and_excludes_the_row() {
        let mut source = source();
        source.users.push(user(1));
        source.users[0].username = "bad name!".into();

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        assert!(plan.users.is_empty());
        assert!(findings.resolved.is_empty());
        let issue = find(&findings, "users", 1, "rule").unwrap();
        assert_eq!(issue.key.field, "username");
        assert!(issue.fix.is_some());
    }

    #[test]
    fn provisional_applies_fixes_but_keeps_them_pending() {
        let mut source = source();
        source.users.push(user(1));
        source.users[0].username = "bad name!".into();
        let mut decisions = Decisions::new(OnInvalid::Ask);
        decisions.provisional = true;

        let (plan, findings) =
            build_plan(&source, &TargetSnapshot::default(), &options(), &decisions);

        assert_eq!(plan.users.len(), 1);
        assert_eq!(plan.users[0].username, "bad_name_");
        assert!(
            findings
                .pending
                .iter()
                .any(|i| i.key.table == "users" && i.key.id == 1)
        );
    }

    #[test]
    fn dropped_rows_cascade_to_the_original_root() {
        let mut source = with_server();
        source.users[0].username = "x".into();
        source.backups.push(backup(1, 1));
        source.backups.push(backup(2, 1));
        source.schedules.push(schedule(1, 1));
        source.tasks.push(task(1, 1, 1, "command", "say hi"));

        let (plan, findings) = plan(&source, OnInvalid::Skip);

        assert!(plan.servers.is_empty());
        assert!(plan.backups.is_empty());
        assert!(plan.schedule_steps.is_empty());
        assert_eq!(issues(&findings).count(), 1);
        let cascade = &findings.cascades[&("users", 1)];
        assert_eq!(cascade.get("servers"), Some(&1));
        assert_eq!(cascade.get("backups"), Some(&2));
        assert_eq!(cascade.get("tasks"), Some(&1));
    }

    #[test]
    fn references_to_missing_rows_are_dangling() {
        let mut source = with_server();
        source.servers[0].owner_id = 99;

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert!(plan.servers.is_empty());
        let issue = find(&findings, "servers", 1, "dangling").unwrap();
        assert!(issue.fix.is_none());
        assert_eq!(decision(&findings, "servers", 1), Some(Decision::Skip));
    }

    // build_plan: users
    #[test]
    fn invalid_usernames_are_renamed() {
        let mut source = source();
        source.users.push(user(1));
        source.users.push(user(2));
        source.users[0].username = "bad name!".into();
        source.users[1].username = "abcdefghijklmnopqrstuvwxyz".into();

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert_eq!(decision(&findings, "users", 1), Some(Decision::Fix));
        assert_eq!(plan.users[0].username, "bad_name_");
        assert_eq!(plan.users[1].username, "abcdefghijklmno");
    }

    #[test]
    fn username_renames_avoid_names_held_by_other_source_rows() {
        let mut source = source();
        source.users.push(user(1));
        source.users.push(user(2));
        source.users[0].username = "bad name".into();
        source.users[1].username = "bad_name".into();

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert!(find(&findings, "users", 2, "duplicate").is_none());
        assert_eq!(plan.users.len(), 2);
        let renamed = &plan
            .users
            .iter()
            .find(|u| u.source_id == 1)
            .unwrap()
            .username;
        assert_ne!(renamed, "bad_name");
        assert!(valid_username(renamed), "{renamed}");
    }

    #[test]
    fn usernames_and_emails_are_unique_case_insensitively() {
        let mut source = source();
        source.users.push(user(1));
        source.users.push(user(2));
        source.users[1].email = "USER1@example.com".into();
        let target = TargetSnapshot {
            usernames: vec!["USER1".into()],
            ..Default::default()
        };

        let (plan, findings) = build_plan(
            &source,
            &target,
            &options(),
            &Decisions::new(OnInvalid::Fix),
        );

        let username = find(&findings, "users", 1, "duplicate").unwrap();
        assert_eq!(username.key.field, "username");
        assert!(username.fix.is_some());
        let email = find(&findings, "users", 2, "duplicate").unwrap();
        assert_eq!(email.key.field, "email");
        assert!(email.fix.is_none());
        assert_eq!(plan.users.len(), 1);
        assert!(!plan.users[0].username.eq_ignore_ascii_case("user1"));
    }

    #[test]
    fn a_dropped_user_does_not_block_its_username() {
        let mut source = source();
        source.users.push(user(1));
        source.users.push(user(2));
        source.users[0].username = "alice".into();
        source.users[1].username = "alice".into();
        let target = TargetSnapshot {
            emails: vec!["user1@example.com".into()],
            ..Default::default()
        };

        let (plan, findings) = build_plan(
            &source,
            &target,
            &options(),
            &Decisions::new(OnInvalid::Skip),
        );

        assert!(issues(&findings).all(|i| i.key.id == 1));
        assert_eq!(plan.users.len(), 1);
        assert_eq!(plan.users[0].username, "alice");
    }

    #[test]
    fn duplicate_external_ids_are_cleared() {
        let mut source = source();
        source.users.push(user(1));
        source.users.push(user(2));
        source.users[0].external_id = Some("ext".into());
        source.users[1].external_id = Some("ext".into());

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert_eq!(decision(&findings, "users", 2), Some(Decision::Fix));
        assert_eq!(plan.users[0].external_id.as_deref(), Some("ext"));
        assert_eq!(plan.users[1].external_id, None);
    }

    #[test]
    fn user_passwords_secrets_and_languages_are_converted() {
        let mut source = source();
        source.users.push(user(1));
        source.users.push(user(2));
        source.users[0].password =
            "$2y$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234".into();
        source.users[0].language = Some("xx".into());
        source.users[1].totp_enabled = true;
        source.users[1].totp_secret = Some(Err(Unreadable::new("garbage", "cannot decrypt")));

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert_eq!(
            plan.users[0].password.as_deref(),
            Some("$2a$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234")
        );
        assert_eq!(plan.users[0].language, "en");
        assert!(issues(&findings).all(|i| i.key.id != 1));
        assert!(findings.notes.keys().any(|(table, _)| *table == "users"));
        assert!(
            find(&findings, "users", 2, "unreadable")
                .unwrap()
                .fix
                .is_some()
        );
        assert!(!plan.users[1].totp_enabled);
    }

    // sanitize_username
    #[test]
    fn sanitize_username_produces_valid_names() {
        assert_eq!(sanitize_username("bad name!"), "bad_name_");
        assert_eq!(
            sanitize_username("abcdefghijklmnopqrstuvwxyz"),
            "abcdefghijklmno"
        );
        let padded = sanitize_username("a");
        assert!(padded.starts_with('a'));
        assert!(valid_username(&padded), "{padded}");
    }

    // numbered
    #[test]
    fn numbered_suffixes_stay_within_the_limit() {
        let taken = |s: &str| s == "abcdefghijklmno" || s == "abcdefghijklm_2";
        let name = numbered("abcdefghijklmno", 15, "_", taken);
        assert!(name.chars().count() <= 15, "{name}");
        assert!(!taken(&name), "{name}");
        let (_, suffix) = name.rsplit_once('_').unwrap();
        assert!(suffix.parse::<u32>().is_ok(), "{name}");
    }

    // build_plan: named rows
    #[test]
    fn duplicate_names_are_numbered() {
        let mut source = with_server();
        source.servers.push(server(2));
        source.nodes.push(node(2));
        source.nodes[1].name = "node1".into();
        source.nests.push(nest(2));
        source.eggs.push(egg(2, 1));
        source.eggs.push(egg(3, 2));
        source.eggs[1].name = "egg1".into();
        source.eggs[2].name = "egg1".into();
        source.schedules.push(schedule(1, 1));
        source.schedules.push(schedule(2, 1));
        source.schedules.push(schedule(3, 2));
        source.schedules[1].name = "schedule1".into();
        source.schedules[2].name = "schedule1".into();

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert_eq!(
            plan.nodes
                .iter()
                .map(|n| (n.source_id, n.name.as_str()))
                .collect::<Vec<_>>(),
            vec![(1, "node1"), (2, "node1 (2)")]
        );
        assert_eq!(
            plan.eggs
                .iter()
                .map(|e| (e.source_id, e.name.as_str()))
                .collect::<Vec<_>>(),
            vec![(1, "egg1"), (2, "egg1 (2)"), (3, "egg1")]
        );
        assert_eq!(
            plan.schedules
                .iter()
                .map(|s| (s.source_id, s.name.as_str()))
                .collect::<Vec<_>>(),
            vec![(1, "schedule1"), (2, "schedule1 (2)"), (3, "schedule1")]
        );
        assert!(find(&findings, "eggs", 3, "duplicate").is_none());
        assert!(find(&findings, "schedules", 3, "duplicate").is_none());
    }

    // build_plan: nodes
    #[test]
    fn unreadable_node_tokens_are_regenerated() {
        let mut source = source();
        source.locations.push(location(1));
        source.nodes.push(node(1));
        source.nodes[0].token = Err(Unreadable::new("garbage", "cannot decrypt"));

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert!(
            find(&findings, "nodes", 1, "unreadable")
                .unwrap()
                .fix
                .is_some()
        );
        assert_eq!(plan.nodes.len(), 1);
        assert_eq!(plan.nodes[0].token_id.chars().count(), 16);
        assert_ne!(plan.nodes[0].token_id, "tokenid000000001");
    }

    // build_plan: eggs
    #[test]
    fn eggs_inherit_blank_config_from_their_parent() {
        let mut source = source();
        source.nests.push(nest(1));
        source.eggs.push(egg(1, 1));
        source.eggs.push(egg(2, 1));
        source.eggs[0].config_startup = Some(r#"{"done":"Parent ready"}"#.into());
        source.eggs[0].config_stop = Some("end".into());
        source.eggs[1].config_from = Some(1);
        source.eggs[1].config_files = None;
        source.eggs[1].config_startup = Some("".into());
        source.eggs[1].config_stop = None;

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        assert!(findings.pending.is_empty(), "{:?}", findings.pending);
        let child = plan.eggs.iter().find(|e| e.source_id == 2).unwrap();
        assert_eq!(
            child.config_startup.done,
            vec![CompactString::from("Parent ready")]
        );
        assert_eq!(child.config_stop.r#type, "command");
        assert_eq!(child.config_stop.value.as_deref(), Some("end"));
    }

    #[test]
    fn egg_startup_and_stop_are_converted() {
        let mut source = source();
        source.nests.push(nest(1));
        source.eggs.push(egg(1, 1));
        source.eggs[0].config_stop = Some("^C".into());

        let (plan, _) = plan(&source, OnInvalid::Ask);

        let egg = &plan.eggs[0];
        assert_eq!(egg.startup_commands.len(), 1);
        assert_eq!(egg.startup_commands["Default"], "java -jar server.jar");
        assert_eq!(egg.config_stop.r#type, "signal");
        assert_eq!(egg.config_stop.value.as_deref(), Some("SIGINT"));
    }

    // build_plan: egg_variables
    #[test]
    fn unsupported_variable_rules_are_dropped_individually() {
        let mut source = source();
        source.nests.push(nest(1));
        source.eggs.push(egg(1, 1));
        source.egg_variables.push(egg_variable(1, 1));
        source.egg_variables[0].rules = vec![
            "required".into(),
            "some_unknown_rule:5".into(),
            "max:20".into(),
        ];

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert_eq!(decision(&findings, "egg_variables", 1), Some(Decision::Fix));
        assert_eq!(
            plan.egg_variables[0].rules,
            vec![
                CompactString::from("required"),
                CompactString::from("max:20")
            ]
        );
    }

    #[test]
    fn duplicate_env_variables_are_scoped_to_the_egg() {
        let mut source = source();
        source.nests.push(nest(1));
        source.eggs.push(egg(1, 1));
        source.eggs.push(egg(2, 1));
        source.egg_variables.push(egg_variable(1, 1));
        source.egg_variables.push(egg_variable(2, 1));
        source.egg_variables.push(egg_variable(3, 2));
        for variable in &mut source.egg_variables {
            variable.env_variable = "SAME".into();
        }

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert!(
            find(&findings, "egg_variables", 2, "duplicate")
                .unwrap()
                .fix
                .is_none()
        );
        assert!(issues(&findings).all(|i| i.key.id == 2));
        let mut planned: Vec<i64> = plan.egg_variables.iter().map(|v| v.source_id).collect();
        planned.sort();
        assert_eq!(planned, vec![1, 3]);
    }

    // build_plan: servers
    #[test]
    fn unlimited_database_limits_use_the_larger_of_option_and_usage() {
        let mut source = with_server();
        source.servers.push(server(2));
        source.servers.push(server(3));
        source.servers[0].database_limit = None;
        source.servers[1].database_limit = Some(-1);
        source.servers[2].database_limit = Some(-1);
        source.database_hosts.push(database_host(1));
        source.databases.push(database(1, 1));
        source.databases.push(database(2, 1));
        source.databases.push(database(3, 3));
        source.databases.push(database(4, 3));
        source.databases.push(database(5, 3));
        source.databases.push(database(6, 3));
        let options = Options {
            unlimited_as: 3,
            ..options()
        };

        let (plan, _) = build_plan(
            &source,
            &TargetSnapshot::default(),
            &options,
            &Decisions::new(OnInvalid::Ask),
        );

        let limit = |id| {
            plan.servers
                .iter()
                .find(|s| s.source_id == id)
                .unwrap()
                .database_limit
        };
        assert_eq!(limit(1), 3);
        assert_eq!(limit(2), 3);
        assert_eq!(limit(3), 4);
    }

    #[test]
    fn allocation_limits_map_none_to_zero_and_negative_to_unlimited() {
        let mut source = with_server();
        source.servers.push(server(2));
        source.servers[0].allocation_limit = None;
        source.servers[1].allocation_limit = Some(-1);
        for (id, port) in [(1, 25565), (2, 25566)] {
            let mut allocation = allocation(id, "127.0.0.1", port);
            allocation.server_id = Some(2);
            source.allocations.push(allocation);
        }
        let options = Options {
            unlimited_as: 1,
            ..options()
        };

        let (plan, _) = build_plan(
            &source,
            &TargetSnapshot::default(),
            &options,
            &Decisions::new(OnInvalid::Ask),
        );

        let limit = |id| {
            plan.servers
                .iter()
                .find(|s| s.source_id == id)
                .unwrap()
                .allocation_limit
        };
        assert_eq!(limit(1), 0);
        assert_eq!(limit(2), 2);
    }

    #[test]
    fn backup_limits_cover_existing_backups() {
        let mut source = with_server();
        source.servers.push(server(2));
        source.servers.push(server(3));
        source.servers[0].backup_limit = Some(1);
        source.servers[1].backup_limit = None;
        source.servers[2].backup_limit = Some(-1);
        source.backups.push(backup(1, 1));
        source.backups.push(backup(2, 1));
        source.backups.push(backup(3, 1));
        source.backups[2].deleted = Some(chrono::Utc::now());
        let options = Options {
            unlimited_as: 7,
            ..options()
        };

        let (plan, _) = build_plan(
            &source,
            &TargetSnapshot::default(),
            &options,
            &Decisions::new(OnInvalid::Ask),
        );

        let limit = |id| {
            plan.servers
                .iter()
                .find(|s| s.source_id == id)
                .unwrap()
                .backup_limit
        };
        assert_eq!(limit(1), 2);
        assert_eq!(limit(2), 0);
        assert_eq!(limit(3), 7);
    }

    #[test]
    fn schedule_limits_are_at_least_ten() {
        let mut source = with_server();
        source.servers.push(server(2));
        for id in 1..=12 {
            source.schedules.push(schedule(id, 2));
        }

        let (plan, _) = plan(&source, OnInvalid::Ask);

        let limit = |id| {
            plan.servers
                .iter()
                .find(|s| s.source_id == id)
                .unwrap()
                .schedule_limit
        };
        assert_eq!(limit(1), 10);
        assert_eq!(limit(2), 12);
    }

    #[test]
    fn server_resources_are_clamped() {
        let mut source = with_server();
        source.servers.push(server(2));
        source.servers.push(server(3));
        source.servers[0].memory = -5;
        source.servers[0].disk = -5;
        source.servers[0].cpu = -5;
        source.servers[0].swap = -1;
        source.servers[0].io = 0;
        source.servers[1].swap = -7;
        source.servers[1].io = -10;
        source.servers[2].io = 1000;

        let (plan, _) = plan(&source, OnInvalid::Fix);

        let server = |id| plan.servers.iter().find(|s| s.source_id == id).unwrap();
        assert_eq!((server(1).memory, server(1).disk, server(1).cpu), (0, 0, 0));
        assert_eq!(server(1).swap, -1);
        assert_eq!(server(1).io_weight, None);
        assert_eq!(server(2).swap, -1);
        assert_eq!(server(2).io_weight, None);
        assert_eq!(server(3).io_weight, Some(1000));
    }

    #[test]
    fn server_status_threads_and_description_are_converted() {
        let mut source = with_server();
        source.servers.push(server(2));
        source.servers.push(server(3));
        source.servers[0].status = Some("suspended".into());
        source.servers[0].threads = Some("0,2-4".into());
        source.servers[0].description = Some("".into());
        source.servers[1].status = Some("installing".into());
        source.servers[1].threads = Some("garbage".into());
        source.servers[2].status = Some("reinstall_failed".into());

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        assert!(findings.pending.is_empty(), "{:?}", findings.pending);
        let server = |id| plan.servers.iter().find(|s| s.source_id == id).unwrap();
        assert!(server(1).status.is_none());
        assert!(server(1).suspended);
        assert_eq!(server(1).pinned_cpus, vec![0, 2, 3, 4]);
        assert_eq!(server(1).description, None);
        assert!(server(2).status == Some(ServerStatus::Installing));
        assert!(!server(2).suspended);
        assert!(server(2).pinned_cpus.is_empty());
        assert!(findings.notes.keys().any(|(table, _)| *table == "servers"));
        assert!(server(3).status == Some(ServerStatus::InstallFailed));
    }

    // parse_threads
    #[test]
    fn parse_threads_expands_ranges() {
        assert_eq!(parse_threads("0,2-4"), Some(vec![0, 2, 3, 4]));
        assert_eq!(parse_threads(" 1 , 3 "), Some(vec![1, 3]));
        assert_eq!(parse_threads("garbage"), None);
        assert_eq!(parse_threads("4-2"), None);
    }

    // build_plan: server_variables
    #[test]
    fn server_variables_default_and_collapse() {
        let mut source = with_server();
        source.egg_variables.push(egg_variable(1, 1));
        source.egg_variables[0].rules = vec!["nullable".into(), "string".into()];
        source.server_variables.push(server_variable(1, 1, 1, None));
        source.server_variables.push(server_variable(2, 1, 1, None));

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        assert!(findings.pending.is_empty(), "{:?}", findings.pending);
        assert_eq!(plan.server_variables.len(), 1);
        assert_eq!(plan.server_variables[0].value, "");
    }

    #[test]
    fn rule_violating_values_reset_to_the_egg_default() {
        let mut source = with_server();
        source.servers.push(server(2));
        source.egg_variables.push(egg_variable(1, 1));
        source.egg_variables[0].rules = vec!["required".into(), "string".into(), "max:5".into()];
        source.egg_variables[0].default_value = Some("abc".into());
        source
            .server_variables
            .push(server_variable(1, 1, 1, Some("toolongvalue")));

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        let issue = issues(&findings)
            .find(|i| i.key.table == "server_variables" && i.key.code == "rule")
            .unwrap();
        assert_eq!(issue.key.field, "variable_value");
        assert!(issue.fix.is_some());
        assert_eq!(plan.servers.len(), 2);
        let value = plan
            .server_variables
            .iter()
            .find(|v| v.server_uuid == plan.servers.iter().find(|s| s.source_id == 1).unwrap().uuid)
            .unwrap();
        assert_eq!(value.value, "abc");
    }

    #[test]
    fn a_violating_egg_default_alone_is_not_an_issue() {
        let mut source = with_server();
        source.egg_variables.push(egg_variable(1, 1));
        source.egg_variables[0].rules = vec!["required".into(), "string".into(), "max:5".into()];
        source.egg_variables[0].default_value = Some("toolongvalue".into());

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        assert!(
            issues(&findings).all(|i| i.key.table != "server_variables"),
            "{:?}",
            findings.pending
        );
        assert_eq!(plan.servers.len(), 1);
    }

    // build_plan: backups
    #[test]
    fn backup_disks_and_deletions_are_converted() {
        let mut source = with_server();
        source.servers[0].backup_limit = Some(10);
        for id in 1..=4 {
            source.backups.push(backup(id, 1));
        }
        source.backups[1].disk = "s3".into();
        source.backups[2].disk = "ftp".into();
        source.backups[3].deleted = Some(chrono::Utc::now());

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        let backup = |id| plan.backups.iter().find(|b| b.source_id == id);
        assert!(backup(1).unwrap().disk == BackupDisk::Local);
        assert!(backup(2).unwrap().disk == BackupDisk::S3);
        assert!(backup(3).is_none());
        assert!(find(&findings, "backups", 3, "unsupported").is_some());
        assert!(backup(4).unwrap().deleted.is_some());
    }

    // map_permission
    #[test]
    fn map_permission_translates_known_permissions() {
        assert_eq!(
            map_permission("control.console"),
            Some(&["control.console", "control.read-console"][..])
        );
        assert_eq!(map_permission("user.read"), Some(&["subusers.read"][..]));
        assert_eq!(map_permission("file.sftp"), Some(&["files.sftp"][..]));
        assert_eq!(
            map_permission("database.view_password"),
            Some(&["databases.read-password"][..])
        );
        assert_eq!(
            map_permission("database.view-password"),
            Some(&["databases.read-password"][..])
        );
        assert_eq!(
            map_permission("settings.reinstall"),
            Some(&["settings.install"][..])
        );
        assert_eq!(map_permission("websocket.connect"), Some(&[][..]));
        assert_eq!(map_permission("made.up"), None);
    }

    #[test]
    fn mapped_permissions_exist_in_calagopus() {
        let known = shared::permissions::base_server_permission_keys();
        for permission in [
            "control.console",
            "user.read",
            "file.sftp",
            "database.view_password",
            "settings.reinstall",
        ] {
            for mapped in map_permission(permission).unwrap() {
                assert!(known.contains(*mapped), "{permission} -> {mapped}");
            }
        }
    }

    // parse_string_list
    #[test]
    fn parse_string_list_accepts_arrays_and_php_objects() {
        assert_eq!(
            parse_string_list(Some(r#"["a","b"]"#)),
            Ok(vec!["a".into(), "b".into()])
        );
        assert_eq!(
            parse_string_list(Some(r#"{"0":"a","2":"b"}"#)),
            Ok(vec!["a".into(), "b".into()])
        );
        assert!(parse_string_list(Some("not json")).is_err());
    }

    // build_plan: subusers
    #[test]
    fn subusers_skip_the_owner_and_merge_duplicates() {
        let mut source = with_server();
        source.users.push(user(2));
        source.subusers.push(subuser(1, 1, 1, r#"["file.read"]"#));
        source.subusers.push(subuser(2, 2, 1, r#"["file.sftp"]"#));
        source
            .subusers
            .push(subuser(3, 2, 1, r#"{"0":"user.read"}"#));

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        assert!(findings.pending.is_empty(), "{:?}", findings.pending);
        assert_eq!(plan.subusers.len(), 1);
        let permissions = &plan.subusers[0].permissions;
        assert!(permissions.contains(&CompactString::from("files.sftp")));
        assert!(permissions.contains(&CompactString::from("subusers.read")));
    }

    // build_plan: schedules
    #[test]
    fn invalid_cron_schedules_are_disabled() {
        let mut source = with_server();
        source.schedules.push(schedule(1, 1));
        source.schedules[0].cron_minute = "not-a-minute".into();

        let (plan, findings) = plan(&source, OnInvalid::Fix);

        assert_eq!(decision(&findings, "schedules", 1), Some(Decision::Fix));
        assert_eq!(plan.schedules.len(), 1);
        assert!(!plan.schedules[0].enabled);
        assert!(plan.schedules[0].triggers.is_empty());
    }

    // build_plan: tasks
    #[test]
    fn tasks_are_ordered_and_offsets_become_sleeps() {
        let mut source = with_server();
        source.schedules.push(schedule(1, 1));
        source.schedules.push(schedule(2, 1));
        source.tasks.push(task(1, 1, 5, "command", "third"));
        source.tasks.push(task(2, 1, 2, "power", "restart"));
        source.tasks.push(task(3, 1, 2, "command", "second"));
        source.tasks.push(task(4, 2, 9, "command", "other"));
        source.tasks[1].time_offset = 30;

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        assert!(findings.pending.is_empty(), "{:?}", findings.pending);
        let schedule_uuid = plan
            .schedules
            .iter()
            .find(|s| s.source_id == 1)
            .unwrap()
            .uuid;
        let mut steps: Vec<&PlanScheduleStep> = plan
            .schedule_steps
            .iter()
            .filter(|s| s.schedule_uuid == schedule_uuid)
            .collect();
        steps.sort_by_key(|s| s.order);
        let orders: Vec<i16> = steps.iter().map(|s| s.order).collect();
        let first = orders[0];
        assert_eq!(orders, (first..first + 4).collect::<Vec<_>>());
        assert!(matches!(
            steps[0].action,
            wings_api::ScheduleActionInner::Sleep { duration: 30_000 }
        ));
        assert!(matches!(
            steps[1].action,
            wings_api::ScheduleActionInner::SendPower {
                action: wings_api::ServerPowerAction::Restart,
                ..
            }
        ));
        assert_eq!(steps[1].source_id, 2);
        assert_eq!(steps[2].source_id, 3);
        assert_eq!(steps[3].source_id, 1);
        let other = plan
            .schedules
            .iter()
            .find(|s| s.source_id == 2)
            .unwrap()
            .uuid;
        let other_steps: Vec<_> = plan
            .schedule_steps
            .iter()
            .filter(|s| s.schedule_uuid == other)
            .collect();
        assert_eq!(other_steps.len(), 1);
        assert_eq!(other_steps[0].order, first);
    }

    #[test]
    fn unknown_task_actions_are_unsupported() {
        let mut source = with_server();
        source.schedules.push(schedule(1, 1));
        source.tasks.push(task(1, 1, 1, "teleport", "x"));
        source.tasks.push(task(2, 1, 2, "power", "explode"));

        let (_, findings) = plan(&source, OnInvalid::Ask);

        assert!(find(&findings, "tasks", 1, "unsupported").is_some());
        assert!(find(&findings, "tasks", 2, "unsupported").is_some());
    }

    // build_plan: allocations
    #[test]
    fn invalid_and_duplicate_allocations_are_rejected() {
        let mut source = source();
        source.locations.push(location(1));
        source.nodes.push(node(1));
        source.allocations.push(allocation(1, "127.0.0.1", 25565));
        source.allocations.push(allocation(2, "not-an-ip", 25566));
        source.allocations.push(allocation(3, "10.0.0.0/24", 25567));
        source.allocations.push(allocation(4, "127.0.0.1", 0));
        source.allocations.push(allocation(5, "127.0.0.1", 65536));
        source.allocations.push(allocation(6, "127.0.0.1", 25565));
        source.allocations.push(allocation(7, "127.0.0.1", 65535));

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        for id in 2..=5 {
            assert!(
                issues(&findings).any(|i| i.key.table == "allocations" && i.key.id == id),
                "{id}"
            );
        }
        assert!(find(&findings, "allocations", 6, "duplicate").is_some());
        let mut planned: Vec<i64> = plan.allocations.iter().map(|a| a.source_id).collect();
        planned.sort();
        assert_eq!(planned, vec![1, 7]);
    }

    #[test]
    fn server_allocations_mark_the_primary() {
        let mut source = with_server();
        source.servers[0].allocation_id = Some(2);
        for (id, port) in [(1, 25565), (2, 25566)] {
            let mut allocation = allocation(id, "127.0.0.1", port);
            allocation.server_id = Some(1);
            source.allocations.push(allocation);
        }
        source.allocations.push(allocation(3, "127.0.0.1", 25567));

        let (plan, findings) = plan(&source, OnInvalid::Ask);

        assert!(findings.pending.is_empty(), "{:?}", findings.pending);
        assert_eq!(plan.allocations.len(), 3);
        assert_eq!(plan.server_allocations.len(), 2);
        let primary = |id| {
            plan.server_allocations
                .iter()
                .find(|a| a.source_id == id)
                .unwrap()
                .primary
        };
        assert!(!primary(1));
        assert!(primary(2));
    }
}
