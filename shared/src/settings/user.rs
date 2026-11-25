use super::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, ToSchema, Serialize, Deserialize)]
pub struct AppSettingsUser {
    pub max_server_group_count: u64,
    pub max_api_key_count: u64,
    pub max_command_snippet_count: u64,
    pub max_security_key_count: u64,
    pub max_ssh_key_count: u64,
    pub max_settings_count: u64,
    pub max_settings_value_bytes: u64,
    pub max_team_count: u64,
    pub max_team_member_count: u64,
    pub max_team_preset_count: u64,

    pub allow_changing_language: bool,
    pub allow_changing_avatar: bool,
    pub allow_creating_teams: bool,

    pub route_order: Option<Vec<super::RouteOrderItem>>,
}

#[async_trait::async_trait]
impl SettingsSerializeExt for AppSettingsUser {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_raw_setting(
                "max_server_group_count",
                self.max_server_group_count.to_compact_string(),
            )
            .write_raw_setting(
                "max_api_key_count",
                self.max_api_key_count.to_compact_string(),
            )
            .write_raw_setting(
                "max_command_snippet_count",
                self.max_command_snippet_count.to_compact_string(),
            )
            .write_raw_setting(
                "max_security_key_count",
                self.max_security_key_count.to_compact_string(),
            )
            .write_raw_setting(
                "max_ssh_key_count",
                self.max_ssh_key_count.to_compact_string(),
            )
            .write_raw_setting(
                "max_settings_count",
                self.max_settings_count.to_compact_string(),
            )
            .write_raw_setting(
                "max_settings_value_bytes",
                self.max_settings_value_bytes.to_compact_string(),
            )
            .write_raw_setting("max_team_count", self.max_team_count.to_compact_string())
            .write_raw_setting(
                "max_team_member_count",
                self.max_team_member_count.to_compact_string(),
            )
            .write_raw_setting(
                "max_team_preset_count",
                self.max_team_preset_count.to_compact_string(),
            )
            .write_raw_setting(
                "allow_changing_language",
                self.allow_changing_language.to_compact_string(),
            )
            .write_raw_setting(
                "allow_changing_avatar",
                self.allow_changing_avatar.to_compact_string(),
            )
            .write_raw_setting(
                "allow_creating_teams",
                self.allow_creating_teams.to_compact_string(),
            )
            .write_serde_setting("route_order", &self.route_order)?)
    }
}

impl AppSettingsUser {
    #[cfg(test)]
    pub fn mock() -> Self {
        Self {
            max_server_group_count: 25,
            max_api_key_count: 50,
            max_command_snippet_count: 100,
            max_security_key_count: 50,
            max_ssh_key_count: 50,
            max_settings_count: 512,
            max_settings_value_bytes: 16384,
            max_team_count: 10,
            max_team_member_count: 50,
            max_team_preset_count: 25,
            allow_changing_language: true,
            allow_changing_avatar: true,
            allow_creating_teams: true,
            route_order: Default::default(),
        }
    }
}

pub struct AppSettingsUserDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for AppSettingsUserDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        Ok(Box::new(AppSettingsUser {
            max_server_group_count: deserializer
                .take_raw_setting("max_server_group_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(25),
            max_api_key_count: deserializer
                .take_raw_setting("max_api_key_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(50),
            max_command_snippet_count: deserializer
                .take_raw_setting("max_command_snippet_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(100),
            max_security_key_count: deserializer
                .take_raw_setting("max_security_key_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(50),
            max_ssh_key_count: deserializer
                .take_raw_setting("max_ssh_key_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(50),
            max_settings_count: deserializer
                .take_raw_setting("max_settings_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(512),
            max_settings_value_bytes: deserializer
                .take_raw_setting("max_settings_value_bytes")
                .and_then(|s| s.parse().ok())
                .unwrap_or(16384),
            max_team_count: deserializer
                .take_raw_setting("max_team_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(10),
            max_team_member_count: deserializer
                .take_raw_setting("max_team_member_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(50),
            max_team_preset_count: deserializer
                .take_raw_setting("max_team_preset_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(25),
            allow_changing_language: deserializer
                .take_raw_setting("allow_changing_language")
                .map(|s| s == "true")
                .unwrap_or(true),
            allow_changing_avatar: deserializer
                .take_raw_setting("allow_changing_avatar")
                .map(|s| s == "true")
                .unwrap_or(true),
            allow_creating_teams: deserializer
                .take_raw_setting("allow_creating_teams")
                .map(|s| s == "true")
                .unwrap_or(true),
            route_order: deserializer
                .read_serde_setting("route_order")
                .unwrap_or_default(),
        }))
    }
}
