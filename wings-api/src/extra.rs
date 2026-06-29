use garde::Validate;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub type Config = super::system_config::get::Response200;

#[derive(Debug, ToSchema, Deserialize, Serialize, Default, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum StreamableArchiveFormat {
    Tar,
    TarGz,
    TarXz,
    TarLzip,
    TarBz2,
    TarLz4,
    TarZstd,
    #[default]
    Zip,
}

impl std::fmt::Display for StreamableArchiveFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                StreamableArchiveFormat::Tar => "tar",
                StreamableArchiveFormat::TarGz => "tar_gz",
                StreamableArchiveFormat::TarXz => "tar_xz",
                StreamableArchiveFormat::TarLzip => "tar_lzip",
                StreamableArchiveFormat::TarBz2 => "tar_bz2",
                StreamableArchiveFormat::TarLz4 => "tar_lz4",
                StreamableArchiveFormat::TarZstd => "tar_zstd",
                StreamableArchiveFormat::Zip => "zip",
            }
        )
    }
}

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
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
    Raw(#[garde(length(chars, min = 1, max = 1024))] compact_str::CompactString),
    Variable(#[garde(dive)] ScheduleVariable),
}

#[derive(ToSchema, Deserialize, Serialize)]
pub struct ScheduleAction {
    pub uuid: uuid::Uuid,

    #[serde(flatten)]
    pub inner: ScheduleActionInner,
}

#[derive(ToSchema, Validate, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
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
    Format {
        #[garde(length(chars, min = 1, max = 2048))]
        #[schema(min_length = 1, max_length = 2048)]
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
        ignored_files: Vec<compact_str::CompactString>,
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
        #[garde(dive)]
        root: ScheduleDynamicParameter,
        #[garde(skip)]
        files: Vec<compact_str::CompactString>,
    },
    RenameFiles {
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
}

impl ScheduleActionInner {
    pub fn permission(&self) -> Option<&'static str> {
        match self {
            ScheduleActionInner::Sleep { .. } => None,
            ScheduleActionInner::Ensure { .. } => None,
            ScheduleActionInner::Format { .. } => None,
            ScheduleActionInner::MatchRegex { .. } => None,
            ScheduleActionInner::WaitForConsoleLine { .. } => Some("control.read-console"),
            ScheduleActionInner::SendPower { action, .. } => match action {
                super::ServerPowerAction::Start => Some("control.start"),
                super::ServerPowerAction::Stop => Some("control.stop"),
                super::ServerPowerAction::Restart => Some("control.restart"),
                super::ServerPowerAction::Kill => Some("control.stop"),
            },
            ScheduleActionInner::SendCommand { .. } => Some("control.console"),
            ScheduleActionInner::CreateBackup { .. } => Some("backups.create"),
            ScheduleActionInner::CreateDirectory { .. } => Some("files.create"),
            ScheduleActionInner::WriteFile { .. } => Some("files.update"),
            ScheduleActionInner::CopyFile { .. } => Some("files.update"),
            ScheduleActionInner::DeleteFiles { .. } => Some("files.delete"),
            ScheduleActionInner::RenameFiles { .. } => Some("files.update"),
            ScheduleActionInner::CompressFiles { .. } => Some("files.archive"),
            ScheduleActionInner::DecompressFile { .. } => Some("files.archive"),
            ScheduleActionInner::UpdateStartupVariable { .. } => Some("startup.update"),
            ScheduleActionInner::UpdateStartupCommand { .. } => Some("startup.command"),
            ScheduleActionInner::UpdateStartupDockerImage { .. } => Some("startup.docker-image"),
        }
    }
}

#[derive(ToSchema, Validate, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum ScheduleTrigger {
    Cron {
        #[garde(skip)]
        #[schema(value_type = String, example = "* * * * * *")]
        schedule: Box<cron::Schedule>,
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

#[derive(ToSchema, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum SchedulePreConditionComparator {
    SmallerThan,
    SmallerThanOrEquals,
    Equal,
    GreaterThan,
    GreaterThanOrEquals,
}

#[derive(ToSchema, Validate, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
#[schema(no_recursion)]
pub enum SchedulePreCondition {
    None,
    And {
        #[garde(dive)]
        conditions: Vec<SchedulePreCondition>,
    },
    Or {
        #[garde(dive)]
        conditions: Vec<SchedulePreCondition>,
    },
    Not {
        #[garde(dive)]
        condition: Box<SchedulePreCondition>,
    },
    ServerState {
        #[garde(skip)]
        state: super::ServerState,
    },
    Uptime {
        #[garde(skip)]
        comparator: SchedulePreConditionComparator,
        #[garde(skip)]
        value: u64,
    },
    CpuUsage {
        #[garde(skip)]
        comparator: SchedulePreConditionComparator,
        #[garde(skip)]
        value: f64,
    },
    MemoryUsage {
        #[garde(skip)]
        comparator: SchedulePreConditionComparator,
        #[garde(skip)]
        value: u64,
    },
    DiskUsage {
        #[garde(skip)]
        comparator: SchedulePreConditionComparator,
        #[garde(skip)]
        value: u64,
    },
    FileExists {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        file: String,
    },
}

impl SchedulePreCondition {
    pub const MAX_NESTING_DEPTH: usize = 3;

    fn nested_within_limit(&self, depth: usize) -> bool {
        match self {
            SchedulePreCondition::And { conditions } | SchedulePreCondition::Or { conditions } => {
                depth < Self::MAX_NESTING_DEPTH
                    && conditions.iter().all(|c| c.nested_within_limit(depth + 1))
            }
            SchedulePreCondition::Not { condition } => {
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
}

const FORBIDDEN_CONFIG_PATHS: &[&str] = &[
    "uuid",
    "token",
    "token_id",
    "remote",
    "remote_headers",
    "system.root_directory",
    "system.log_directory",
    "system.vmount_directory",
    "system.data",
    "system.archive_directory",
    "system.backup_directory",
    "system.tmp_directory",
    "system.passwd.directory",
    "system.backups.restic.repository",
    "system.backups.restic.password_file",
    "system.backups.mounting.path",
    "system.username",
    "system.user",
    "system.passwd",
    "docker.socket",
    "allowed_mounts",
];

pub fn strip_config_paths(value: &mut serde_json::Value) {
    for path in FORBIDDEN_CONFIG_PATHS {
        let mut cursor = &mut *value;
        let mut parts = path.split('.').peekable();

        while let Some(part) = parts.next() {
            let serde_json::Value::Object(map) = cursor else {
                break;
            };

            if parts.peek().is_none() {
                map.remove(part);
                break;
            }

            match map.get_mut(part) {
                Some(next) => cursor = next,
                None => break,
            }
        }
    }
}
