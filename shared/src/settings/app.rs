use crate::prelude::StringExt;

use super::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};
use compact_str::ToCompactString;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TwoFactorRequirement {
    Admins,
    AllUsers,
    None,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TwoFactorMethod {
    Totp,
    SecurityKey,
    Email,
}

impl TwoFactorMethod {
    pub const ALL: &'static [TwoFactorMethod] = &[
        TwoFactorMethod::Totp,
        TwoFactorMethod::SecurityKey,
        TwoFactorMethod::Email,
    ];
    pub const DEFAULT_ACCEPTED: &'static [TwoFactorMethod] =
        &[TwoFactorMethod::Totp, TwoFactorMethod::SecurityKey];
}

#[derive(Clone, ToSchema, Serialize, Deserialize)]
pub struct AppSettingsApp {
    pub name: compact_str::CompactString,
    pub icon: compact_str::CompactString,
    pub icon_light: Option<compact_str::CompactString>,
    pub banner: Option<compact_str::CompactString>,
    pub banner_light: Option<compact_str::CompactString>,
    pub url: compact_str::CompactString,
    pub additional_urls: Vec<compact_str::CompactString>,
    pub language: compact_str::CompactString,
    pub two_factor_requirement: TwoFactorRequirement,
    pub email_two_factor_enabled: bool,
    pub two_factor_accepted_methods: Vec<TwoFactorMethod>,

    pub email_verification_required: bool,

    pub session_cookie: compact_str::CompactString,
    pub session_duration_seconds: u64,

    pub telemetry_enabled: bool,
    pub registration_enabled: bool,
    pub password_login_enabled: bool,
}

impl AppSettingsApp {
    pub fn urls(&self) -> impl Iterator<Item = &str> {
        std::iter::once(&*self.url).chain(self.additional_urls.iter().map(|url| &**url))
    }

    /// Resolves the configured url whose authority matches the request host, falling back to
    /// the primary url. Only ever returns configured values, so a spoofed host cannot leak into
    /// generated links.
    pub fn url_for_host(&self, host: Option<&str>) -> &str {
        let Some((host, port)) = host.and_then(split_host_port) else {
            return &self.url;
        };

        self.urls()
            .find(|url| {
                reqwest::Url::parse(url).is_ok_and(|url| {
                    url.host_str()
                        .is_some_and(|url_host| url_host.eq_ignore_ascii_case(host))
                        && port.or_else(|| default_port(url.scheme()))
                            == url.port_or_known_default()
                })
            })
            .unwrap_or(&self.url)
    }
}

fn default_port(scheme: &str) -> Option<u16> {
    match scheme {
        "http" => Some(80),
        "https" => Some(443),
        _ => None,
    }
}

fn split_host_port(authority: &str) -> Option<(&str, Option<u16>)> {
    let (host, port) = if authority.starts_with('[') {
        let end = authority.find(']')?;
        (&authority[..=end], authority[end + 1..].strip_prefix(':'))
    } else {
        match authority.rsplit_once(':') {
            Some((host, port)) => (host, Some(port)),
            None => (authority, None),
        }
    };

    let port = match port {
        Some(port) => Some(port.parse().ok()?),
        None => None,
    };

    Some((host, port))
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
            .write_raw_setting("icon_light", self.icon_light.as_deref().unwrap_or(""))
            .write_raw_setting("banner", self.banner.as_deref().unwrap_or(""))
            .write_raw_setting("banner_light", self.banner_light.as_deref().unwrap_or(""))
            .write_raw_setting("url", &*self.url)
            .write_serde_setting("additional_urls", &self.additional_urls)?
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
                "email_two_factor_enabled",
                self.email_two_factor_enabled.to_compact_string(),
            )
            .write_serde_setting(
                "two_factor_accepted_methods",
                &self.two_factor_accepted_methods,
            )?
            .write_raw_setting(
                "email_verification_required",
                self.email_verification_required.to_compact_string(),
            )
            .write_raw_setting("session_cookie", &*self.session_cookie)
            .write_raw_setting(
                "session_duration_seconds",
                self.session_duration_seconds.to_compact_string(),
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
                "password_login_enabled",
                self.password_login_enabled.to_compact_string(),
            ))
    }
}

impl AppSettingsApp {
    #[cfg(test)]
    pub fn mock() -> Self {
        Self {
            name: "Calagopus".into(),
            icon: "/icon.svg".into(),
            icon_light: None,
            banner: None,
            banner_light: None,
            url: "http://localhost:8000".into(),
            additional_urls: Vec::new(),
            language: "en".into(),
            two_factor_requirement: TwoFactorRequirement::None,
            email_two_factor_enabled: false,
            two_factor_accepted_methods: TwoFactorMethod::DEFAULT_ACCEPTED.to_vec(),
            email_verification_required: false,
            session_cookie: "calagopus_session".into(),
            session_duration_seconds: 7 * 24 * 3600,
            telemetry_enabled: true,
            registration_enabled: true,
            password_login_enabled: true,
        }
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
            icon_light: deserializer
                .take_raw_setting("icon_light")
                .and_then(|s| s.into_optional()),
            banner: deserializer
                .take_raw_setting("banner")
                .and_then(|s| s.into_optional()),
            banner_light: deserializer
                .take_raw_setting("banner_light")
                .and_then(|s| s.into_optional()),
            url: deserializer
                .take_raw_setting("url")
                .unwrap_or_else(|| "http://localhost:8000".into()),
            additional_urls: deserializer
                .read_serde_setting("additional_urls")
                .unwrap_or_default(),
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
            email_two_factor_enabled: deserializer
                .take_raw_setting("email_two_factor_enabled")
                .map(|s| s == "true")
                .unwrap_or(false),
            two_factor_accepted_methods: deserializer
                .read_serde_setting("two_factor_accepted_methods")
                .unwrap_or_else(|_| TwoFactorMethod::DEFAULT_ACCEPTED.to_vec()),
            email_verification_required: deserializer
                .take_raw_setting("email_verification_required")
                .map(|s| s == "true")
                .unwrap_or(false),
            session_cookie: deserializer
                .take_raw_setting("session_cookie")
                .unwrap_or_else(|| "calagopus_session".into()),
            session_duration_seconds: deserializer
                .take_raw_setting("session_duration_seconds")
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(7 * 24 * 3600),
            telemetry_enabled: deserializer
                .take_raw_setting("telemetry_enabled")
                .map(|s| s == "true")
                .unwrap_or(true),
            registration_enabled: deserializer
                .take_raw_setting("registration_enabled")
                .map(|s| s == "true")
                .unwrap_or(true),
            password_login_enabled: deserializer
                .take_raw_setting("password_login_enabled")
                .map(|s| s == "true")
                .unwrap_or(true),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app(url: &str, additional: &[&str]) -> AppSettingsApp {
        AppSettingsApp {
            name: "Panel".into(),
            icon: "/icon.svg".into(),
            icon_light: None,
            banner: None,
            banner_light: None,
            url: url.into(),
            additional_urls: additional.iter().map(|u| (*u).into()).collect(),
            language: "en".into(),
            two_factor_requirement: TwoFactorRequirement::None,
            email_two_factor_enabled: false,
            two_factor_accepted_methods: Vec::new(),
            email_verification_required: false,
            session_cookie: "session".into(),
            session_duration_seconds: 3600,
            telemetry_enabled: false,
            registration_enabled: true,
            password_login_enabled: true,
        }
    }

    // AppSettingsApp::urls
    #[test]
    fn urls_yields_primary_then_additional_in_order() {
        let settings = app("https://a.com", &["https://b.com", "https://c.com"]);

        assert_eq!(
            settings.urls().collect::<Vec<_>>(),
            ["https://a.com", "https://b.com", "https://c.com"]
        );
    }

    // AppSettingsApp::url_for_host
    #[test]
    fn url_for_host_matches_additional_url() {
        let settings = app("https://a.com", &["https://b.com"]);

        assert_eq!(settings.url_for_host(Some("b.com")), "https://b.com");
    }

    #[test]
    fn url_for_host_applies_default_port_when_url_omits_it() {
        let settings = app("https://a.com", &["https://b.com"]);

        assert_eq!(settings.url_for_host(Some("b.com:443")), "https://b.com");
    }

    #[test]
    fn url_for_host_applies_default_port_when_host_omits_it() {
        let settings = app("https://a.com", &["https://b.com:8443"]);

        assert_eq!(settings.url_for_host(Some("b.com")), "https://a.com");
    }

    #[test]
    fn url_for_host_rejects_explicit_port_mismatch() {
        let settings = app("https://a.com", &["http://b.com:8080"]);

        assert_eq!(settings.url_for_host(Some("b.com:8081")), "https://a.com");
        assert_eq!(
            settings.url_for_host(Some("b.com:8080")),
            "http://b.com:8080"
        );
    }

    #[test]
    fn url_for_host_compares_hosts_case_insensitively() {
        let settings = app("https://a.com", &["https://Panel.Example.COM"]);

        assert_eq!(
            settings.url_for_host(Some("panel.example.com")),
            "https://Panel.Example.COM"
        );
    }

    #[test]
    fn url_for_host_matches_bracketed_ipv6_host() {
        let settings = app("https://a.com", &["http://[::1]:8000"]);

        assert_eq!(
            settings.url_for_host(Some("[::1]:8000")),
            "http://[::1]:8000"
        );
    }

    #[test]
    fn url_for_host_picks_first_configured_when_schemes_share_host() {
        let settings = app(
            "https://a.com",
            &["http://b.com:8000", "https://b.com:8000"],
        );

        assert_eq!(
            settings.url_for_host(Some("b.com:8000")),
            "http://b.com:8000"
        );
    }

    #[test]
    fn url_for_host_falls_back_to_primary_without_match() {
        let settings = app("https://a.com", &["https://b.com"]);

        assert_eq!(settings.url_for_host(None), "https://a.com");
        assert_eq!(settings.url_for_host(Some("evil.com")), "https://a.com");
        assert_eq!(
            settings.url_for_host(Some("b.com:notaport")),
            "https://a.com"
        );
        assert_eq!(settings.url_for_host(Some("b.com:99999")), "https://a.com");
    }

    #[test]
    fn url_for_host_matches_configured_url_with_trailing_slash() {
        let settings = app("https://a.com", &["https://b.com/"]);

        assert_eq!(settings.url_for_host(Some("b.com")), "https://b.com/");
    }
}
