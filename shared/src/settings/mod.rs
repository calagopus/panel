use crate::{
    cap::CapFilesystem,
    censor::{CENSORED_PLACEHOLDER, Censor},
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
    collections::{BTreeMap, HashMap},
    marker::PhantomData,
    ops::{Deref, DerefMut},
    path::Path,
    str::FromStr,
    sync::{
        Arc, LazyLock,
        atomic::{AtomicBool, Ordering},
    },
};
use tokio::sync::{Semaphore, SemaphorePermit};
use utoipa::ToSchema;

pub mod activity;
pub mod app;
pub mod metadata;
pub mod ratelimits;
pub mod server;
pub mod updates;
pub mod user;
pub mod webauthn;

pub const OOBE_STEPS: &[&str] = &[
    "register",
    "configuration",
    "repositories",
    "location",
    "node",
    "nodeconfiguration",
    "server",
    "finished",
];

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RouteOrderItem {
    Route {
        #[garde(skip)]
        path: compact_str::CompactString,
        #[garde(
            length(chars, min = 1, max = 128),
            inner(custom(crate::icons::validate_icon))
        )]
        #[schema(min_length = 1, max_length = 128)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        icon: Option<compact_str::CompactString>,
    },
    Divider {
        #[garde(skip)]
        name: Option<compact_str::CompactString>,
        #[garde(skip)]
        name_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    },
    Redirect {
        #[garde(skip)]
        name: compact_str::CompactString,
        #[garde(skip)]
        name_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
        #[garde(skip)]
        destination: compact_str::CompactString,
        #[garde(
            length(chars, min = 1, max = 128),
            inner(custom(crate::icons::validate_icon))
        )]
        #[schema(min_length = 1, max_length = 128)]
        #[serde(default, skip_serializing_if = "Option::is_none")]
        icon: Option<compact_str::CompactString>,
    },
}

impl RouteOrderItem {
    pub fn icon(&self) -> Option<&str> {
        match self {
            Self::Route { icon, .. } | Self::Redirect { icon, .. } => icon.as_deref(),
            Self::Divider { .. } => None,
        }
    }
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum TlsMode {
    None,
    StartTls,
    ImplicitTls,
}

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
    pub async fn get_cap_filesystem(
        &self,
        relative_path: impl AsRef<Path>,
    ) -> Option<Result<CapFilesystem, std::io::Error>> {
        match self {
            StorageDriver::Filesystem { path } => {
                Some(CapFilesystem::async_new(Path::new(path).join(relative_path.as_ref())).await)
            }
            _ => None,
        }
    }
}

impl Censor for StorageDriver {
    fn censor(&mut self) {
        match self {
            StorageDriver::Filesystem { .. } => {}
            StorageDriver::S3 {
                access_key,
                secret_key,
                ..
            } => {
                *access_key = CENSORED_PLACEHOLDER.into();
                *secret_key = CENSORED_PLACEHOLDER.into();
            }
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
        tls_mode: TlsMode,
        #[garde(skip)]
        #[serde(default)]
        skip_cert_validation: bool,
        #[garde(length(chars, min = 1, max = 255))]
        #[serde(default)]
        helo_domain: Option<compact_str::CompactString>,

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

impl Censor for MailMode {
    fn censor(&mut self) {
        match self {
            MailMode::None | MailMode::Sendmail { .. } | MailMode::Filesystem { .. } => {}
            MailMode::Smtp {
                username, password, ..
            } => {
                if let Some(username) = username {
                    *username = CENSORED_PLACEHOLDER.into();
                }
                if let Some(password) = password {
                    *password = CENSORED_PLACEHOLDER.into();
                }
            }
        }
    }
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
        #[serde(default = "default_recaptcha_threshold")]
        #[garde(custom(validate_recaptcha_threshold))]
        threshold: f64,
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
    Cap {
        #[garde(length(chars, min = 1, max = 255), custom(validate_cap_api_url))]
        api_url: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255), pattern(r"^[a-zA-Z0-9_-]+$"))]
        site_key: compact_str::CompactString,
        #[garde(length(chars, min = 1, max = 255))]
        secret_key: compact_str::CompactString,
    },
}

fn default_recaptcha_threshold() -> f64 {
    0.5
}

fn validate_recaptcha_threshold(value: &f64, _context: &()) -> Result<(), garde::Error> {
    if !(0.0..=1.0).contains(value) {
        return Err(garde::Error::new("must be between 0 and 1"));
    }

    Ok(())
}

fn validate_cap_api_url(value: &str, context: &()) -> Result<(), garde::Error> {
    if value.trim() != value {
        return Err(garde::Error::new("must not contain surrounding whitespace"));
    }
    let url = reqwest::Url::parse(value).map_err(|err| garde::Error::new(err.to_string()))?;
    crate::utils::validate_http_url(&url, context)?;
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(garde::Error::new(
            "must not contain credentials, a query, or a fragment",
        ));
    }

    Ok(())
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
            CaptchaProvider::Cap {
                api_url, site_key, ..
            } => PublicCaptchaProvider::Cap {
                api_url: api_url.as_str(),
                site_key: site_key.as_str(),
            },
        }
    }

    pub fn to_csp_script_src(&self) -> &'static [&'static str] {
        match self {
            CaptchaProvider::None => &[],
            CaptchaProvider::Turnstile { .. } => &["https://challenges.cloudflare.com"],
            CaptchaProvider::Recaptcha { .. } => &[
                "https://www.google.com/recaptcha/",
                "https://www.gstatic.com/recaptcha/",
            ],
            CaptchaProvider::Hcaptcha { .. } => &["https://hcaptcha.com", "https://*.hcaptcha.com"],
            CaptchaProvider::FriendlyCaptcha { .. } => &[],
            CaptchaProvider::Cap { .. } => &["'wasm-unsafe-eval'"],
        }
    }

    pub fn to_csp_style_src(&self) -> &'static [&'static str] {
        match self {
            CaptchaProvider::None => &[],
            CaptchaProvider::Turnstile { .. } => &[],
            CaptchaProvider::Recaptcha { .. } => &[],
            CaptchaProvider::Hcaptcha { .. } => &["https://hcaptcha.com", "https://*.hcaptcha.com"],
            CaptchaProvider::FriendlyCaptcha { .. } => &[],
            CaptchaProvider::Cap { .. } => &[],
        }
    }
}

impl Censor for CaptchaProvider {
    fn censor(&mut self) {
        match self {
            CaptchaProvider::None => {}
            CaptchaProvider::Turnstile { secret_key, .. }
            | CaptchaProvider::Recaptcha { secret_key, .. }
            | CaptchaProvider::Hcaptcha { secret_key, .. }
            | CaptchaProvider::Cap { secret_key, .. } => {
                *secret_key = CENSORED_PLACEHOLDER.into();
            }
            CaptchaProvider::FriendlyCaptcha { api_key, .. } => {
                *api_key = CENSORED_PLACEHOLDER.into();
            }
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
    Cap { api_url: &'a str, site_key: &'a str },
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct ExtensionPermissions {
    pub user: Vec<compact_str::CompactString>,
    pub admin: Vec<compact_str::CompactString>,
    pub server: Vec<compact_str::CompactString>,
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct AppSettings {
    pub telemetry_uuid: Option<uuid::Uuid>,
    #[schema(value_type = Option<String>)]
    pub telemetry_cron_schedule: Option<croner::Cron>,
    pub oobe_step: Option<compact_str::CompactString>,

    pub storage_driver: StorageDriver,
    pub mail_mode: MailMode,
    pub captcha_provider: CaptchaProvider,

    #[schema(inline)]
    pub app: app::AppSettingsApp,
    #[schema(inline)]
    pub metadata: metadata::AppSettingsMetadata,
    #[schema(inline)]
    pub webauthn: webauthn::AppSettingsWebauthn,
    #[schema(inline)]
    pub server: server::AppSettingsServer,
    #[schema(inline)]
    pub user: user::AppSettingsUser,
    #[schema(inline)]
    pub activity: activity::AppSettingsActivity,
    #[schema(inline)]
    pub ratelimits: ratelimits::AppSettingsRatelimits,
    #[schema(inline)]
    pub updates: updates::AppSettingsUpdates,

    #[serde(skip)]
    pub disabled_extensions: Vec<compact_str::CompactString>,
    #[serde(skip)]
    pub extension_permissions: BTreeMap<compact_str::CompactString, ExtensionPermissions>,

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
            );
        // Intentionally not writing oobe_step, persisting 'register' in a write will cause a lot of weird issues
        // The seperate settings set_oobe_step should be used to manage this setting instead
        // disabled_extensions and extension_permissions are left out for the same reason, they are
        // written by set_disabled_extensions/set_extension_permissions

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
                tls_mode,
                skip_cert_validation,
                helo_domain,
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
                    .write_raw_setting(
                        "mail_smtp_tls_mode",
                        match tls_mode {
                            TlsMode::None => "none",
                            TlsMode::StartTls => "starttls",
                            TlsMode::ImplicitTls => "implicit_tls",
                        },
                    )
                    .write_raw_setting(
                        "mail_smtp_skip_cert_validation",
                        skip_cert_validation.to_compact_string(),
                    )
                    .write_raw_setting(
                        "mail_smtp_helo_domain",
                        helo_domain.clone().unwrap_or_default(),
                    )
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
                threshold,
                site_key,
                secret_key,
            } => {
                serializer = serializer
                    .write_raw_setting("captcha_provider", "recaptcha")
                    .write_raw_setting("recaptcha_v3", v3.to_compact_string())
                    .write_raw_setting("recaptcha_threshold", threshold.to_compact_string())
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
            CaptchaProvider::Cap {
                api_url,
                site_key,
                secret_key,
            } => {
                serializer = serializer
                    .write_raw_setting("captcha_provider", "cap")
                    .write_raw_setting("cap_api_url", &**api_url)
                    .write_raw_setting("cap_site_key", &**site_key)
                    .write_raw_setting("cap_secret_key", &**secret_key);
            }
        }

        serializer = serializer
            .nest("app", &self.app)
            .await?
            .nest("metadata", &self.metadata)
            .await?
            .nest("webauthn", &self.webauthn)
            .await?
            .nest("server", &self.server)
            .await?
            .nest("user", &self.user)
            .await?
            .nest("activity", &self.activity)
            .await?
            .nest("ratelimits", &self.ratelimits)
            .await?
            .nest("updates", &self.updates)
            .await?;

        for (ext_identifier, ext_settings) in self.extensions.iter() {
            serializer = serializer.nest(ext_identifier, ext_settings).await?;
        }

        Ok(serializer)
    }
}

pub(crate) static SETTINGS_DESER_EXTENSIONS: LazyLock<
    parking_lot::RwLock<HashMap<&'static str, ExtensionSettingsDeserializer>>,
> = LazyLock::new(|| parking_lot::RwLock::new(HashMap::new()));

pub struct AppSettingsDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for AppSettingsDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        let mut extensions = HashMap::new();

        let extension_deserializers = {
            let ext_deser_lock = SETTINGS_DESER_EXTENSIONS.read();

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

            match ext_deserializer
                .deserialize_boxed(settings_deserializer)
                .await
            {
                Ok(ext_settings) => {
                    extensions.insert(ext_identifier, ext_settings);
                }
                Err(err) => tracing::error!(
                    extension = %ext_identifier,
                    "failed to deserialize extension settings, skipping: {err:#}"
                ),
            }
        }

        Ok(Box::new(AppSettings {
            telemetry_uuid: deserializer
                .take_raw_setting("telemetry_uuid")
                .and_then(|s| uuid::Uuid::from_str(&s).ok()),
            telemetry_cron_schedule: deserializer
                .take_raw_setting("telemetry_cron_schedule")
                .and_then(|s| croner::Cron::from_str(&s).ok()),
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
                    tls_mode: match deserializer
                        .take_raw_setting("mail_smtp_tls_mode")
                        .as_deref()
                    {
                        Some("none") => TlsMode::None,
                        Some("starttls") => TlsMode::StartTls,
                        Some("implicit_tls") => TlsMode::ImplicitTls,
                        _ => TlsMode::StartTls,
                    },
                    skip_cert_validation: deserializer
                        .take_raw_setting("mail_smtp_skip_cert_validation")
                        .map(|s| s == "true")
                        .unwrap_or(false),
                    helo_domain: deserializer
                        .take_raw_setting("mail_smtp_helo_domain")
                        .and_then(|s| s.into_optional()),
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
                    threshold: deserializer
                        .take_raw_setting("recaptcha_threshold")
                        .and_then(|s| s.parse::<f64>().ok())
                        .filter(|threshold| (0.0..=1.0).contains(threshold))
                        .unwrap_or_else(default_recaptcha_threshold),
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
                Some("cap") => CaptchaProvider::Cap {
                    api_url: deserializer
                        .take_raw_setting("cap_api_url")
                        .unwrap_or_default(),
                    site_key: deserializer
                        .take_raw_setting("cap_site_key")
                        .unwrap_or_default(),
                    secret_key: deserializer
                        .take_raw_setting("cap_secret_key")
                        .unwrap_or_default(),
                },
                _ => CaptchaProvider::None,
            },
            app: deserializer
                .nest("app", &app::AppSettingsAppDeserializer)
                .await?,
            metadata: deserializer
                .nest("metadata", &metadata::AppSettingsMetadataDeserializer)
                .await?,
            webauthn: deserializer
                .nest("webauthn", &webauthn::AppSettingsWebauthnDeserializer)
                .await?,
            server: deserializer
                .nest("server", &server::AppSettingsServerDeserializer)
                .await?,
            user: deserializer
                .nest("user", &user::AppSettingsUserDeserializer)
                .await?,
            activity: deserializer
                .nest("activity", &activity::AppSettingsActivityDeserializer)
                .await?,
            ratelimits: deserializer
                .nest("ratelimits", &ratelimits::AppSettingsRatelimitsDeserializer)
                .await?,
            updates: deserializer
                .nest("updates", &updates::AppSettingsUpdatesDeserializer)
                .await?,
            disabled_extensions: deserializer
                .take_raw_setting("disabled_extensions")
                .map(|s| parse_disabled_extensions(&s))
                .unwrap_or_default(),
            extension_permissions: deserializer
                .take_raw_setting("extension_permissions")
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default(),
            extensions,
        }))
    }
}

fn parse_disabled_extensions(raw: &str) -> Vec<compact_str::CompactString> {
    raw.split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(Into::into)
        .collect()
}

pub async fn fetch_disabled_extensions(
    database: &crate::database::Database,
) -> Vec<compact_str::CompactString> {
    let value: Option<String> =
        sqlx::query_scalar("SELECT value FROM settings WHERE key = '::disabled_extensions'")
            .fetch_optional(database.read())
            .await
            .ok()
            .flatten();

    value
        .as_deref()
        .map(parse_disabled_extensions)
        .unwrap_or_default()
}

pub struct SettingsReadGuard<'a> {
    settings: Arc<SettingsBuffer>,
    _parent: PhantomData<&'a Settings>,
}

impl SettingsReadGuard<'_> {
    fn new(settings: Arc<SettingsBuffer>) -> Self {
        Self {
            settings,
            _parent: PhantomData,
        }
    }
}

impl Deref for SettingsReadGuard<'_> {
    type Target = AppSettings;

    fn deref(&self) -> &Self::Target {
        &self.settings.settings
    }
}

fn render_index_html(
    settings: &AppSettings,
    inactive_extensions: &[compact_str::CompactString],
    contributions: &crate::extensions::index_html::IndexHtmlContributions,
) -> Result<RenderedIndexHtml, anyhow::Error> {
    let mut environment = minijinja::Environment::new();
    environment.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);
    environment.add_global(
        "settings",
        minijinja::Value::from(minijinja::value::Serde(settings)),
    );
    environment.add_global(
        "metadata",
        minijinja::Value::from(minijinja::value::Serde(
            settings.metadata.resolve(&settings.app),
        )),
    );

    let index_html = crate::frontend_index_html().ok_or_else(|| {
        anyhow::anyhow!("no frontend registered, call shared::register_frontend first")
    })?;

    let html = render_index_template(
        environment,
        index_html,
        inactive_extensions,
        &contributions.evaluate(settings),
    )?;
    let content_security_policy = contributions.content_security_policy(settings);

    Ok(RenderedIndexHtml {
        html: ArcedIndexHtml(Arc::new(html)),
        content_security_policy: content_security_policy.render(),
        uses_script_nonce: content_security_policy.uses_script_nonce(),
    })
}

fn render_index_template(
    mut environment: minijinja::Environment<'_>,
    index_html: &str,
    inactive_extensions: &[compact_str::CompactString],
    variables: &crate::extensions::index_html::EvaluatedIndexHtmlVariables,
) -> Result<String, anyhow::Error> {
    environment.add_global(
        "inactive_extensions",
        minijinja::Value::from(minijinja::value::Serde(inactive_extensions)),
    );

    let boot_variables = variables.clone();
    environment.add_filter(
        "boot_template",
        move |source: String, identifier: String| {
            boot_variables.render_boot_template(&source, &identifier)
        },
    );

    let rendered = environment.render_str(index_html, minijinja::context! {})?;

    Ok(rendered.replacen("</head>", &format!("{}</head>", variables.json_block()?), 1))
}

#[derive(Clone)]
pub struct ArcedIndexHtml(Arc<String>);

impl AsRef<str> for ArcedIndexHtml {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl AsRef<[u8]> for ArcedIndexHtml {
    fn as_ref(&self) -> &[u8] {
        self.0.as_bytes()
    }
}

pub struct RenderedIndexHtml {
    pub html: ArcedIndexHtml,
    content_security_policy: String,
    uses_script_nonce: bool,
}

impl RenderedIndexHtml {
    #[inline]
    pub fn uses_script_nonce(&self) -> bool {
        self.uses_script_nonce
    }

    pub fn content_security_policy(&self, script_nonce: Option<&str>) -> std::borrow::Cow<'_, str> {
        match script_nonce {
            Some(nonce) => format!("{} 'nonce-{nonce}'", self.content_security_policy).into(),
            None => std::borrow::Cow::Borrowed(&self.content_security_policy),
        }
    }
}

pub struct SettingsWriteGuard<'a> {
    parent: &'a Settings,
    settings: Option<AppSettings>,
    _writer_token: SemaphorePermit<'a>,
}

impl<'a> SettingsWriteGuard<'a> {
    pub async fn save(mut self) -> Result<(), crate::database::DatabaseError> {
        let settings = self.settings.take().ok_or_else(|| {
            crate::database::DatabaseError::Any(anyhow::anyhow!(
                "settings have already been saved or dropped"
            ))
        })?;

        let (keys, values) = SettingsSerializeExt::serialize(
            &settings,
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

        self.parent.rerender_index_html(&settings)?;

        self.parent.cached.store(Arc::new(SettingsBuffer::new(
            settings,
            std::time::Instant::now() + std::time::Duration::from_secs(60),
        )));

        crate::models::invalidate_cache_keys(
            &self.parent.database,
            &[crate::icons::REFERENCED_ICONS_CACHE_KEY.into()],
        )
        .await;

        crate::models::node::Node::invalidate_permissions_everywhere(
            &self.parent.database,
            crate::models::node::PermissionsInvalidation {
                servers: Some(wings_api::ServerSelector::All),
                ..Default::default()
            },
        );

        Ok(())
    }

    /// The settings as they may be logged, with every secret censored.
    ///
    /// [`AppSettings`] deliberately has no [`Censor`] impl: this runs on the live buffer that
    /// [`Self::save`] writes to the database, so censoring it in place would persist the
    /// placeholder as the real secret. The secret bearing settings are censored on clones instead.
    pub fn censored(&self) -> serde_json::Value {
        let settings = self.settings.as_ref().expect("settings have been dropped");

        let mut json = serde_json::to_value(settings).unwrap();

        json["storage_driver"] =
            serde_json::to_value(settings.storage_driver.clone().censored()).unwrap();
        json["mail_mode"] = serde_json::to_value(settings.mail_mode.clone().censored()).unwrap();
        json["captcha_provider"] =
            serde_json::to_value(settings.captcha_provider.clone().censored()).unwrap();
        json["updates"] = serde_json::to_value(settings.updates.clone().censored()).unwrap();

        json
    }
}

impl Deref for SettingsWriteGuard<'_> {
    type Target = AppSettings;

    fn deref(&self) -> &Self::Target {
        self.settings.as_ref().expect("settings have been dropped")
    }
}

impl DerefMut for SettingsWriteGuard<'_> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.settings.as_mut().expect("settings have been dropped")
    }
}

struct SettingsBuffer {
    settings: AppSettings,
    expires: std::time::Instant,
    invalidated: AtomicBool,
}

impl SettingsBuffer {
    fn new(settings: AppSettings, expires: std::time::Instant) -> Self {
        Self {
            settings,
            expires,
            invalidated: AtomicBool::new(false),
        }
    }

    #[inline]
    fn is_fresh(&self, now: std::time::Instant) -> bool {
        now < self.expires && !self.invalidated.load(Ordering::Acquire)
    }
}

pub struct Settings {
    // Every writer (refresh, `get_mut` + `save`, `invalidate_cache`) holds `write_serializing`
    // and publishes a whole new buffer. Readers never lock, so a long-lived `SettingsReadGuard`
    // only keeps its own snapshot alive.
    cached: arc_swap::ArcSwap<SettingsBuffer>,
    write_serializing: Semaphore,

    rendered_index_html: arc_swap::ArcSwap<RenderedIndexHtml>,
    inactive_extensions: arc_swap::ArcSwap<Vec<compact_str::CompactString>>,
    index_html_contributions:
        arc_swap::ArcSwap<crate::extensions::index_html::IndexHtmlContributions>,

    database: Arc<crate::database::Database>,
}

impl Settings {
    pub(crate) async fn fetch_settings_map(
        database: &Arc<crate::database::Database>,
    ) -> Result<HashMap<compact_str::CompactString, compact_str::CompactString>, anyhow::Error>
    {
        let rows = sqlx::query!("SELECT * FROM settings")
            .fetch_all(database.read())
            .await?;

        let mut map = HashMap::new();
        for row in rows {
            map.insert(row.key.into(), row.value.into());
        }

        Ok(map)
    }

    async fn fetch_settings(
        database: &Arc<crate::database::Database>,
    ) -> Result<AppSettings, anyhow::Error> {
        let mut map = Self::fetch_settings_map(database).await?;

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
        let settings = Self::fetch_settings(&database).await?;

        let rendered_index_html = arc_swap::ArcSwap::from_pointee(render_index_html(
            &settings,
            &[],
            &Default::default(),
        )?);

        Ok(Self {
            cached: arc_swap::ArcSwap::from_pointee(SettingsBuffer::new(
                settings,
                std::time::Instant::now() + std::time::Duration::from_secs(60),
            )),
            write_serializing: Semaphore::new(1),
            rendered_index_html,
            inactive_extensions: arc_swap::ArcSwap::from_pointee(Vec::new()),
            index_html_contributions: arc_swap::ArcSwap::from_pointee(Default::default()),
            database,
        })
    }

    #[inline]
    pub fn get_rendered_index_html(&self) -> Arc<RenderedIndexHtml> {
        self.rendered_index_html.load_full()
    }

    /// Package names are stored as frontend identifiers (`.` replaced by `_`).
    pub async fn set_inactive_extensions(
        &self,
        package_names: &[compact_str::CompactString],
    ) -> Result<(), anyhow::Error> {
        self.inactive_extensions.store(Arc::new(
            package_names
                .iter()
                .map(|package_name| package_name.replace('.', "_").into())
                .collect(),
        ));

        let settings = self.get().await?;
        self.rerender_index_html(&settings)?;

        Ok(())
    }

    /// Only stores the contributions, they are rendered by the following `set_inactive_extensions`.
    pub(crate) fn set_index_html_contributions(
        &self,
        contributions: crate::extensions::index_html::IndexHtmlContributions,
    ) {
        self.index_html_contributions.store(Arc::new(contributions));
    }

    fn rerender_index_html(&self, settings: &AppSettings) -> Result<(), anyhow::Error> {
        let rendered_index_html = render_index_html(
            settings,
            &self.inactive_extensions.load(),
            &self.index_html_contributions.load(),
        )?;

        self.rendered_index_html
            .store(Arc::new(rendered_index_html));

        Ok(())
    }

    pub async fn get(&self) -> Result<SettingsReadGuard<'_>, anyhow::Error> {
        let now = std::time::Instant::now();

        let buffer = self.cached.load_full();
        if buffer.is_fresh(now) {
            return Ok(SettingsReadGuard::new(buffer));
        }

        Ok(SettingsReadGuard::new(self.refresh(now).await?))
    }

    async fn refresh(&self, now: std::time::Instant) -> Result<Arc<SettingsBuffer>, anyhow::Error> {
        let _write_token = self.write_serializing.acquire().await?;

        let buffer = self.cached.load_full();
        if buffer.is_fresh(now) {
            return Ok(buffer);
        }

        let start = std::time::Instant::now();
        tracing::info!("settings cache expired, reloading from database");

        let settings = Self::fetch_settings(&self.database).await?;

        if let Err(err) = self.rerender_index_html(&settings) {
            tracing::error!("failed to re-render index.html after settings reload: {err:#}");
        }

        let buffer = Arc::new(SettingsBuffer::new(
            settings,
            now + std::time::Duration::from_secs(60),
        ));
        self.cached.store(Arc::clone(&buffer));

        tracing::info!(
            "reloaded settings from database in {} ms",
            start.elapsed().as_millis()
        );

        Ok(buffer)
    }

    pub async fn get_as<F: FnOnce(&AppSettings) -> T, T>(&self, f: F) -> Result<T, anyhow::Error> {
        let now = std::time::Instant::now();

        {
            let buffer = self.cached.load();
            if buffer.is_fresh(now) {
                return Ok(f(&buffer.settings));
            }
        }

        Ok(f(&self.refresh(now).await?.settings))
    }

    pub async fn get_webauthn(&self) -> Result<webauthn_rs::Webauthn, anyhow::Error> {
        let settings = self.get().await?;

        let rp_origin: reqwest::Url = settings.webauthn.rp_origin.parse()?;
        let mut builder = webauthn_rs::WebauthnBuilder::new(&settings.webauthn.rp_id, &rp_origin)?;

        for url in settings.app.urls() {
            let Ok(url) = reqwest::Url::parse(url) else {
                continue;
            };

            if url.origin() == rp_origin.origin() {
                continue;
            }

            // browsers reject credentials whose rp_id is not a registrable suffix of the page origin
            if url.domain().is_some_and(|domain| {
                domain == settings.webauthn.rp_id
                    || domain.ends_with(&format!(".{}", settings.webauthn.rp_id))
            }) {
                builder = builder.append_allowed_origin(&url);
            }
        }

        Ok(builder
            .rp_name(&settings.app.name)
            .timeout(std::time::Duration::from_secs(
                settings.webauthn.authentication_timeout_seconds,
            ))
            .build()?)
    }

    pub async fn get_mut(&self) -> Result<SettingsWriteGuard<'_>, anyhow::Error> {
        let writer_token = self.write_serializing.acquire().await?;

        Ok(SettingsWriteGuard {
            parent: self,
            settings: Some(Self::fetch_settings(&self.database).await?),
            _writer_token: writer_token,
        })
    }

    pub async fn set_oobe_step(
        &self,
        oobe_step: Option<compact_str::CompactString>,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ('::oobe_step', $1)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        )
        .bind(oobe_step.map(|s| s.to_string()).unwrap_or_default())
        .execute(self.database.write())
        .await?;

        self.invalidate_cache().await;

        Ok(())
    }

    pub async fn set_disabled_extensions(
        &self,
        disabled_extensions: &[compact_str::CompactString],
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ('::disabled_extensions', $1)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        )
        .bind(disabled_extensions.join(","))
        .execute(self.database.write())
        .await?;

        self.invalidate_cache().await;

        Ok(())
    }

    pub async fn set_extension_permissions(
        &self,
        extension_permissions: &BTreeMap<compact_str::CompactString, ExtensionPermissions>,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ('::extension_permissions', $1)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        )
        .bind(serde_json::to_string(extension_permissions).map_err(anyhow::Error::new)?)
        .execute(self.database.write())
        .await?;

        self.invalidate_cache().await;

        Ok(())
    }

    pub async fn cleanup_ratelimit_exempt_api_keys(&self) -> Result<usize, anyhow::Error> {
        let exempt_api_keys = self
            .get_as(|s| s.ratelimits.exempt_api_keys.clone())
            .await?;
        if exempt_api_keys.is_empty() {
            return Ok(0);
        }

        let existing: Vec<uuid::Uuid> =
            crate::models::user_api_key::UserApiKey::by_uuids(&self.database, &exempt_api_keys)
                .await?
                .into_iter()
                .map(|api_key| api_key.uuid)
                .collect();
        if existing.len() == exempt_api_keys.len() {
            return Ok(0);
        }

        let mut settings = self.get_mut().await?;
        let before = settings.ratelimits.exempt_api_keys.len();
        settings
            .ratelimits
            .exempt_api_keys
            .retain(|uuid| existing.contains(uuid));
        let removed = before - settings.ratelimits.exempt_api_keys.len();

        if removed > 0 {
            settings.save().await?;
        }

        Ok(removed)
    }

    pub async fn invalidate_cache(&self) {
        let Ok(_lock) = self.write_serializing.acquire().await else {
            return;
        };
        self.cached
            .load()
            .invalidated
            .store(true, Ordering::Release);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // RenderedIndexHtml
    #[test]
    fn rendered_index_html_puts_nonce_inside_script_src() {
        let rendered = RenderedIndexHtml {
            html: ArcedIndexHtml(Arc::new(String::new())),
            content_security_policy: "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' https://ext.example".into(),
            uses_script_nonce: true,
        };

        assert_eq!(
            rendered.content_security_policy(None),
            rendered.content_security_policy
        );

        let with_nonce = rendered.content_security_policy(Some("abc123"));
        let directives: Vec<_> = with_nonce.split("; ").collect();
        assert_eq!(directives.len(), 3);
        let script_src: Vec<_> = directives[2].split(' ').collect();
        assert_eq!(script_src[0], "script-src");
        assert!(script_src.contains(&"'self'"));
        assert!(script_src.contains(&"https://ext.example"));
        assert!(script_src.contains(&"'nonce-abc123'"));
        assert_eq!(
            directives[..2],
            ["default-src 'self'", "style-src 'self' 'unsafe-inline'"]
        );
    }

    // CaptchaProvider::to_csp_script_src / to_csp_style_src
    #[test]
    fn captcha_csp_sources_are_single_tokens() {
        for provider in [
            CaptchaProvider::None,
            CaptchaProvider::Turnstile {
                site_key: "public".into(),
                secret_key: "s3cr3t".into(),
            },
            CaptchaProvider::Recaptcha {
                v3: true,
                threshold: 0.5,
                site_key: "public".into(),
                secret_key: "s3cr3t".into(),
            },
            CaptchaProvider::Hcaptcha {
                site_key: "public".into(),
                secret_key: "s3cr3t".into(),
            },
            CaptchaProvider::FriendlyCaptcha {
                site_key: "public".into(),
                api_key: "s3cr3t".into(),
            },
            CaptchaProvider::Cap {
                api_url: "https://cap.example.com".into(),
                site_key: "public".into(),
                secret_key: "s3cr3t".into(),
            },
        ] {
            for source in provider
                .to_csp_script_src()
                .iter()
                .chain(provider.to_csp_style_src())
            {
                assert!(
                    !source.is_empty()
                        && !source.contains(|c: char| c.is_whitespace() || c == ';' || c == ','),
                    "{source:?}"
                );
            }
        }
    }

    #[test]
    fn storage_driver_censors_its_s3_credentials() {
        let value = serde_json::to_value(
            StorageDriver::S3 {
                public_url: "https://cdn.example.com".into(),
                access_key: "AKIAEXAMPLE".into(),
                secret_key: "s3cr3t".into(),
                bucket: "assets".into(),
                region: "eu-central-1".into(),
                endpoint: "https://s3.example.com".into(),
                path_style: false,
            }
            .censored(),
        )
        .unwrap();

        assert_eq!(value["access_key"], CENSORED_PLACEHOLDER);
        assert_eq!(value["secret_key"], CENSORED_PLACEHOLDER);

        assert_eq!(value["public_url"], "https://cdn.example.com");
        assert_eq!(value["bucket"], "assets");
        assert_eq!(value["region"], "eu-central-1");
    }

    #[test]
    fn mail_mode_censors_its_smtp_credentials() {
        let value = serde_json::to_value(
            MailMode::Smtp {
                host: "smtp.example.com".into(),
                port: 587,
                username: Some("panel@example.com".into()),
                password: Some("hunter2".into()),
                tls_mode: TlsMode::StartTls,
                skip_cert_validation: false,
                helo_domain: None,
                from_address: "panel@example.com".into(),
                from_name: Some("Panel".into()),
            }
            .censored(),
        )
        .unwrap();

        assert_eq!(value["username"], CENSORED_PLACEHOLDER);
        assert_eq!(value["password"], CENSORED_PLACEHOLDER);

        assert_eq!(value["host"], "smtp.example.com");
        assert_eq!(value["from_address"], "panel@example.com");
    }

    #[test]
    fn captcha_provider_censors_its_secret_but_not_its_site_key() {
        for provider in [
            CaptchaProvider::Cap {
                api_url: "https://cap.example.com".into(),
                site_key: "public".into(),
                secret_key: "s3cr3t".into(),
            },
            CaptchaProvider::Turnstile {
                site_key: "public".into(),
                secret_key: "s3cr3t".into(),
            },
            CaptchaProvider::Recaptcha {
                v3: true,
                threshold: 0.5,
                site_key: "public".into(),
                secret_key: "s3cr3t".into(),
            },
            CaptchaProvider::Hcaptcha {
                site_key: "public".into(),
                secret_key: "s3cr3t".into(),
            },
        ] {
            let value = serde_json::to_value(provider.censored()).unwrap();

            assert_eq!(value["secret_key"], CENSORED_PLACEHOLDER);
            assert_eq!(value["site_key"], "public");
        }

        let value = serde_json::to_value(
            CaptchaProvider::FriendlyCaptcha {
                site_key: "public".into(),
                api_key: "s3cr3t".into(),
            }
            .censored(),
        )
        .unwrap();

        assert_eq!(value["api_key"], CENSORED_PLACEHOLDER);
        assert_eq!(value["site_key"], "public");
    }

    #[test]
    fn cap_provider_validates_configuration_and_keeps_secrets_private() {
        for api_url in ["https://cap.example.com", "http://localhost:3000/cap/"] {
            let provider = CaptchaProvider::Cap {
                api_url: api_url.into(),
                site_key: "site-key_123".into(),
                secret_key: "secret".into(),
            };
            assert!(provider.validate().is_ok());
            let public = serde_json::to_value(provider.to_public_provider()).unwrap();
            assert_eq!(public["api_url"], api_url);
            assert_eq!(public["site_key"], "site-key_123");
            assert!(public.get("secret_key").is_none());

            let serialized = serde_json::to_value(&provider).unwrap();
            let restored: CaptchaProvider = serde_json::from_value(serialized.clone()).unwrap();
            assert_eq!(serde_json::to_value(restored).unwrap(), serialized);
        }

        for api_url in [
            "not a url",
            "file:///tmp/cap",
            "https://user:password@cap.example.com",
            "https://cap.example.com?query",
            "https://cap.example.com#fragment",
            "https://cap.example.com ",
            " https://cap.example.com",
        ] {
            let provider = CaptchaProvider::Cap {
                api_url: api_url.into(),
                site_key: "public".into(),
                secret_key: "secret".into(),
            };
            assert!(provider.validate().is_err(), "{api_url}");
        }

        for site_key in ["", "../other", "site/key", "site?query", "site#fragment"] {
            let provider = CaptchaProvider::Cap {
                api_url: "https://cap.example.com".into(),
                site_key: site_key.into(),
                secret_key: "secret".into(),
            };
            assert!(provider.validate().is_err(), "{site_key}");
        }
    }

    #[test]
    fn recaptcha_threshold_defaults_and_validates_bounds() {
        let provider: CaptchaProvider = serde_json::from_value(serde_json::json!({
            "type": "recaptcha",
            "v3": true,
            "site_key": "public",
            "secret_key": "secret",
        }))
        .unwrap();
        assert_eq!(serde_json::to_value(provider).unwrap()["threshold"], 0.5);

        for threshold in [
            0.0,
            0.5,
            0.9,
            1.0,
            -0.1,
            1.1,
            f64::NAN,
            f64::INFINITY,
            f64::NEG_INFINITY,
        ] {
            let provider = CaptchaProvider::Recaptcha {
                v3: true,
                threshold,
                site_key: "public".into(),
                secret_key: "secret".into(),
            };
            assert_eq!(
                provider.validate().is_ok(),
                (0.0..=1.0).contains(&threshold)
            );
            let public = serde_json::to_value(provider.to_public_provider()).unwrap();
            assert!(public.get("secret_key").is_none());
            assert!(public.get("threshold").is_none());
        }
    }

    #[test]
    fn settings_without_secrets_are_left_untouched() {
        let value = serde_json::to_value(
            StorageDriver::Filesystem {
                path: "/var/lib/panel/storage".into(),
            }
            .censored(),
        )
        .unwrap();

        assert_eq!(value["path"], "/var/lib/panel/storage");

        let value = serde_json::to_value(MailMode::None.censored()).unwrap();

        assert_eq!(value["type"], "none");

        let value = serde_json::to_value(CaptchaProvider::None.censored()).unwrap();

        assert_eq!(value["type"], "none");
    }

    // render_index_html
    #[test]
    fn render_index_template_renders_extension_boot_templates() {
        const SPINNER: &str = "<i>SPINNER</i>";
        static INDEX_HTML: std::sync::LazyLock<String> = std::sync::LazyLock::new(|| {
            let wrap = |id: &str, boot: &str| {
                format!(
                    r#"{{% if "{id}" not in inactive_extensions %}}{{% set boot %}}{{% filter boot_template("{id}") %}}{{% raw %}}{boot}{{% endraw %}}{{% endfilter %}}{{% endset %}}{{% if boot %}}{{{{ boot }}}}{{% else %}}{SPINNER}{{% endif %}}{{% else %}}{SPINNER}{{% endif %}}"#
                )
            };
            format!(
                "<html><head><title>t</title></head><body>[{}][{}]</body></html>",
                wrap("good_ext", "<p>{{ variables.x }}</p>"),
                wrap("bad_ext", "<p>{{ unclosed</p>"),
            )
        });
        let render = |inactive_extensions: &[compact_str::CompactString]| {
            let mut environment = minijinja::Environment::new();
            environment.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);

            render_index_template(
                environment,
                &INDEX_HTML,
                inactive_extensions,
                &crate::extensions::index_html::EvaluatedIndexHtmlVariables(Arc::new(
                    BTreeMap::from([
                        (
                            "good.ext",
                            serde_json::Map::from_iter([("x".into(), serde_json::json!("hello"))]),
                        ),
                        (
                            "bad.ext",
                            serde_json::Map::from_iter([("x".into(), serde_json::json!("unused"))]),
                        ),
                    ]),
                )),
            )
            .unwrap()
        };

        let active = render(&[]);
        assert!(
            active.contains(&format!("[<p>hello</p>][{SPINNER}]")),
            "{active}"
        );
        let block_start = active.find(r#"<script type="application/json""#).unwrap();
        assert!(block_start < active.find("</head>").unwrap());
        assert_eq!(active.matches("</head>").count(), 1);

        let inactive = render(&["good_ext".into()]);
        assert!(
            inactive.contains(&format!("[{SPINNER}][{SPINNER}]")),
            "{inactive}"
        );
    }
}
