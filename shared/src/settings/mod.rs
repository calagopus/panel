use crate::{
    cap::CapFilesystem,
    extensions::settings::{
        ExtensionSettings, ExtensionSettingsDeserializer, SettingsDeserializeExt,
        SettingsDeserializer, SettingsSerializeExt, SettingsSerializer,
    },
    prelude::{AsyncOptionExt, StringExt},
};
use compact_str::ToCompactString;
use garde::Validate;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    ops::{Deref, DerefMut},
    path::PathBuf,
    str::FromStr,
    sync::{
        Arc, LazyLock,
        atomic::{AtomicUsize, Ordering},
    },
};
use tokio::sync::{RwLock, RwLockReadGuard, RwLockWriteGuard, Semaphore, SemaphorePermit};
use utoipa::ToSchema;

pub mod activity;
pub mod app;
pub mod ratelimits;
pub mod server;
pub mod webauthn;

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StorageDriver {
    Filesystem {
        #[garde(length(chars, min = 1, max = 255))]
        path: compact_str::CompactString,
    },
    S3 {
        #[garde(length(chars, min = 1, max = 255), url)]
        public_url: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 512))]
        access_key: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 512))]
        secret_key: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 63))]
        bucket: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 63))]
        region: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        endpoint: compact_str::CompactString,
        #[garde(skip)]
        path_style: bool,
    },
}

impl StorageDriver {
    pub async fn get_cap_filesystem(&self) -> Option<Result<CapFilesystem, std::io::Error>> {
        match self {
            StorageDriver::Filesystem { path } => {
                Some(CapFilesystem::async_new(PathBuf::from(path)).await)
            }
            _ => None,
        }
    }
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MailMode {
    None,
    Smtp {
        #[garde(length(chars, min = 1, max = 255))]
        host: compact_str::CompactString,
        #[garde(skip)]
        port: u16,
        #[garde(length(chars, min = 1, max = 255))]
        username: Option<compact_str::CompactString>,
        #[garde(length(chars, min = 1, max = 255))]
        password: Option<compact_str::CompactString>,
        #[garde(skip)]
        use_tls: bool,

        #[garde(length(chars, min = 1, max = 255), email)]
        from_address: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        from_name: Option<compact_str::CompactString>,
    },
    Sendmail {
        #[garde(length(chars, min = 1, max = 255))]
        command: compact_str::CompactString,

        #[garde(length(chars, min = 1, max = 255), email)]
        from_address: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        from_name: Option<compact_str::CompactString>,
    },
    Filesystem {
        #[garde(length(chars, min = 1, max = 255))]
        path: compact_str::CompactString,

        #[garde(length(chars, min = 1, max = 255), email)]
        from_address: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        from_name: Option<compact_str::CompactString>,
    },
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CaptchaProvider {
    None,
    Turnstile {
        #[garde(length(chars, min = 1, max = 255))]
        site_key: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        secret_key: compact_str::CompactString,
    },
    Recaptcha {
        #[garde(skip)]
        v3: bool,
        #[garde(length(chars, min = 1, max = 255))]
        site_key: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        secret_key: compact_str::CompactString,
    },
    Hcaptcha {
        #[garde(length(chars, min = 1, max = 255))]
        site_key: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        secret_key: compact_str::CompactString,
    },
    FriendlyCaptcha {
        #[garde(length(chars, min = 1, max = 255))]
        site_key: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        api_key: compact_str::CompactString,
    },
}

impl CaptchaProvider {
    pub fn to_public_provider<'a>(&'a self) -> PublicCaptchaProvider<'a> {
        match &self {
            CaptchaProvider::None => PublicCaptchaProvider::None,
            CaptchaProvider::Turnstile { site_key, .. } => PublicCaptchaProvider::Turnstile {
                site_key: site_key.as_str(),
            },
            CaptchaProvider::Recaptcha { v3, site_key, .. } => PublicCaptchaProvider::Recaptcha {
                v3: *v3,
                site_key: site_key.as_str(),
            },
            CaptchaProvider::Hcaptcha { site_key, .. } => PublicCaptchaProvider::Hcaptcha {
                site_key: site_key.as_str(),
            },
            CaptchaProvider::FriendlyCaptcha { site_key, .. } => {
                PublicCaptchaProvider::FriendlyCaptcha {
                    site_key: site_key.as_str(),
                }
            }
        }
    }

    pub fn to_csp_script_src(&self) -> &'static str {
        match self {
            CaptchaProvider::None => "",
            CaptchaProvider::Turnstile { .. } => "https://challenges.cloudflare.com",
            CaptchaProvider::Recaptcha { .. } => {
                "https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/"
            }
            CaptchaProvider::Hcaptcha { .. } => "https://hcaptcha.com https://*.hcaptcha.com",
            CaptchaProvider::FriendlyCaptcha { .. } => "",
        }
    }

    pub fn to_csp_frame_src(&self) -> &'static str {
        match self {
            CaptchaProvider::None => "",
            CaptchaProvider::Turnstile { .. } => "https://challenges.cloudflare.com",
            CaptchaProvider::Recaptcha { .. } => {
                "https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/"
            }
            CaptchaProvider::Hcaptcha { .. } => "https://hcaptcha.com https://*.hcaptcha.com",
            CaptchaProvider::FriendlyCaptcha { .. } => "https://*.frcapi.com",
        }
    }

    pub fn to_csp_style_src(&self) -> &'static str {
        match self {
            CaptchaProvider::None => "",
            CaptchaProvider::Turnstile { .. } => "",
            CaptchaProvider::Recaptcha { .. } => "",
            CaptchaProvider::Hcaptcha { .. } => "https://hcaptcha.com https://*.hcaptcha.com",
            CaptchaProvider::FriendlyCaptcha { .. } => "",
        }
    }
}

#[derive(ToSchema, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PublicCaptchaProvider<'a> {
    None,
    Turnstile { site_key: &'a str },
    Recaptcha { v3: bool, site_key: &'a str },
    Hcaptcha { site_key: &'a str },
    FriendlyCaptcha { site_key: &'a str },
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct AppSettings {
    pub telemetry_uuid: Option<uuid::Uuid>,
    #[schema(value_type = Option<String>)]
    pub telemetry_cron_schedule: Option<cron::Schedule>,
    pub oobe_step: Option<compact_str::CompactString>,

    pub storage_driver: StorageDriver,
    pub mail_mode: MailMode,
    pub captcha_provider: CaptchaProvider,

    #[schema(inline)]
    pub app: app::AppSettingsApp,
    #[schema(inline)]
    pub webauthn: webauthn::AppSettingsWebauthn,
    #[schema(inline)]
    pub server: server::AppSettingsServer,
    #[schema(inline)]
    pub activity: activity::AppSettingsActivity,
    #[schema(inline)]
    pub ratelimits: ratelimits::AppSettingsRatelimits,

    #[serde(skip)]
    pub extensions: HashMap<&'static str, ExtensionSettings>,
}

impl AppSettings {
    pub fn get_extension_settings<T: 'static>(
        &self,
        ext_identifier: &str,
    ) -> Result<&T, anyhow::Error> {
        let ext_settings = self
            .extensions
            .get(ext_identifier)
            .ok_or_else(|| anyhow::anyhow!("failed to find extension settings"))?;

        (&**ext_settings as &dyn std::any::Any)
            .downcast_ref::<T>()
            .ok_or_else(|| anyhow::anyhow!("failed to downcast extension settings"))
    }

    pub fn get_mut_extension_settings<T: 'static>(
        &mut self,
        ext_identifier: &str,
    ) -> Result<&mut T, anyhow::Error> {
        let ext_settings = self
            .extensions
            .get_mut(ext_identifier)
            .ok_or_else(|| anyhow::anyhow!("failed to find extension settings"))?;

        (&mut **ext_settings as &mut dyn std::any::Any)
            .downcast_mut::<T>()
            .ok_or_else(|| anyhow::anyhow!("failed to downcast extension settings"))
    }

    pub fn find_extension_settings<T: 'static>(&self) -> Result<&T, anyhow::Error> {
        for ext_settings in self.extensions.values() {
            if let Some(downcasted) = (&**ext_settings as &dyn std::any::Any).downcast_ref::<T>() {
                return Ok(downcasted);
            }
        }

        Err(anyhow::anyhow!("failed to find extension settings"))
    }

    pub fn find_mut_extension_settings<T: 'static>(&mut self) -> Result<&mut T, anyhow::Error> {
        for ext_settings in self.extensions.values_mut() {
            if let Some(downcasted) =
                (&mut **ext_settings as &mut dyn std::any::Any).downcast_mut::<T>()
            {
                return Ok(downcasted);
            }
        }

        Err(anyhow::anyhow!("failed to find extension settings"))
    }
}

#[async_trait::async_trait]
impl SettingsSerializeExt for AppSettings {
    async fn serialize(
        &self,
        mut serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        let database = serializer.database.clone();

        serializer = serializer
            .write_raw_setting(
                "telemetry_uuid",
                self.telemetry_uuid
                    .as_ref()
                    .map(|u| u.to_compact_string())
                    .unwrap_or_default(),
            )
            .write_raw_setting(
                "telemetry_cron_schedule",
                self.telemetry_cron_schedule
                    .as_ref()
                    .map(|s| s.to_compact_string())
                    .unwrap_or_default(),
            )
            .write_raw_setting("oobe_step", self.oobe_step.clone().unwrap_or_default());

        match &self.storage_driver {
            StorageDriver::Filesystem { path } => {
                serializer = serializer
                    .write_raw_setting("storage_driver", "filesystem")
                    .write_raw_setting("storage_filesystem_path", &**path);
            }
            StorageDriver::S3 {
                public_url,
                access_key,
                secret_key,
                bucket,
                region,
                endpoint,
                path_style,
            } => {
                serializer = serializer
                    .write_raw_setting("storage_driver", "s3")
                    .write_raw_setting("storage_s3_public_url", &**public_url)
                    .write_raw_setting(
                        "storage_s3_access_key",
                        base32::encode(
                            base32::Alphabet::Z,
                            &database.encrypt(access_key.clone()).await?,
                        ),
                    )
                    .write_raw_setting(
                        "storage_s3_secret_key",
                        base32::encode(
                            base32::Alphabet::Z,
                            &database.encrypt(secret_key.clone()).await?,
                        ),
                    )
                    .write_raw_setting("storage_s3_bucket", &**bucket)
                    .write_raw_setting("storage_s3_region", &**region)
                    .write_raw_setting("storage_s3_endpoint", &**endpoint)
                    .write_raw_setting("storage_s3_path_style", path_style.to_compact_string());
            }
        }

        match &self.mail_mode {
            MailMode::None => {
                serializer = serializer.write_raw_setting("mail_mode", "none");
            }
            MailMode::Smtp {
                host,
                port,
                username,
                password,
                use_tls,
                from_address,
                from_name,
            } => {
                serializer = serializer
                    .write_raw_setting("mail_mode", "smtp")
                    .write_raw_setting("mail_smtp_host", &**host)
                    .write_raw_setting("mail_smtp_port", port.to_compact_string())
                    .write_raw_setting(
                        "mail_smtp_username",
                        if let Some(u) = username {
                            base32::encode(base32::Alphabet::Z, &database.encrypt(u.clone()).await?)
                        } else {
                            "".into()
                        },
                    )
                    .write_raw_setting(
                        "mail_smtp_password",
                        if let Some(p) = password {
                            base32::encode(base32::Alphabet::Z, &database.encrypt(p.clone()).await?)
                        } else {
                            "".into()
                        },
                    )
                    .write_raw_setting("mail_smtp_use_tls", use_tls.to_compact_string())
                    .write_raw_setting("mail_smtp_from_address", &**from_address)
                    .write_raw_setting(
                        "mail_smtp_from_name",
                        from_name.clone().unwrap_or_default(),
                    );
            }
            MailMode::Sendmail {
                command,
                from_address,
                from_name,
            } => {
                serializer = serializer
                    .write_raw_setting("mail_mode", "sendmail")
                    .write_raw_setting("mail_sendmail_command", &**command)
                    .write_raw_setting("mail_sendmail_from_address", &**from_address)
                    .write_raw_setting(
                        "mail_sendmail_from_name",
                        from_name.clone().unwrap_or_default(),
                    );
            }
            MailMode::Filesystem {
                path,
                from_address,
                from_name,
            } => {
                serializer = serializer
                    .write_raw_setting("mail_mode", "filesystem")
                    .write_raw_setting("mail_filesystem_path", &**path)
                    .write_raw_setting("mail_filesystem_from_address", &**from_address)
                    .write_raw_setting(
                        "mail_filesystem_from_name",
                        from_name.clone().unwrap_or_default(),
                    );
            }
        }

        match &self.captcha_provider {
            CaptchaProvider::None => {
                serializer = serializer.write_raw_setting("captcha_provider", "none");
            }
            CaptchaProvider::Turnstile {
                site_key,
                secret_key,
            } => {
                serializer = serializer
                    .write_raw_setting("captcha_provider", "turnstile")
                    .write_raw_setting("turnstile_site_key", &**site_key)
                    .write_raw_setting("turnstile_secret_key", &**secret_key);
            }
            CaptchaProvider::Recaptcha {
                v3,
                site_key,
                secret_key,
            } => {
                serializer = serializer
                    .write_raw_setting("captcha_provider", "recaptcha")
                    .write_raw_setting("recaptcha_v3", v3.to_compact_string())
                    .write_raw_setting("recaptcha_site_key", &**site_key)
                    .write_raw_setting("recaptcha_secret_key", &**secret_key);
            }
            CaptchaProvider::Hcaptcha {
                site_key,
                secret_key,
            } => {
                serializer = serializer
                    .write_raw_setting("captcha_provider", "hcaptcha")
                    .write_raw_setting("hcaptcha_site_key", &**site_key)
                    .write_raw_setting("hcaptcha_secret_key", &**secret_key);
            }
            CaptchaProvider::FriendlyCaptcha { site_key, api_key } => {
                serializer = serializer
                    .write_raw_setting("captcha_provider", "friendlycaptcha")
                    .write_raw_setting("friendlycaptcha_site_key", &**site_key)
                    .write_raw_setting("friendlycaptcha_api_key", &**api_key);
            }
        }

        serializer = serializer
            .nest("app", &self.app)
            .await?
            .nest("webauthn", &self.webauthn)
            .await?
            .nest("server", &self.server)
            .await?
            .nest("activity", &self.activity)
            .await?
            .nest("ratelimits", &self.ratelimits)
            .await?;

        for (ext_identifier, ext_settings) in self.extensions.iter() {
            serializer = serializer.nest(ext_identifier, ext_settings).await?;
        }

        Ok(serializer)
    }
}

pub(crate) static SETTINGS_DESER_EXTENSIONS: LazyLock<
    std::sync::RwLock<HashMap<&'static str, ExtensionSettingsDeserializer>>,
> = LazyLock::new(|| std::sync::RwLock::new(HashMap::new()));

pub struct AppSettingsDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for AppSettingsDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        let mut extensions = HashMap::new();

        let extension_deserializers = {
            let ext_deser_lock = SETTINGS_DESER_EXTENSIONS.read().unwrap();

            ext_deser_lock
                .iter()
                .map(|(k, v)| (*k, v.clone()))
                .collect::<Vec<_>>()
        };

        for (ext_identifier, ext_deserializer) in extension_deserializers {
            let settings_deserializer = SettingsDeserializer::new(
                deserializer.database.clone(),
                deserializer.nest_prefix(ext_identifier),
                deserializer.settings,
            );

            let ext_settings = ext_deserializer
                .deserialize_boxed(settings_deserializer)
                .await?;
            extensions.insert(ext_identifier, ext_settings);
        }

        Ok(Box::new(AppSettings {
            telemetry_uuid: deserializer
                .take_raw_setting("telemetry_uuid")
                .and_then(|s| uuid::Uuid::from_str(&s).ok()),
            telemetry_cron_schedule: deserializer
                .take_raw_setting("telemetry_cron_schedule")
                .and_then(|s| cron::Schedule::from_str(&s).ok()),
            oobe_step: match deserializer.take_raw_setting("oobe_step") {
                Some(step) if step.is_empty() => None,
                Some(step) => Some(step),
                None => {
                    if crate::models::user::User::count(&deserializer.database).await > 0 {
                        None
                    } else {
                        Some("register".into())
                    }
                }
            },
            storage_driver: match deserializer.take_raw_setting("storage_driver").as_deref() {
                Some("s3") => StorageDriver::S3 {
                    public_url: deserializer
                        .take_raw_setting("storage_s3_public_url")
                        .unwrap_or_else(|| "https://your-s3-bucket.s3.amazonaws.com".into()),
                    access_key: if let Some(access_key) =
                        deserializer.take_raw_setting("storage_s3_access_key")
                    {
                        base32::decode(base32::Alphabet::Z, &access_key)
                            .map(|encrypted| deserializer.database.decrypt(encrypted))
                            .awaited()
                            .await
                            .transpose()?
                            .unwrap_or_else(|| "your-access-key".into())
                    } else {
                        "your-access-key".into()
                    },
                    secret_key: if let Some(secret_key) =
                        deserializer.take_raw_setting("storage_s3_secret_key")
                    {
                        base32::decode(base32::Alphabet::Z, &secret_key)
                            .map(|encrypted| deserializer.database.decrypt(encrypted))
                            .awaited()
                            .await
                            .transpose()?
                            .unwrap_or_else(|| "your-secret-key".into())
                    } else {
                        "your-secret-key".into()
                    },
                    bucket: deserializer
                        .take_raw_setting("storage_s3_bucket")
                        .unwrap_or_else(|| "your-s3-bucket".into()),
                    region: deserializer
                        .take_raw_setting("storage_s3_region")
                        .unwrap_or_else(|| "us-east-1".into()),
                    endpoint: deserializer
                        .take_raw_setting("storage_s3_endpoint")
                        .unwrap_or_else(|| "https://s3.amazonaws.com".into()),
                    path_style: deserializer
                        .take_raw_setting("storage_s3_path_style")
                        .map(|s| s == "true")
                        .unwrap_or(false),
                },
                _ => StorageDriver::Filesystem {
                    path: deserializer
                        .take_raw_setting("storage_filesystem_path")
                        .unwrap_or_else(|| {
                            if std::env::consts::OS == "windows" {
                                "C:\\calagopus_data".into()
                            } else {
                                "/var/lib/calagopus".into()
                            }
                        }),
                },
            },
            mail_mode: match deserializer.take_raw_setting("mail_mode").as_deref() {
                Some("smtp") => MailMode::Smtp {
                    host: deserializer
                        .take_raw_setting("mail_smtp_host")
                        .unwrap_or_else(|| "smtp.example.com".into()),
                    port: deserializer
                        .take_raw_setting("mail_smtp_port")
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(587),
                    username: if let Some(username) = deserializer
                        .take_raw_setting("mail_smtp_username")
                        .and_then(|s| s.into_optional())
                    {
                        base32::decode(base32::Alphabet::Z, &username)
                            .map(|encrypted| deserializer.database.decrypt(encrypted))
                            .awaited()
                            .await
                            .transpose()?
                    } else {
                        None
                    },
                    password: if let Some(password) = deserializer
                        .take_raw_setting("mail_smtp_password")
                        .and_then(|s| s.into_optional())
                    {
                        base32::decode(base32::Alphabet::Z, &password)
                            .map(|encrypted| deserializer.database.decrypt(encrypted))
                            .awaited()
                            .await
                            .transpose()?
                    } else {
                        None
                    },
                    use_tls: deserializer
                        .take_raw_setting("mail_smtp_use_tls")
                        .map(|s| s == "true")
                        .unwrap_or(true),
                    from_address: deserializer
                        .take_raw_setting("mail_smtp_from_address")
                        .unwrap_or_else(|| "noreply@example.com".into()),
                    from_name: deserializer.take_raw_setting("mail_smtp_from_name"),
                },
                Some("sendmail") => MailMode::Sendmail {
                    command: deserializer
                        .take_raw_setting("mail_sendmail_command")
                        .unwrap_or_else(|| "sendmail".into()),
                    from_address: deserializer
                        .take_raw_setting("mail_sendmail_from_address")
                        .unwrap_or_else(|| "noreply@example.com".into()),
                    from_name: deserializer.take_raw_setting("mail_sendmail_from_name"),
                },
                Some("filesystem") => MailMode::Filesystem {
                    path: deserializer
                        .take_raw_setting("mail_filesystem_path")
                        .unwrap_or_else(|| "/var/lib/calagopus/mail".into()),
                    from_address: deserializer
                        .take_raw_setting("mail_filesystem_from_address")
                        .unwrap_or_else(|| "noreply@example.com".into()),
                    from_name: deserializer.take_raw_setting("mail_filesystem_from_name"),
                },
                _ => MailMode::None,
            },
            captcha_provider: match deserializer.take_raw_setting("captcha_provider").as_deref() {
                Some("turnstile") => CaptchaProvider::Turnstile {
                    site_key: deserializer
                        .take_raw_setting("turnstile_site_key")
                        .unwrap_or_default(),
                    secret_key: deserializer
                        .take_raw_setting("turnstile_secret_key")
                        .unwrap_or_default(),
                },
                Some("recaptcha") => CaptchaProvider::Recaptcha {
                    v3: deserializer
                        .take_raw_setting("recaptcha_v3")
                        .map(|s| s == "true")
                        .unwrap_or(false),
                    site_key: deserializer
                        .take_raw_setting("recaptcha_site_key")
                        .unwrap_or_default(),
                    secret_key: deserializer
                        .take_raw_setting("recaptcha_secret_key")
                        .unwrap_or_default(),
                },
                Some("hcaptcha") => CaptchaProvider::Hcaptcha {
                    site_key: deserializer
                        .take_raw_setting("hcaptcha_site_key")
                        .unwrap_or_default(),
                    secret_key: deserializer
                        .take_raw_setting("hcaptcha_secret_key")
                        .unwrap_or_default(),
                },
                Some("friendlycaptcha") => CaptchaProvider::FriendlyCaptcha {
                    site_key: deserializer
                        .take_raw_setting("friendlycaptcha_site_key")
                        .unwrap_or_default(),
                    api_key: deserializer
                        .take_raw_setting("friendlycaptcha_api_key")
                        .unwrap_or_default(),
                },
                _ => CaptchaProvider::None,
            },
            app: deserializer
                .nest("app", &app::AppSettingsAppDeserializer)
                .await?,
            webauthn: deserializer
                .nest("webauthn", &webauthn::AppSettingsWebauthnDeserializer)
                .await?,
            server: deserializer
                .nest("server", &server::AppSettingsServerDeserializer)
                .await?,
            activity: deserializer
                .nest("activity", &activity::AppSettingsActivityDeserializer)
                .await?,
            ratelimits: deserializer
                .nest("ratelimits", &ratelimits::AppSettingsRatelimitsDeserializer)
                .await?,
            extensions,
        }))
    }
}

pub struct SettingsReadGuard<'a> {
    settings: RwLockReadGuard<'a, SettingsBuffer>,
}

impl Deref for SettingsReadGuard<'_> {
    type Target = AppSettings;

    fn deref(&self) -> &Self::Target {
        &self.settings.settings
    }
}

pub struct SettingsWriteGuard<'a> {
    parent: &'a Settings,
    settings: Option<RwLockWriteGuard<'a, SettingsBuffer>>,
    _writer_token: SemaphorePermit<'a>,
}

impl<'a> SettingsWriteGuard<'a> {
    pub async fn save(mut self) -> Result<(), crate::database::DatabaseError> {
        let mut settings_guard = self.settings.take().ok_or_else(|| {
            crate::database::DatabaseError::Any(anyhow::anyhow!(
                "settings have already been saved or dropped"
            ))
        })?;

        let (keys, values) = SettingsSerializeExt::serialize(
            &settings_guard.settings,
            SettingsSerializer::new(self.parent.database.clone(), ""),
        )
        .await?
        .into_parts();

        sqlx::query!(
            "INSERT INTO settings (key, value)
            SELECT * FROM UNNEST($1::text[], $2::text[])
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            &keys as &[compact_str::CompactString],
            &values as &[compact_str::CompactString]
        )
        .execute(self.parent.database.write())
        .await?;

        settings_guard.expires = std::time::Instant::now() + std::time::Duration::from_secs(60);

        let _ = self
            .parent
            .cached_index
            .fetch_update(Ordering::Release, Ordering::Relaxed, |i| Some((i + 1) % 2));

        Ok(())
    }

    pub fn censored(&self) -> serde_json::Value {
        let settings = self.settings.as_ref().expect("settings have been dropped");
        let mut json = serde_json::to_value(&settings.settings).unwrap();

        fn censor_values(key: &str, value: &mut serde_json::Value) {
            match value {
                serde_json::Value::Object(map) => {
                    for (k, v) in map.iter_mut() {
                        censor_values(k, v);
                    }
                }
                serde_json::Value::String(s) => {
                    if key.contains("password") {
                        *s = "*".repeat(s.len());
                    }
                }
                _ => {}
            }
        }

        censor_values("", &mut json);

        json
    }
}

impl Deref for SettingsWriteGuard<'_> {
    type Target = AppSettings;

    fn deref(&self) -> &Self::Target {
        &self
            .settings
            .as_ref()
            .expect("settings have been dropped")
            .settings
    }
}

impl DerefMut for SettingsWriteGuard<'_> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self
            .settings
            .as_mut()
            .expect("settings have been dropped")
            .settings
    }
}

struct SettingsBuffer {
    settings: AppSettings,
    expires: std::time::Instant,
}

pub struct Settings {
    cached: [RwLock<SettingsBuffer>; 2],
    cached_index: AtomicUsize,
    write_serializing: Semaphore,

    database: Arc<crate::database::Database>,
}

impl Settings {
    async fn fetch_settings(
        database: &Arc<crate::database::Database>,
    ) -> Result<AppSettings, anyhow::Error> {
        let rows = sqlx::query!("SELECT * FROM settings")
            .fetch_all(database.read())
            .await?;

        let mut map = HashMap::new();
        for row in rows {
            map.insert(row.key.into(), row.value.into());
        }

        let boxed = SettingsDeserializeExt::deserialize_boxed(
            &AppSettingsDeserializer,
            SettingsDeserializer::new(database.clone(), "", &mut map),
        )
        .await?;

        Ok(*(boxed as Box<dyn std::any::Any>)
            .downcast::<AppSettings>()
            .expect("settings has invalid type"))
    }

    pub async fn new(database: Arc<crate::database::Database>) -> Result<Self, anyhow::Error> {
        Ok(Self {
            cached: [
                RwLock::new(SettingsBuffer {
                    settings: Self::fetch_settings(&database).await?,
                    expires: std::time::Instant::now() + std::time::Duration::from_secs(60),
                }),
                RwLock::new(SettingsBuffer {
                    settings: Self::fetch_settings(&database).await?,
                    expires: std::time::Instant::now() + std::time::Duration::from_secs(60),
                }),
            ],
            cached_index: AtomicUsize::new(0),
            write_serializing: Semaphore::new(1),
            database,
        })
    }

    pub async fn get(&self) -> Result<SettingsReadGuard<'_>, anyhow::Error> {
        let now = std::time::Instant::now();

        let index = self.cached_index.load(Ordering::Acquire);
        {
            let guard = self.cached[index % 2].read().await;
            if now < guard.expires {
                return Ok(SettingsReadGuard { settings: guard });
            }
        }

        let _write_token = self.write_serializing.acquire().await?;

        let index = self.cached_index.load(Ordering::Acquire);
        let current_buffer = &self.cached[index % 2];

        if now < current_buffer.read().await.expires {
            return Ok(SettingsReadGuard {
                settings: current_buffer.read().await,
            });
        }

        let start = std::time::Instant::now();
        tracing::info!("settings cache expired, reloading from database");

        let settings = Self::fetch_settings(&self.database).await?;
        let mut guard = current_buffer.write().await;
        guard.settings = settings;
        guard.expires = now + std::time::Duration::from_secs(60);

        drop(guard);

        tracing::info!(
            "reloaded settings from database in {} ms",
            start.elapsed().as_millis()
        );

        Ok(SettingsReadGuard {
            settings: current_buffer.read().await,
        })
    }

    pub async fn get_as<F: FnOnce(&AppSettings) -> T, T>(&self, f: F) -> Result<T, anyhow::Error> {
        let settings = self.get().await?;
        Ok(f(&settings))
    }

    pub async fn get_webauthn(&self) -> Result<webauthn_rs::Webauthn, anyhow::Error> {
        let settings = self.get().await?;

        Ok(webauthn_rs::WebauthnBuilder::new(
            &settings.webauthn.rp_id,
            &settings.webauthn.rp_origin.parse()?,
        )?
        .rp_name(&settings.app.name)
        .build()?)
    }

    pub async fn get_mut(&self) -> Result<SettingsWriteGuard<'_>, anyhow::Error> {
        let writer_token = self.write_serializing.acquire().await?;

        let active_index = self.cached_index.load(Ordering::Acquire);
        let inactive_index = (active_index + 1) % 2;
        let inactive_buffer = &self.cached[inactive_index];

        let mut guard = inactive_buffer.write().await;

        guard.settings = Self::fetch_settings(&self.database).await?;

        Ok(SettingsWriteGuard {
            parent: self,
            settings: Some(guard),
            _writer_token: writer_token,
        })
    }

    pub async fn invalidate_cache(&self) {
        let Ok(_lock) = self.write_serializing.acquire().await else {
            return;
        };
        let index = self.cached_index.load(Ordering::Acquire);
        self.cached[index % 2].write().await.expires = std::time::Instant::now();
    }
}
