use super::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, ToSchema, Serialize, Deserialize)]
pub struct AppSettingsServer {
    pub max_file_manager_view_size: u64,
    pub max_file_manager_content_search_size: u64,
    pub max_file_manager_search_results: u64,
    pub max_subuser_count: u64,
    pub max_schedule_step_count: u64,

    pub allow_overwriting_custom_docker_image: bool,
    pub allow_viewing_installation_logs: bool,
    pub allow_acknowledging_installation_failure: bool,
    pub allow_viewing_transfer_progress: bool,
}

#[async_trait::async_trait]
impl SettingsSerializeExt for AppSettingsServer {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_raw_setting(
                "max_file_manager_view_size",
                self.max_file_manager_view_size.to_compact_string(),
            )
            .write_raw_setting(
                "max_file_manager_content_search_size",
                self.max_file_manager_content_search_size
                    .to_compact_string(),
            )
            .write_raw_setting(
                "max_file_manager_search_results",
                self.max_file_manager_search_results.to_compact_string(),
            )
            .write_raw_setting(
                "max_subuser_count",
                self.max_subuser_count.to_compact_string(),
            )
            .write_raw_setting(
                "max_schedule_step_count",
                self.max_schedule_step_count.to_compact_string(),
            )
            .write_raw_setting(
                "allow_overwriting_custom_docker_image",
                self.allow_overwriting_custom_docker_image
                    .to_compact_string(),
            )
            .write_raw_setting(
                "allow_viewing_installation_logs",
                self.allow_viewing_installation_logs.to_compact_string(),
            )
            .write_raw_setting(
                "allow_acknowledging_installation_failure",
                self.allow_acknowledging_installation_failure
                    .to_compact_string(),
            )
            .write_raw_setting(
                "allow_viewing_transfer_progress",
                self.allow_viewing_transfer_progress.to_compact_string(),
            ))
    }
}

pub struct AppSettingsServerDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for AppSettingsServerDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        Ok(Box::new(AppSettingsServer {
            max_file_manager_view_size: deserializer
                .take_raw_setting("max_file_manager_view_size")
                .and_then(|s| s.parse().ok())
                .unwrap_or(10 * 1024 * 1024),
            max_file_manager_content_search_size: deserializer
                .take_raw_setting("max_file_manager_content_search_size")
                .and_then(|s| s.parse().ok())
                .unwrap_or(5 * 1024 * 1024),
            max_file_manager_search_results: deserializer
                .take_raw_setting("max_file_manager_search_results")
                .and_then(|s| s.parse().ok())
                .unwrap_or(100),
            max_subuser_count: deserializer
                .take_raw_setting("max_subuser_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(25),
            max_schedule_step_count: deserializer
                .take_raw_setting("max_schedule_step_count")
                .and_then(|s| s.parse().ok())
                .unwrap_or(50),
            allow_overwriting_custom_docker_image: deserializer
                .take_raw_setting("allow_overwriting_custom_docker_image")
                .map(|s| s == "true")
                .unwrap_or(true),
            allow_viewing_installation_logs: deserializer
                .take_raw_setting("allow_viewing_installation_logs")
                .map(|s| s == "true")
                .unwrap_or(true),
            allow_acknowledging_installation_failure: deserializer
                .take_raw_setting("allow_acknowledging_installation_failure")
                .map(|s| s == "true")
                .unwrap_or(true),
            allow_viewing_transfer_progress: deserializer
                .take_raw_setting("allow_viewing_transfer_progress")
                .map(|s| s == "true")
                .unwrap_or(true),
        }))
    }
}
