use super::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};
use crate::{
    censor::{CENSORED_PLACEHOLDER, Censor},
    models::user::PermissionManager,
    prelude::{AsyncOptionExt, StringExt},
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, ToSchema, Serialize, Deserialize)]
pub struct AppSettingsUpdates {
    pub wings_release_token: Option<compact_str::CompactString>,
    pub db_agent_release_token: Option<compact_str::CompactString>,
}

impl AppSettingsUpdates {
    pub fn wings_release_token_for(
        &self,
        permissions: &PermissionManager,
    ) -> Option<compact_str::CompactString> {
        Self::release_token_for(&self.wings_release_token, permissions)
    }

    pub fn db_agent_release_token_for(
        &self,
        permissions: &PermissionManager,
    ) -> Option<compact_str::CompactString> {
        Self::release_token_for(&self.db_agent_release_token, permissions)
    }

    fn release_token_for(
        token: &Option<compact_str::CompactString>,
        permissions: &PermissionManager,
    ) -> Option<compact_str::CompactString> {
        if permissions.has_admin_permission("settings.read").is_ok() {
            token.clone()
        } else {
            None
        }
    }
}

impl Censor for AppSettingsUpdates {
    fn censor(&mut self) {
        if let Some(wings_release_token) = &mut self.wings_release_token {
            *wings_release_token = CENSORED_PLACEHOLDER.into();
        }
        if let Some(db_agent_release_token) = &mut self.db_agent_release_token {
            *db_agent_release_token = CENSORED_PLACEHOLDER.into();
        }
    }
}

#[async_trait::async_trait]
impl SettingsSerializeExt for AppSettingsUpdates {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        let database = serializer.database.clone();

        Ok(serializer
            .write_raw_setting(
                "wings_release_token",
                if let Some(t) = &self.wings_release_token {
                    base32::encode(base32::Alphabet::Z, &database.encrypt(t.clone()).await?)
                } else {
                    "".into()
                },
            )
            .write_raw_setting(
                "db_agent_release_token",
                if let Some(t) = &self.db_agent_release_token {
                    base32::encode(base32::Alphabet::Z, &database.encrypt(t.clone()).await?)
                } else {
                    "".into()
                },
            ))
    }
}

impl AppSettingsUpdates {
    #[cfg(test)]
    pub fn mock() -> Self {
        Self {
            wings_release_token: None,
            db_agent_release_token: None,
        }
    }
}

pub struct AppSettingsUpdatesDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for AppSettingsUpdatesDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        Ok(Box::new(AppSettingsUpdates {
            wings_release_token: if let Some(wings_release_token) = deserializer
                .take_raw_setting("wings_release_token")
                .and_then(|s| s.into_optional())
            {
                base32::decode(base32::Alphabet::Z, &wings_release_token)
                    .map(|encrypted| deserializer.database.decrypt(encrypted))
                    .awaited()
                    .await
                    .transpose()?
            } else {
                None
            },
            db_agent_release_token: if let Some(db_agent_release_token) = deserializer
                .take_raw_setting("db_agent_release_token")
                .and_then(|s| s.into_optional())
            {
                base32::decode(base32::Alphabet::Z, &db_agent_release_token)
                    .map(|encrypted| deserializer.database.decrypt(encrypted))
                    .awaited()
                    .await
                    .transpose()?
            } else {
                None
            },
        }))
    }
}
