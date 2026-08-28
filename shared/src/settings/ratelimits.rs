use super::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Copy, Validate, ToSchema, Serialize, Deserialize)]
pub struct RatelimitConfiguration {
    #[garde(range(min = 1))]
    pub hits: u64,
    #[garde(range(min = 1))]
    pub window_seconds: u64,
}

#[derive(Clone, ToSchema, Serialize, Deserialize)]
pub struct AppSettingsRatelimits {
    pub auth_register: RatelimitConfiguration,
    pub auth_login: RatelimitConfiguration,
    pub auth_login_checkpoint: RatelimitConfiguration,
    pub auth_login_checkpoint_email: RatelimitConfiguration,
    pub auth_login_security_key: RatelimitConfiguration,
    pub auth_password_forgot: RatelimitConfiguration,
    pub auth_password_reset: RatelimitConfiguration,
    pub auth_email_verification: RatelimitConfiguration,

    pub client: RatelimitConfiguration,
    pub client_account_email_resend_verification: RatelimitConfiguration,
    pub client_servers_backups_create: RatelimitConfiguration,
    pub client_servers_files_pull: RatelimitConfiguration,
    pub client_servers_files_pull_query: RatelimitConfiguration,

    pub remote: RatelimitConfiguration,
    pub remote_sftp_auth: RatelimitConfiguration,
}

#[async_trait::async_trait]
impl SettingsSerializeExt for AppSettingsRatelimits {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_serde_setting("auth_register", &self.auth_register)?
            .write_serde_setting("auth_login", &self.auth_login)?
            .write_serde_setting("auth_login_checkpoint", &self.auth_login_checkpoint)?
            .write_serde_setting(
                "auth_login_checkpoint_email",
                &self.auth_login_checkpoint_email,
            )?
            .write_serde_setting("auth_login_security_key", &self.auth_login_security_key)?
            .write_serde_setting("auth_password_forgot", &self.auth_password_forgot)?
            .write_serde_setting("auth_password_reset", &self.auth_password_reset)?
            .write_serde_setting("auth_email_verification", &self.auth_email_verification)?
            .write_serde_setting("client", &self.client)?
            .write_serde_setting(
                "client_account_email_resend_verification",
                &self.client_account_email_resend_verification,
            )?
            .write_serde_setting(
                "client_servers_backups_create",
                &self.client_servers_backups_create,
            )?
            .write_serde_setting("client_servers_files_pull", &self.client_servers_files_pull)?
            .write_serde_setting(
                "client_servers_files_pull_query",
                &self.client_servers_files_pull_query,
            )?
            .write_serde_setting("remote", &self.remote)?
            .write_serde_setting("remote_sftp_auth", &self.remote_sftp_auth)?)
    }
}

pub struct AppSettingsRatelimitsDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for AppSettingsRatelimitsDeserializer {
    async fn deserialize_boxed(
        &self,
        deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        Ok(Box::new(AppSettingsRatelimits {
            auth_register: deserializer.read_serde_setting("auth_register").unwrap_or(
                RatelimitConfiguration {
                    hits: 10,
                    window_seconds: 3600,
                },
            ),
            auth_login: deserializer.read_serde_setting("auth_login").unwrap_or(
                RatelimitConfiguration {
                    hits: 20,
                    window_seconds: 300,
                },
            ),
            auth_login_checkpoint: deserializer
                .read_serde_setting("auth_login_checkpoint")
                .unwrap_or(RatelimitConfiguration {
                    hits: 10,
                    window_seconds: 300,
                }),
            auth_login_checkpoint_email: deserializer
                .read_serde_setting("auth_login_checkpoint_email")
                .unwrap_or(RatelimitConfiguration {
                    hits: 5,
                    window_seconds: 900,
                }),
            auth_login_security_key: deserializer
                .read_serde_setting("auth_login_security_key")
                .unwrap_or(RatelimitConfiguration {
                    hits: 10,
                    window_seconds: 300,
                }),
            auth_password_forgot: deserializer
                .read_serde_setting("auth_password_forgot")
                .unwrap_or(RatelimitConfiguration {
                    hits: 10,
                    window_seconds: 3600,
                }),
            auth_password_reset: deserializer
                .read_serde_setting("auth_password_reset")
                .unwrap_or(RatelimitConfiguration {
                    hits: 10,
                    window_seconds: 300,
                }),
            auth_email_verification: deserializer
                .read_serde_setting("auth_email_verification")
                .unwrap_or(RatelimitConfiguration {
                    hits: 10,
                    window_seconds: 3600,
                }),
            client: deserializer
                .read_serde_setting("client")
                .unwrap_or(RatelimitConfiguration {
                    hits: 360,
                    window_seconds: 30,
                }),
            client_account_email_resend_verification: deserializer
                .read_serde_setting("client_account_email_resend_verification")
                .unwrap_or(RatelimitConfiguration {
                    hits: 10,
                    window_seconds: 3600,
                }),
            client_servers_backups_create: deserializer
                .read_serde_setting("client_servers_backups_create")
                .unwrap_or(RatelimitConfiguration {
                    hits: 4,
                    window_seconds: 300,
                }),
            client_servers_files_pull: deserializer
                .read_serde_setting("client_servers_files_pull")
                .unwrap_or(RatelimitConfiguration {
                    hits: 5,
                    window_seconds: 60,
                }),
            client_servers_files_pull_query: deserializer
                .read_serde_setting("client_servers_files_pull_query")
                .unwrap_or(RatelimitConfiguration {
                    hits: 10,
                    window_seconds: 60,
                }),
            remote: deserializer
                .read_serde_setting("remote")
                .unwrap_or(RatelimitConfiguration {
                    hits: 720,
                    window_seconds: 30,
                }),
            remote_sftp_auth: deserializer
                .read_serde_setting("remote_sftp_auth")
                .unwrap_or(RatelimitConfiguration {
                    hits: 60,
                    window_seconds: 30,
                }),
        }))
    }
}
