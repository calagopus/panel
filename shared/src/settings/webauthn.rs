use super::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, ToSchema, Serialize, Deserialize)]
pub struct AppSettingsWebauthn {
    pub enabled: bool,
    pub allow_discoverable: bool,

    pub rp_id: compact_str::CompactString,
    pub rp_origin: compact_str::CompactString,

    pub authentication_timeout_seconds: u64,
    pub registration_timeout_seconds: u64,
}

#[async_trait::async_trait]
impl SettingsSerializeExt for AppSettingsWebauthn {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_raw_setting("enabled", self.enabled.to_compact_string())
            .write_raw_setting(
                "allow_discoverable",
                self.allow_discoverable.to_compact_string(),
            )
            .write_raw_setting("rp_id", &*self.rp_id)
            .write_raw_setting("rp_origin", &*self.rp_origin)
            .write_raw_setting(
                "authentication_timeout_seconds",
                self.authentication_timeout_seconds.to_compact_string(),
            )
            .write_raw_setting(
                "registration_timeout_seconds",
                self.registration_timeout_seconds.to_compact_string(),
            ))
    }
}

impl AppSettingsWebauthn {
    #[cfg(test)]
    pub fn mock() -> Self {
        Self {
            enabled: true,
            allow_discoverable: true,
            rp_id: "localhost".into(),
            rp_origin: "http://localhost".into(),
            authentication_timeout_seconds: 300,
            registration_timeout_seconds: 300,
        }
    }
}

pub struct AppSettingsWebauthnDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for AppSettingsWebauthnDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        Ok(Box::new(AppSettingsWebauthn {
            enabled: deserializer
                .take_raw_setting("enabled")
                .map(|s| s == "true")
                .unwrap_or(true),
            allow_discoverable: deserializer
                .take_raw_setting("allow_discoverable")
                .map(|s| s == "true")
                .unwrap_or(true),
            rp_id: deserializer
                .take_raw_setting("rp_id")
                .unwrap_or_else(|| "localhost".into()),
            rp_origin: deserializer
                .take_raw_setting("rp_origin")
                .unwrap_or_else(|| "http://localhost".into()),
            authentication_timeout_seconds: deserializer
                .take_raw_setting("authentication_timeout_seconds")
                .and_then(|s| s.parse().ok())
                .unwrap_or(300),
            registration_timeout_seconds: deserializer
                .take_raw_setting("registration_timeout_seconds")
                .and_then(|s| s.parse().ok())
                .unwrap_or(300),
        }))
    }
}
