use super::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum TwoFactorRequirement {
    Admins,
    AllUsers,
    None,
}

#[derive(Clone, ToSchema, Serialize, Deserialize)]
pub struct AppSettingsApp {
    pub name: compact_str::CompactString,
    pub icon: compact_str::CompactString,
    pub url: compact_str::CompactString,
    pub language: compact_str::CompactString,
    pub two_factor_requirement: TwoFactorRequirement,

    pub telemetry_enabled: bool,
    pub registration_enabled: bool,
    pub language_change_enabled: bool,
}

#[async_trait::async_trait]
impl SettingsSerializeExt for AppSettingsApp {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_raw_setting("name", &*self.name)
            .write_raw_setting("icon", &*self.icon)
            .write_raw_setting("url", &*self.url)
            .write_raw_setting("language", &*self.language)
            .write_raw_setting(
                "two_factor_requirement",
                match self.two_factor_requirement {
                    TwoFactorRequirement::Admins => "admins",
                    TwoFactorRequirement::AllUsers => "all_users",
                    TwoFactorRequirement::None => "none",
                },
            )
            .write_raw_setting(
                "telemetry_enabled",
                self.telemetry_enabled.to_compact_string(),
            )
            .write_raw_setting(
                "registration_enabled",
                self.registration_enabled.to_compact_string(),
            )
            .write_raw_setting(
                "language_change_enabled",
                self.language_change_enabled.to_compact_string(),
            ))
    }
}

pub struct AppSettingsAppDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for AppSettingsAppDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        Ok(Box::new(AppSettingsApp {
            name: deserializer
                .take_raw_setting("name")
                .unwrap_or_else(|| "Calagopus".into()),
            icon: deserializer
                .take_raw_setting("icon")
                .unwrap_or_else(|| "/icon.svg".into()),
            url: deserializer
                .take_raw_setting("url")
                .unwrap_or_else(|| "http://localhost:8000".into()),
            language: deserializer
                .take_raw_setting("language")
                .unwrap_or_else(|| "en".into()),
            two_factor_requirement: match deserializer
                .take_raw_setting("two_factor_requirement")
                .as_deref()
            {
                Some("admins") => TwoFactorRequirement::Admins,
                Some("all_users") => TwoFactorRequirement::AllUsers,
                _ => TwoFactorRequirement::None,
            },
            telemetry_enabled: deserializer
                .take_raw_setting("telemetry_enabled")
                .map(|s| s == "true")
                .unwrap_or(true),
            registration_enabled: deserializer
                .take_raw_setting("registration_enabled")
                .map(|s| s == "true")
                .unwrap_or(true),
            language_change_enabled: deserializer
                .take_raw_setting("language_change_enabled")
                .map(|s| s == "true")
                .unwrap_or(true),
        }))
    }
}
