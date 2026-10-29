use garde::Validate;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
#[serde(transparent)]
pub struct Config(pub serde_json::Value);

impl Config {
    pub fn view<T: serde::de::DeserializeOwned>(&self) -> Result<T, serde_json::Error> {
        T::deserialize(&self.0)
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum QueryValue {
    Null,
    Text { value: String, truncated: bool },
    Binary { value: String, truncated: bool },
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
#[non_exhaustive]
pub enum ServerSelector {
    Uuids {
        uuids: std::collections::HashSet<uuid::Uuid>,
    },
    All,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
#[serde(tag = "adapter")]
#[non_exhaustive]
pub enum BackupTestTarget {
    #[serde(rename = "wings")]
    Wings,
    #[serde(rename = "s3")]
    S3 {
        configuration: super::S3TestConfiguration,
    },
    #[serde(rename = "ddup-bak")]
    DdupBak,
    #[serde(rename = "btrfs")]
    Btrfs,
    #[serde(rename = "zfs")]
    Zfs,
    #[serde(rename = "restic")]
    Restic {
        configuration: Option<super::ResticBackupConfiguration>,
    },
    #[serde(rename = "proxmox-backup-server")]
    ProxmoxBackupServer {
        configuration: super::PbsRepositoryConfiguration,
    },
    #[serde(rename = "kopia")]
    Kopia {
        configuration: super::KopiaBackupConfiguration,
    },
}

impl std::fmt::Display for super::StreamableArchiveFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                super::StreamableArchiveFormat::Tar => "tar",
                super::StreamableArchiveFormat::TarGz => "tar_gz",
                super::StreamableArchiveFormat::TarXz => "tar_xz",
                super::StreamableArchiveFormat::TarLzip => "tar_lzip",
                super::StreamableArchiveFormat::TarBz2 => "tar_bz2",
                super::StreamableArchiveFormat::TarLz4 => "tar_lz4",
                super::StreamableArchiveFormat::TarZstd => "tar_zstd",
                super::StreamableArchiveFormat::Itaf => "itaf",
                super::StreamableArchiveFormat::ItafGz => "itaf_gz",
                super::StreamableArchiveFormat::ItafXz => "itaf_xz",
                super::StreamableArchiveFormat::ItafLzip => "itaf_lzip",
                super::StreamableArchiveFormat::ItafBz2 => "itaf_bz2",
                super::StreamableArchiveFormat::ItafLz4 => "itaf_lz4",
                super::StreamableArchiveFormat::ItafZstd => "itaf_zstd",
                super::StreamableArchiveFormat::Zip => "zip",
            }
        )
    }
}

#[allow(clippy::derivable_impls)]
impl Default for super::StreamableArchiveFormat {
    #[inline]
    fn default() -> Self {
        super::StreamableArchiveFormat::TarGz
    }
}

impl std::fmt::Display for super::BackupAdapter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                super::BackupAdapter::Wings => "wings",
                super::BackupAdapter::S3 => "s3",
                super::BackupAdapter::DdupBak => "ddup-bak",
                super::BackupAdapter::Btrfs => "btrfs",
                super::BackupAdapter::Zfs => "zfs",
                super::BackupAdapter::Restic => "restic",
                super::BackupAdapter::ProxmoxBackupServer => "proxmox-backup-server",
                super::BackupAdapter::Kopia => "kopia",
            }
        )
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
#[non_exhaustive]
pub enum Algorithm {
    Md5,
    Crc32,
    Sha1,
    Sha224,
    Sha256,
    Sha384,
    Sha512,
    Curseforge,
}

impl std::fmt::Display for Algorithm {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Algorithm::Md5 => "md5",
                Algorithm::Crc32 => "crc32",
                Algorithm::Sha1 => "sha1",
                Algorithm::Sha224 => "sha224",
                Algorithm::Sha256 => "sha256",
                Algorithm::Sha384 => "sha384",
                Algorithm::Sha512 => "sha512",
                Algorithm::Curseforge => "curseforge",
            }
        )
    }
}

#[derive(Debug, Default, ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[non_exhaustive]
pub enum DirectorySortingMode {
    #[default]
    NameAsc,
    NameDesc,
    SizeAsc,
    SizeDesc,
    PhysicalSizeAsc,
    PhysicalSizeDesc,
    ModifiedAsc,
    ModifiedDesc,
    CreatedAsc,
    CreatedDesc,
}

impl std::fmt::Display for DirectorySortingMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                DirectorySortingMode::NameAsc => "name_asc",
                DirectorySortingMode::NameDesc => "name_desc",
                DirectorySortingMode::SizeAsc => "size_asc",
                DirectorySortingMode::SizeDesc => "size_desc",
                DirectorySortingMode::PhysicalSizeAsc => "physical_size_asc",
                DirectorySortingMode::PhysicalSizeDesc => "physical_size_desc",
                DirectorySortingMode::ModifiedAsc => "modified_asc",
                DirectorySortingMode::ModifiedDesc => "modified_desc",
                DirectorySortingMode::CreatedAsc => "created_asc",
                DirectorySortingMode::CreatedDesc => "created_desc",
            }
        )
    }
}

#[derive(ToSchema, Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ServerBackupStatus {
    Starting,
    Finished,
    Failed,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[non_exhaustive]
pub enum Game {
    MinecraftJava,
}

impl std::fmt::Display for Game {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Game::MinecraftJava => "minecraft_java",
            }
        )
    }
}

#[derive(ToSchema, Clone, Deserialize, Serialize, Validate)]
pub struct ScheduleVariable {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub variable: compact_str::CompactString,
}

#[derive(ToSchema, Clone, Deserialize, Serialize, Validate)]
#[serde(untagged)]
pub enum ScheduleDynamicParameter {
    Raw(#[garde(length(chars, min = 1, max = 16384))] compact_str::CompactString),
    Variable(#[garde(dive)] ScheduleVariable),
}

#[derive(ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleHttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Head,
}

#[derive(ToSchema, Clone, Deserialize, Serialize, Validate)]
pub struct ScheduleHttpHeader {
    #[garde(length(chars, min = 1, max = 128))]
    #[schema(min_length = 1, max_length = 128)]
    pub name: compact_str::CompactString,
    #[garde(dive)]
    pub value: ScheduleDynamicParameter,
}

#[derive(ToSchema, Deserialize, Serialize)]
pub struct ScheduleAction {
    pub uuid: uuid::Uuid,

    #[serde(flatten)]
    pub inner: ScheduleActionInner,
}

#[derive(ToSchema, Validate, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "mode")]
#[non_exhaustive]
pub enum ScheduleBackupSelector {
    Latest {
        #[garde(skip)]
        #[serde(default)]
        backup_group_uuid: Option<uuid::Uuid>,
    },
    Oldest {
        #[garde(skip)]
        #[serde(default)]
        backup_group_uuid: Option<uuid::Uuid>,
    },
    Uuid {
        #[garde(dive)]
        uuid: ScheduleDynamicParameter,
    },
    Name {
        #[garde(dive)]
        name: ScheduleDynamicParameter,
        #[garde(skip)]
        #[serde(default)]
        backup_group_uuid: Option<uuid::Uuid>,
        #[garde(skip)]
        #[serde(default)]
        oldest: bool,
    },
}

#[derive(ToSchema, Validate, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
#[non_exhaustive]
pub enum ScheduleActionInner {
    Sleep {
        #[garde(range(min = 1, max = 24 * 60 * 60 * 1000))]
        #[schema(minimum = 1, maximum = 86400000)]
        duration: u64,
    },
    Ensure {
        #[garde(dive, custom(ScheduleCondition::validate_nesting))]
        condition: ScheduleCondition,
    },
    If {
        #[garde(dive, custom(ScheduleCondition::validate_nesting))]
        condition: ScheduleCondition,
    },
    ElseIf {
        #[garde(dive, custom(ScheduleCondition::validate_nesting))]
        condition: ScheduleCondition,
    },
    Else,
    EndIf,
    Exit {
        #[garde(skip)]
        successful: bool,
    },
    WaitForState {
        #[garde(skip)]
        ignore_failure: bool,

        #[garde(skip)]
        state: super::ServerState,
        #[garde(range(min = 1, max = 24 * 60 * 60 * 1000))]
        #[schema(minimum = 1, maximum = 86400000)]
        timeout: u64,
    },
    Format {
        #[garde(length(chars, min = 1, max = 16384))]
        #[schema(min_length = 1, max_length = 16384)]
        format: String,
        #[garde(dive)]
        output_into: ScheduleVariable,
    },
    MatchRegex {
        #[garde(dive)]
        input: ScheduleDynamicParameter,

        #[garde(skip)]
        #[serde(with = "serde_regex")]
        #[schema(value_type = String, format = "regex")]
        regex: regex::Regex,

        #[garde(skip)]
        output_into: Vec<Option<ScheduleVariable>>,
    },
    WaitForConsoleLine {
        #[garde(skip)]
        ignore_failure: bool,

        #[garde(dive)]
        contains: ScheduleDynamicParameter,
        #[garde(skip)]
        #[serde(default)]
        case_insensitive: bool,
        #[garde(range(min = 1, max = 24 * 60 * 60 * 1000))]
        #[schema(minimum = 1, maximum = 86400000)]
        timeout: u64,

        #[garde(dive)]
        output_into: Option<ScheduleVariable>,
    },
    SendPower {
        #[garde(skip)]
        ignore_failure: bool,

        #[garde(skip)]
        action: super::ServerPowerAction,
    },
    SendCommand {
        #[garde(skip)]
        ignore_failure: bool,

        #[garde(dive)]
        command: ScheduleDynamicParameter,
    },
    CreateBackup {
        #[garde(skip)]
        ignore_failure: bool,
        #[garde(skip)]
        foreground: bool,

        #[garde(dive)]
        name: Option<ScheduleDynamicParameter>,
        #[garde(skip)]
        #[serde(default)]
        backup_group_uuid: Option<uuid::Uuid>,
        #[garde(skip)]
        ignored_files: Vec<compact_str::CompactString>,

        #[garde(dive)]
        #[serde(default)]
        output_into: Option<ScheduleVariable>,
    },
    RestoreBackup {
        #[garde(skip)]
        ignore_failure: bool,
        #[garde(skip)]
        truncate_directory: bool,
        #[garde(skip)]
        #[serde(default)]
        restore_startup: bool,

        #[garde(dive)]
        backup: ScheduleBackupSelector,
    },
    DeleteBackup {
        #[garde(skip)]
        #[serde(default)]
        ignore_failure: bool,

        #[garde(dive)]
        backup: ScheduleBackupSelector,
    },
    MoveBackup {
        #[garde(skip)]
        #[serde(default)]
        ignore_failure: bool,

        #[garde(dive)]
        backup: ScheduleBackupSelector,
        #[garde(skip)]
        #[serde(default)]
        backup_group_uuid: Option<uuid::Uuid>,
    },
    CreateDatabaseBackup {
        #[garde(skip)]
        ignore_failure: bool,
        #[garde(skip)]
        foreground: bool,

        #[garde(dive)]
        name: Option<ScheduleDynamicParameter>,
        #[garde(skip)]
        database_instance_uuid: uuid::Uuid,
        #[garde(skip)]
        #[serde(default)]
        backup_group_uuid: Option<uuid::Uuid>,

        #[garde(dive)]
        #[serde(default)]
        output_into: Option<ScheduleVariable>,
    },
    DeleteDatabaseBackup {
        #[garde(skip)]
        #[serde(default)]
        ignore_failure: bool,

        #[garde(dive)]
        backup: ScheduleBackupSelector,
        #[garde(skip)]
        #[serde(default)]
        database_instance_uuid: Option<uuid::Uuid>,
    },
    MoveDatabaseBackup {
        #[garde(skip)]
        #[serde(default)]
        ignore_failure: bool,

        #[garde(dive)]
        backup: ScheduleBackupSelector,
        #[garde(skip)]
        #[serde(default)]
        database_instance_uuid: Option<uuid::Uuid>,
        #[garde(skip)]
        #[serde(default)]
        backup_group_uuid: Option<uuid::Uuid>,
    },
    RestoreDatabaseBackup {
        #[garde(skip)]
        #[serde(default)]
        ignore_failure: bool,

        #[garde(dive)]
        backup: ScheduleBackupSelector,
        #[garde(skip)]
        #[serde(default)]
        source_database_instance_uuid: Option<uuid::Uuid>,
        #[garde(skip)]
        #[serde(default)]
        database_instance_uuid: Option<uuid::Uuid>,
    },
    CreateDirectory {
        #[garde(skip)]
        ignore_failure: bool,

        #[garde(dive)]
        root: ScheduleDynamicParameter,
        #[garde(dive)]
        name: ScheduleDynamicParameter,
    },
    WriteFile {
        #[garde(skip)]
        ignore_failure: bool,
        #[garde(skip)]
        append: bool,

        #[garde(dive)]
        file: ScheduleDynamicParameter,
        #[garde(dive)]
        content: ScheduleDynamicParameter,
    },
    CopyFile {
        #[garde(skip)]
        ignore_failure: bool,
        #[garde(skip)]
        foreground: bool,

        #[garde(dive)]
        file: ScheduleDynamicParameter,
        #[garde(dive)]
        destination: ScheduleDynamicParameter,
    },
    DeleteFiles {
        #[garde(skip)]
        #[serde(default)]
        ignore_failure: bool,
        #[garde(skip)]
        #[serde(default)]
        trash: bool,

        #[garde(dive)]
        root: ScheduleDynamicParameter,
        #[garde(skip)]
        files: Vec<compact_str::CompactString>,
    },
    RenameFiles {
        #[garde(skip)]
        #[serde(default)]
        ignore_failure: bool,

        #[garde(dive)]
        root: ScheduleDynamicParameter,
        #[garde(skip)]
        #[schema(inline)]
        files: Vec<super::servers_server_files_rename::put::RequestBodyFiles>,
    },
    CompressFiles {
        #[garde(skip)]
        ignore_failure: bool,
        #[garde(skip)]
        foreground: bool,

        #[garde(dive)]
        root: ScheduleDynamicParameter,
        #[garde(skip)]
        files: Vec<compact_str::CompactString>,
        #[garde(skip)]
        format: super::ArchiveFormat,
        #[garde(dive)]
        name: ScheduleDynamicParameter,
    },
    DecompressFile {
        #[garde(skip)]
        ignore_failure: bool,
        #[garde(skip)]
        foreground: bool,

        #[garde(dive)]
        root: ScheduleDynamicParameter,
        #[garde(dive)]
        file: ScheduleDynamicParameter,
    },
    PullFile {
        #[garde(skip)]
        ignore_failure: bool,
        #[garde(skip)]
        foreground: bool,

        #[garde(dive)]
        root: ScheduleDynamicParameter,
        #[garde(dive)]
        url: ScheduleDynamicParameter,
        #[garde(dive)]
        #[serde(default)]
        file_name: Option<ScheduleDynamicParameter>,
        #[garde(skip)]
        #[serde(default)]
        use_header: bool,
    },
    UpdateStartupVariable {
        #[garde(skip)]
        ignore_failure: bool,

        #[garde(dive)]
        env_variable: ScheduleDynamicParameter,
        #[garde(dive)]
        value: ScheduleDynamicParameter,
    },
    UpdateStartupCommand {
        #[garde(skip)]
        ignore_failure: bool,

        #[garde(dive)]
        command: ScheduleDynamicParameter,
    },
    UpdateStartupDockerImage {
        #[garde(skip)]
        ignore_failure: bool,

        #[garde(dive)]
        image: ScheduleDynamicParameter,
    },
    HttpRequest {
        #[garde(skip)]
        ignore_failure: bool,

        #[garde(skip)]
        method: ScheduleHttpMethod,
        #[garde(skip)]
        #[schema(value_type = String, format = "uri")]
        url: reqwest::Url,
        #[garde(length(max = 32), dive)]
        #[serde(default)]
        headers: Vec<ScheduleHttpHeader>,
        #[garde(dive)]
        #[serde(default)]
        body: Option<ScheduleDynamicParameter>,
        #[garde(range(min = 1, max = 60 * 1000))]
        #[schema(minimum = 1, maximum = 60000)]
        timeout: u64,
        #[garde(skip)]
        #[serde(default)]
        ignore_error_status: bool,

        #[garde(dive)]
        #[serde(default)]
        output_status_into: Option<ScheduleVariable>,
        #[garde(dive)]
        #[serde(default)]
        output_body_into: Option<ScheduleVariable>,
    },
}

impl ScheduleActionInner {
    pub fn permissions(&self) -> &'static [&'static str] {
        match self {
            ScheduleActionInner::Sleep { .. } => &[],
            ScheduleActionInner::Ensure { .. } => &[],
            ScheduleActionInner::If { .. } => &[],
            ScheduleActionInner::ElseIf { .. } => &[],
            ScheduleActionInner::Else => &[],
            ScheduleActionInner::EndIf => &[],
            ScheduleActionInner::Exit { .. } => &[],
            ScheduleActionInner::WaitForState { .. } => &[],
            ScheduleActionInner::Format { .. } => &[],
            ScheduleActionInner::MatchRegex { .. } => &[],
            ScheduleActionInner::WaitForConsoleLine { .. } => &["control.read-console"],
            ScheduleActionInner::SendPower { action, .. } => match action {
                super::ServerPowerAction::Start => &["control.start"],
                super::ServerPowerAction::Stop => &["control.stop"],
                super::ServerPowerAction::Restart => &["control.restart"],
                super::ServerPowerAction::Kill => &["control.stop"],
            },
            ScheduleActionInner::SendCommand { .. } => &["control.console"],
            ScheduleActionInner::CreateBackup { .. } => &["backups.create"],
            ScheduleActionInner::RestoreBackup { .. } => &["backups.restore"],
            ScheduleActionInner::DeleteBackup { .. } => &["backups.delete"],
            ScheduleActionInner::MoveBackup { .. } => &["backups.update"],
            ScheduleActionInner::CreateDatabaseBackup { .. } => {
                &["backups.create", "database-instances.read"]
            }
            ScheduleActionInner::DeleteDatabaseBackup { .. } => {
                &["backups.delete", "database-instances.read"]
            }
            ScheduleActionInner::MoveDatabaseBackup { .. } => {
                &["backups.update", "database-instances.read"]
            }
            ScheduleActionInner::RestoreDatabaseBackup { .. } => {
                &["backups.restore", "database-instances.read"]
            }
            ScheduleActionInner::CreateDirectory { .. } => &["files.create"],
            ScheduleActionInner::WriteFile { .. } => &["files.update"],
            ScheduleActionInner::CopyFile { .. } => &["files.update"],
            ScheduleActionInner::DeleteFiles { .. } => &["files.delete"],
            ScheduleActionInner::RenameFiles { .. } => &["files.update"],
            ScheduleActionInner::CompressFiles { .. } => &["files.archive"],
            ScheduleActionInner::DecompressFile { .. } => &["files.archive"],
            ScheduleActionInner::PullFile { .. } => &["files.create"],
            ScheduleActionInner::UpdateStartupVariable { .. } => &["startup.update"],
            ScheduleActionInner::UpdateStartupCommand { .. } => &["startup.command"],
            ScheduleActionInner::UpdateStartupDockerImage { .. } => &["startup.docker-image"],
            ScheduleActionInner::HttpRequest { .. } => &[],
        }
    }
}

#[derive(ToSchema, Validate, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
#[non_exhaustive]
pub enum ScheduleTrigger {
    Cron {
        #[garde(skip)]
        #[schema(value_type = String, example = "* * * * * *")]
        schedule: Box<croner::Cron>,
        #[garde(range(min = 1, max = 52))]
        #[schema(minimum = 1, maximum = 52)]
        #[serde(default = "default_week_interval")]
        week_interval: u32,
        #[garde(skip)]
        #[serde(default)]
        week_anchor: Option<chrono::NaiveDate>,
    },
    PowerAction {
        #[garde(skip)]
        action: super::ServerPowerAction,
    },
    ServerState {
        #[garde(skip)]
        state: super::ServerState,
    },
    BackupStatus {
        #[garde(skip)]
        status: ServerBackupStatus,
    },
    DatabaseBackupStatus {
        #[garde(skip)]
        status: ServerBackupStatus,
    },
    ScheduleCompletion {
        #[garde(skip)]
        schedule: uuid::Uuid,
        #[garde(skip)]
        successful: bool,
    },
    ResourceUsage {
        #[garde(skip)]
        metric: ScheduleResourceMetric,
        #[garde(skip)]
        comparator: ScheduleConditionComparator,
        #[garde(range(min = 0.0))]
        value: f64,
        #[garde(range(min = 0, max = 24 * 60 * 60))]
        #[schema(minimum = 0, maximum = 86400)]
        #[serde(default)]
        for_seconds: u64,
    },
    ConsoleLine {
        #[garde(length(chars, min = 1, max = 1024))]
        #[schema(min_length = 1, max_length = 1024)]
        contains: compact_str::CompactString,
        #[garde(skip)]
        #[serde(default)]
        case_insensitive: bool,
        #[garde(dive)]
        output_into: Option<ScheduleVariable>,
    },
    Crash,
}

fn default_week_interval() -> u32 {
    1
}

pub fn next_cron_occurrence<Tz: chrono::TimeZone>(
    schedule: &croner::Cron,
    week_interval: u32,
    week_anchor: Option<chrono::NaiveDate>,
    after: chrono::DateTime<Tz>,
) -> Option<chrono::DateTime<Tz>> {
    let mut candidate = schedule.find_next_occurrence(&after, false).ok()?;
    if week_interval <= 1 {
        return Some(candidate);
    }

    let interval = i64::from(week_interval);
    let anchor = match week_anchor {
        Some(anchor) => anchor,
        None => chrono::NaiveDate::from_ymd_opt(1970, 1, 5)?,
    };

    loop {
        let week = (candidate.date_naive() - anchor).num_days().div_euclid(7);
        let phase = week.rem_euclid(interval);
        if phase == 0 {
            return Some(candidate);
        }

        let window_start = anchor.checked_add_signed(chrono::TimeDelta::try_weeks(
            week.checked_add(interval - phase)?,
        )?)?;
        let timezone = candidate.timezone();
        let window_start = (0..24).find_map(|hour| {
            timezone
                .from_local_datetime(&window_start.and_hms_opt(hour, 0, 0)?)
                .earliest()
        })?;

        candidate = schedule.find_next_occurrence(&window_start, true).ok()?;
    }
}

impl ScheduleTrigger {
    pub fn permissions(&self) -> &'static [&'static str] {
        match self {
            ScheduleTrigger::Cron { .. } => &[],
            ScheduleTrigger::PowerAction { .. } => &[],
            ScheduleTrigger::ServerState { .. } => &[],
            ScheduleTrigger::BackupStatus { .. } => &[],
            ScheduleTrigger::DatabaseBackupStatus { .. } => &[],
            ScheduleTrigger::ScheduleCompletion { .. } => &[],
            ScheduleTrigger::ResourceUsage { .. } => &[],
            ScheduleTrigger::ConsoleLine { .. } => &["control.read-console"],
            ScheduleTrigger::Crash => &[],
        }
    }
}

#[derive(ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleConditionComparator {
    SmallerThan,
    SmallerThanOrEquals,
    Equal,
    GreaterThan,
    GreaterThanOrEquals,
}

#[derive(ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleResourceMetric {
    Cpu,
    Memory,
    Disk,
}

#[derive(ToSchema, Deserialize, Serialize, Clone, Validate)]
#[serde(rename_all = "snake_case", tag = "type")]
#[schema(no_recursion)]
pub enum ScheduleCondition {
    None,
    And {
        #[garde(dive)]
        conditions: Vec<ScheduleCondition>,
    },
    Or {
        #[garde(dive)]
        conditions: Vec<ScheduleCondition>,
    },
    Not {
        #[garde(dive)]
        condition: Box<ScheduleCondition>,
    },
    ServerState {
        #[garde(skip)]
        state: super::ServerState,
    },
    Uptime {
        #[garde(skip)]
        comparator: ScheduleConditionComparator,
        #[garde(skip)]
        value: u64,
    },
    ResourceUsage {
        #[garde(skip)]
        metric: ScheduleResourceMetric,
        #[garde(skip)]
        comparator: ScheduleConditionComparator,
        #[garde(range(min = 0.0))]
        value: f64,
    },
    FileExists {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        file: String,
    },
    VariableExists {
        #[garde(dive)]
        variable: ScheduleVariable,
    },
    VariableEquals {
        #[garde(dive)]
        variable: ScheduleVariable,
        #[garde(dive)]
        equals: ScheduleDynamicParameter,
    },
    VariableContains {
        #[garde(dive)]
        variable: ScheduleVariable,
        #[garde(dive)]
        contains: ScheduleDynamicParameter,
    },
    VariableStartsWith {
        #[garde(dive)]
        variable: ScheduleVariable,
        #[garde(dive)]
        starts_with: ScheduleDynamicParameter,
    },
    VariableEndsWith {
        #[garde(dive)]
        variable: ScheduleVariable,
        #[garde(dive)]
        ends_with: ScheduleDynamicParameter,
    },
}

impl ScheduleCondition {
    pub const MAX_NESTING_DEPTH: usize = 3;

    fn nested_within_limit(&self, depth: usize) -> bool {
        match self {
            ScheduleCondition::And { conditions } | ScheduleCondition::Or { conditions } => {
                depth < Self::MAX_NESTING_DEPTH
                    && conditions.iter().all(|c| c.nested_within_limit(depth + 1))
            }
            ScheduleCondition::Not { condition } => {
                depth < Self::MAX_NESTING_DEPTH && condition.nested_within_limit(depth + 1)
            }
            _ => true,
        }
    }

    pub fn validate_nesting(value: &Self, _context: &()) -> garde::Result {
        if value.nested_within_limit(0) {
            Ok(())
        } else {
            Err(garde::Error::new(format!(
                "condition may not nest groups more than {} levels deep",
                Self::MAX_NESTING_DEPTH
            )))
        }
    }

    pub fn validate_optional_nesting(value: &Option<Self>, context: &()) -> garde::Result {
        match value {
            Some(condition) => Self::validate_nesting(condition, context),
            None => Ok(()),
        }
    }
}

// mirrors wings config::FORBIDDEN_PATHS
pub const FORBIDDEN_CONFIG_PATHS: &[&str] = &[
    "uuid",
    "token",
    "token_id",
    "remote",
    "remote_headers",
    "system.root_directory",
    "system.log_directory",
    "system.data",
    "system.diffs_directory",
    "system.vmount_directory",
    "system.archive_directory",
    "system.backup_directory",
    "system.tmp_directory",
    "system.passwd.directory",
    "system.backups.restic.repository",
    "system.backups.restic.password_file",
    "system.backups.restic.environment",
    "system.backups.mounting.path",
    "system.username",
    "system.user",
    "system.passwd",
    "docker.socket",
    "docker.lxcfs.directory",
    "tundra.data_directory",
    "tundra.binary",
    "tundra.image",
    "tundra.source_image",
    "allowed_mounts",
    "allowed_devices",
    "ignore_panel_config_updates",
    "ignore_panel_wings_upgrades",
    "api.host",
    "api.port",
    "api.ssl",
    "api.trusted_proxies",
    "api.disable_remote_download",
    "api.remote_download_blocked_cidrs",
    "api.schedule.steps.http_request",
];

/// Config paths holding secrets, `*` matching every key of a map.
pub const SECRET_CONFIG_PATHS: &[&str] = &[
    "token",
    "token_id",
    "remote_headers.*",
    "docker.registries.*.password",
    "docker.log_config.config.*",
    "system.backups.restic.environment.*",
];

pub fn strip_config_paths(value: &mut serde_json::Value) -> Vec<&'static str> {
    let mut stripped = Vec::new();

    for path in FORBIDDEN_CONFIG_PATHS {
        let mut cursor = &mut *value;
        let mut parts = path.split('.').peekable();

        while let Some(part) = parts.next() {
            let serde_json::Value::Object(map) = cursor else {
                break;
            };

            if parts.peek().is_none() {
                if map.remove(part).is_some() {
                    stripped.push(*path);
                }
                break;
            }

            if map.get(part).is_some_and(|next| !next.is_object()) {
                map.remove(part);
                stripped.push(*path);
                break;
            }

            match map.get_mut(part) {
                Some(next) => cursor = next,
                None => break,
            }
        }
    }

    stripped
}

/// What a node reports about the tundra mesh daemon it manages. Hand-written rather than
/// generated because the panel drives these routes directly, not through the shim.
#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
pub struct TundraStatus {
    /// False covers both a node that cannot run the mesh and one with it turned off.
    pub supported: bool,
    pub connected: bool,
    pub epoch: Option<u64>,
}

/// The mesh daemon reports considerably more than this - per-path congestion detail, UDP
/// socket counters, restart handover state - and serde drops what is not declared here. The
/// fields below are the ones the panel renders, so a daemon that stops sending one fails
/// deserialization on the panel rather than the browser.
#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
pub struct TundraMetrics {
    pub node: TundraNodeMetrics,
    pub peers: Vec<TundraPeerMetrics>,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
pub struct TundraNodeMetrics {
    pub uptime_secs: u64,
    pub epoch: u64,
    /// "up" or "down", the state of the daemon's control link back to the panel.
    pub remote_link: compact_str::CompactString,
    pub frontends: u64,
    pub snapshots_applied: u64,
    pub local_flows_open: u64,
    pub local_drops: u64,
    pub frozen_flows: u64,
    pub peers_connected: u64,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
pub struct TundraPeerMetrics {
    pub uuid: uuid::Uuid,
    pub name: compact_str::CompactString,
    /// "initiator" when this node dialled the peer, "acceptor" when the peer dialled it.
    pub role: compact_str::CompactString,
    pub remote_addr: compact_str::CompactString,
    pub established_secs: u64,

    pub path: TundraPeerPathMetrics,
    pub relay: TundraPeerRelayMetrics,
    pub flows: TundraPeerFlowMetrics,
    pub drops: TundraPeerDropMetrics,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
pub struct TundraPeerPathMetrics {
    pub rtt_ms: f64,
    pub current_mtu: u16,
    pub lost_packets: u64,
    pub congestion_events: u64,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
pub struct TundraPeerRelayMetrics {
    pub stream_bytes_in: u64,
    pub stream_bytes_out: u64,
    pub datagram_bytes_in: u64,
    pub datagram_bytes_out: u64,
    pub streams_open: u64,
    pub streams_total: u64,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
pub struct TundraPeerFlowMetrics {
    pub open: u64,
    pub opened_total: u64,
    pub tcp_open: u64,
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone)]
pub struct TundraPeerDropMetrics {
    pub send_buffer_full: u64,
    pub unknown_flow: u64,
    pub frag_timeout: u64,
    pub frag_limit: u64,
    pub oversize: u64,
    pub malformed: u64,
}

impl super::client::WingsClient {
    async fn tundra_json<T: serde::de::DeserializeOwned>(
        &self,
        method: reqwest::Method,
        endpoint: &str,
    ) -> Result<T, super::client::ApiHttpError> {
        let response = self
            .request_raw(method, endpoint)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(super::client::ApiHttpError::Reqwest)?;

        let status = response.status();
        if !status.is_success() {
            return Err(super::client::ApiHttpError::Http(
                status,
                response
                    .json::<super::ApiError>()
                    .await
                    .unwrap_or_else(|err| super::ApiError {
                        error: err.to_string().into(),
                    }),
            ));
        }

        response
            .json()
            .await
            .map_err(super::client::ApiHttpError::Reqwest)
    }

    pub async fn get_tundra(&self) -> Result<TundraStatus, super::client::ApiHttpError> {
        self.tundra_json(reqwest::Method::GET, "/api/tundra").await
    }

    /// Latency reduction only - the node polls the panel on its own schedule regardless.
    pub async fn post_tundra_sync(&self) -> Result<(), super::client::ApiHttpError> {
        self.tundra_json::<serde::de::IgnoredAny>(reqwest::Method::POST, "/api/tundra/sync")
            .await?;

        Ok(())
    }

    /// Rotates the token the node's daemon authenticates with and drops its websocket.
    pub async fn post_tundra_rotate(&self) -> Result<(), super::client::ApiHttpError> {
        self.tundra_json::<serde::de::IgnoredAny>(reqwest::Method::POST, "/api/tundra/rotate")
            .await?;

        Ok(())
    }

    pub async fn get_tundra_metrics(&self) -> Result<TundraMetrics, super::client::ApiHttpError> {
        self.tundra_json(reqwest::Method::GET, "/api/tundra/metrics")
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encode(value: &impl Serialize) -> Vec<u8> {
        let mut bytes = Vec::new();
        let mut serializer = rmp_serde::Serializer::new(&mut bytes)
            .with_struct_map()
            .with_human_readable();
        value.serialize(&mut serializer).unwrap();

        bytes
    }

    #[test]
    fn search_content_matches_preserve_older_node_omission() {
        for (payload, expected_present) in [
            (serde_json::json!({ "results": [] }), false),
            (
                serde_json::json!({ "results": [], "content_matches": [] }),
                true,
            ),
        ] {
            let response: crate::servers_server_files_search::post::Response =
                rmp_serde::from_slice(&encode(&payload)).unwrap();

            assert!(response.results.is_empty());
            assert_eq!(response.content_matches.is_some(), expected_present);
        }
    }

    #[test]
    fn file_content_response_preserves_text_and_nullable_line_bounds() {
        let payload = serde_json::json!({
            "results": [],
            "content_matches": [{
                "file": "test.txt",
                "truncated": false,
                "blocks": [{
                    "start_line": 3,
                    "end_line": 4,
                    "content": "é\r\nHello\r\n",
                    "matches": [{ "start_byte": 4, "end_byte": 9 }],
                }],
            }],
        });
        let response: crate::servers_server_files_search::post::Response =
            rmp_serde::from_slice(&encode(&payload)).unwrap();
        assert_eq!(serde_json::to_value(response).unwrap(), payload);

        for payload in [
            serde_json::json!({
                "start_line": null, "end_line": null, "content": "", "eof": true,
            }),
            serde_json::json!({
                "start_line": 3, "end_line": 4, "content": "é\r\nHello\r\n", "eof": false,
            }),
        ] {
            let response: crate::servers_server_files_lines::get::Response =
                rmp_serde::from_slice(&encode(&payload)).unwrap();
            assert_eq!(serde_json::to_value(response).unwrap(), payload);
        }
    }

    /// The generated client sends the compat properties that were taken out of the `RequestBody`
    /// structs through a flattened overlay, which makes the outer map an unknown-length one. Assert
    /// rmp-serde still writes exactly what a plain struct would, since a mismatch would only ever
    /// show up against a real node.
    #[test]
    fn overlay_matches_flat_body() {
        #[derive(Serialize)]
        struct Inner {
            root: compact_str::CompactString,
            files: Vec<compact_str::CompactString>,
            nested: Vec<Nested>,
            foreground: Option<bool>,
        }

        #[derive(Serialize)]
        struct Nested {
            #[serde(rename = "toName")]
            to_name: compact_str::CompactString,
        }

        #[derive(Serialize)]
        struct Overlay<'a> {
            #[serde(flatten)]
            inner: &'a Inner,
            ignored: &'a Vec<compact_str::CompactString>,
        }

        #[derive(Serialize)]
        struct Flat {
            root: compact_str::CompactString,
            files: Vec<compact_str::CompactString>,
            nested: Vec<Nested>,
            foreground: Option<bool>,
            ignored: Vec<compact_str::CompactString>,
        }

        let ignored = vec!["*.log".into(), "secret/**".into()];
        let inner = Inner {
            root: "/".into(),
            files: vec!["a.txt".into()],
            nested: vec![Nested {
                to_name: "b.txt".into(),
            }],
            foreground: Some(true),
        };

        assert_eq!(
            encode(&Overlay {
                inner: &inner,
                ignored: &ignored,
            }),
            encode(&Flat {
                root: inner.root.clone(),
                files: inner.files.clone(),
                nested: vec![Nested {
                    to_name: "b.txt".into(),
                }],
                foreground: inner.foreground,
                ignored,
            })
        );
    }
}
