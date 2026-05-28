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

    pub allow_changing_language: bool,
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
                "allow_changing_language",
                self.allow_changing_language.to_compact_string(),
            ))
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
            allow_changing_language: deserializer
                .take_raw_setting("allow_changing_language")
                .map(|s| s == "true")
                .unwrap_or(true),
        }))
    }
}
