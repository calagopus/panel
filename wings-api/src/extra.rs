use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub type Config = super::system_config::get::Response200;

#[derive(Debug, ToSchema, Deserialize, Serialize, Default, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[schema(rename_all = "snake_case")]
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
#[schema(rename_all = "lowercase")]
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

#[derive(ToSchema, Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
#[schema(rename_all = "lowercase")]
pub enum ServerBackupStatus {
    Starting,
    Finished,
    Failed,
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

#[derive(Debug, ToSchema, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[schema(rename_all = "snake_case")]
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

#[derive(ToSchema, Clone, Deserialize, Serialize)]
pub struct ScheduleVariable {
    pub variable: compact_str::CompactString,
}

#[derive(ToSchema, Clone, Deserialize, Serialize)]
#[serde(untagged)]
pub enum ScheduleDynamicParameter {
    Raw(compact_str::CompactString),
    Variable(ScheduleVariable),
}

#[derive(ToSchema, Deserialize, Serialize)]
pub struct ScheduleAction {
    pub uuid: uuid::Uuid,

    #[serde(flatten)]
    pub inner: ScheduleActionInner,
}

#[derive(ToSchema, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
#[schema(rename_all = "snake_case")]
pub enum ScheduleActionInner {
    Sleep {
        duration: u64,
    },
    Ensure {
        condition: ScheduleCondition,
    },
    Format {
        format: String,
        output_into: ScheduleVariable,
    },
    MatchRegex {
        input: ScheduleDynamicParameter,

        #[serde(with = "serde_regex")]
        #[schema(value_type = String, format = "regex")]
        regex: regex::Regex,

        output_into: Vec<Option<ScheduleVariable>>,
    },
    WaitForConsoleLine {
        ignore_failure: bool,

        contains: ScheduleDynamicParameter,
        timeout: u64,

        output_into: Option<ScheduleVariable>,
    },
    SendPower {
        ignore_failure: bool,

        action: super::ServerPowerAction,
    },
    SendCommand {
        ignore_failure: bool,

        command: ScheduleDynamicParameter,
    },
    CreateBackup {
        ignore_failure: bool,
        foreground: bool,

        name: Option<ScheduleDynamicParameter>,
        ignored_files: Vec<compact_str::CompactString>,
    },
    CreateDirectory {
        ignore_failure: bool,

        root: ScheduleDynamicParameter,
        name: ScheduleDynamicParameter,
    },
    WriteFile {
        ignore_failure: bool,
        append: bool,

        file: ScheduleDynamicParameter,
        content: ScheduleDynamicParameter,
    },
    CopyFile {
        ignore_failure: bool,
        foreground: bool,

        file: ScheduleDynamicParameter,
        destination: ScheduleDynamicParameter,
    },
    DeleteFiles {
        root: ScheduleDynamicParameter,
        files: Vec<compact_str::CompactString>,
    },
    RenameFiles {
        root: ScheduleDynamicParameter,
        files: Vec<super::servers_server_files_rename::put::RequestBodyFiles>,
    },
    CompressFiles {
        ignore_failure: bool,
        foreground: bool,

        root: ScheduleDynamicParameter,
        files: Vec<compact_str::CompactString>,
        format: super::ArchiveFormat,
        name: ScheduleDynamicParameter,
    },
    DecompressFile {
        ignore_failure: bool,
        foreground: bool,

        root: ScheduleDynamicParameter,
        file: ScheduleDynamicParameter,
    },
    UpdateStartupVariable {
        ignore_failure: bool,

        env_variable: ScheduleDynamicParameter,
        value: ScheduleDynamicParameter,
    },
    UpdateStartupCommand {
        ignore_failure: bool,

        command: ScheduleDynamicParameter,
    },
    UpdateStartupDockerImage {
        ignore_failure: bool,

        image: ScheduleDynamicParameter,
    },
}

#[derive(ToSchema, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
#[schema(rename_all = "snake_case")]
pub enum ScheduleTrigger {
    Cron {
        #[schema(value_type = String, example = "* * * * * *")]
        schedule: Box<cron::Schedule>,
    },
    PowerAction {
        action: super::ServerPowerAction,
    },
    ServerState {
        state: super::ServerState,
    },
    BackupStatus {
        status: ServerBackupStatus,
    },
    ConsoleLine {
        contains: String,
        output_into: Option<ScheduleVariable>,
    },
    Crash,
}

#[derive(ToSchema, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
#[schema(rename_all = "snake_case")]
pub enum SchedulePreConditionComparator {
    SmallerThan,
    SmallerThanOrEquals,
    Equal,
    GreaterThan,
    GreaterThanOrEquals,
}

#[derive(ToSchema, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
#[schema(rename_all = "snake_case", no_recursion)]
pub enum SchedulePreCondition {
    None,
    And {
        conditions: Vec<SchedulePreCondition>,
    },
    Or {
        conditions: Vec<SchedulePreCondition>,
    },
    Not {
        condition: Box<SchedulePreCondition>,
    },
    ServerState {
        state: super::ServerState,
    },
    Uptime {
        comparator: SchedulePreConditionComparator,
        value: u64,
    },
    CpuUsage {
        comparator: SchedulePreConditionComparator,
        value: f64,
    },
    MemoryUsage {
        comparator: SchedulePreConditionComparator,
        value: u64,
    },
    DiskUsage {
        comparator: SchedulePreConditionComparator,
        value: u64,
    },
    FileExists {
        file: String,
    },
}

#[derive(ToSchema, Deserialize, Serialize, Clone)]
#[serde(rename_all = "snake_case", tag = "type")]
#[schema(rename_all = "snake_case", no_recursion)]
pub enum ScheduleCondition {
    None,
    And {
        conditions: Vec<ScheduleCondition>,
    },
    Or {
        conditions: Vec<ScheduleCondition>,
    },
    Not {
        condition: Box<ScheduleCondition>,
    },
    VariableExists {
        variable: ScheduleVariable,
    },
    VariableEquals {
        variable: ScheduleVariable,
        equals: ScheduleDynamicParameter,
    },
    VariableContains {
        variable: ScheduleVariable,
        contains: ScheduleDynamicParameter,
    },
    VariableStartsWith {
        variable: ScheduleVariable,
        starts_with: ScheduleDynamicParameter,
    },
    VariableEndsWith {
        variable: ScheduleVariable,
        ends_with: ScheduleDynamicParameter,
    },
}
