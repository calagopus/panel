use serde::de::DeserializeOwned;
use std::{
    collections::BTreeMap,
    ops::{Deref, DerefMut},
};

pub type UserSettingsMap = BTreeMap<compact_str::CompactString, serde_json::Value>;

#[inline]
fn cache_key(user_uuid: uuid::Uuid) -> String {
    format!("user::{user_uuid}::settings")
}

pub fn validate_settings_keys(
    settings: &UserSettingsMap,
    _context: &(),
) -> Result<(), garde::Error> {
    for key in settings.keys() {
        if key.is_empty() || key.len() > 512 {
            return Err(garde::Error::new(format!(
                "key '{}' must be between 1 and 512 characters",
                key
            )));
        }
    }

    Ok(())
}

async fn fetch_settings(
    database: &crate::database::Database,
    user_uuid: uuid::Uuid,
) -> Result<UserSettingsMap, anyhow::Error> {
    database
        .cache
        .cached(&cache_key(user_uuid), 60, || async {
            let row = sqlx::query_scalar(
                r#"
                SELECT user_settings.settings
                FROM user_settings
                WHERE user_settings.user_uuid = $1
                "#,
            )
            .bind(user_uuid)
            .fetch_optional(database.read())
            .await?;

            Ok::<_, anyhow::Error>(match row {
                Some(settings) => serde_json::from_value(settings)?,
                None => UserSettingsMap::new(),
            })
        })
        .await
}

impl super::User {
    /// Returns the settings of this user for reading.
    ///
    /// Cached for 60 seconds, invalidated by [`UserSettingsMut::save`].
    pub async fn get_settings(
        &self,
        database: &crate::database::Database,
    ) -> Result<UserSettings, anyhow::Error> {
        Ok(UserSettings {
            settings: fetch_settings(database, self.uuid).await?,
        })
    }

    /// Returns the settings of this user for modification, holding a lock that serializes
    /// concurrent writers until the returned guard is dropped. Changes are only persisted
    /// by [`UserSettingsMut::save`].
    pub async fn get_settings_mut(
        &self,
        database: &crate::database::Database,
    ) -> Result<UserSettingsMut, anyhow::Error> {
        let lock = database
            .cache
            .lock(format!("users::{}::settings", self.uuid), Some(30), Some(5))
            .await?;

        Ok(UserSettingsMut {
            user_uuid: self.uuid,
            settings: fetch_settings(database, self.uuid).await?,
            _lock: lock,
        })
    }
}

pub struct UserSettings {
    settings: UserSettingsMap,
}

impl UserSettings {
    /// Deserializes the setting stored at `key` into `T`. Returns `None` when the key is
    /// not set or its value does not match `T`.
    pub fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        self.settings
            .get(key)
            .and_then(|value| serde_json::from_value(value.clone()).ok())
    }
}

impl Deref for UserSettings {
    type Target = UserSettingsMap;

    fn deref(&self) -> &Self::Target {
        &self.settings
    }
}

impl serde::Serialize for UserSettings {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.settings.serialize(serializer)
    }
}

pub struct UserSettingsMut {
    user_uuid: uuid::Uuid,
    settings: UserSettingsMap,
    _lock: crate::cache::CacheLock,
}

impl UserSettingsMut {
    pub async fn save(
        self,
        database: &crate::database::Database,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO user_settings (user_uuid, settings)
            VALUES ($1, $2)
            ON CONFLICT (user_uuid) DO UPDATE SET settings = EXCLUDED.settings
            "#,
        )
        .bind(self.user_uuid)
        .bind(serde_json::to_value(&self.settings)?)
        .execute(database.write())
        .await?;

        database
            .cache
            .invalidate(&cache_key(self.user_uuid))
            .await?;

        Ok(())
    }
}

impl Deref for UserSettingsMut {
    type Target = UserSettingsMap;

    fn deref(&self) -> &Self::Target {
        &self.settings
    }
}

impl DerefMut for UserSettingsMut {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.settings
    }
}
