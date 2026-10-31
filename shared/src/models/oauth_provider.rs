use crate::{
    crypt::EncryptedString,
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use futures_util::TryStreamExt;
use garde::Validate;
use indexmap::IndexMap;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[inline]
fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OAuthProvider {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub icon: Option<compact_str::CompactString>,

    pub client_id: compact_str::CompactString,
    pub client_secret: Option<EncryptedString>,
    pub auth_url: String,
    pub token_url: String,
    pub info_url: String,
    pub info_urls: IndexMap<compact_str::CompactString, String>,
    pub scopes: Vec<compact_str::CompactString>,

    pub identifier_path: String,
    pub email_path: Option<String>,
    pub username_path: Option<String>,
    pub name_first_path: Option<String>,
    pub name_last_path: Option<String>,
    pub avatar_url_template: Option<String>,
    pub avatar_overwrite: bool,

    pub enabled: bool,
    pub login_viewable: bool,
    pub login_only: bool,
    pub login_bypass_two_factor: bool,
    pub link_viewable: bool,
    pub api_linkable: bool,
    pub user_manageable: bool,
    pub basic_auth: bool,
    pub pkce: bool,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for OAuthProvider {
    const NAME: &'static str = "oauth_provider";

    fn get_extension_list() -> &'static super::ModelExtensionList {
        static EXTENSIONS: LazyLock<super::ModelExtensionList> =
            LazyLock::new(|| parking_lot::RwLock::new(Vec::new()));

        &EXTENSIONS
    }

    fn get_extension_data(&self) -> &super::ModelExtensionData {
        &self.extension_data
    }

    #[inline]
    fn base_columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString> {
        let prefix = prefix.unwrap_or_default();

        BTreeMap::from([
            (
                "oauth_providers.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "oauth_providers.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "oauth_providers.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "oauth_providers.icon",
                compact_str::format_compact!("{prefix}icon"),
            ),
            (
                "oauth_providers.client_id",
                compact_str::format_compact!("{prefix}client_id"),
            ),
            (
                "oauth_providers.client_secret",
                compact_str::format_compact!("{prefix}client_secret"),
            ),
            (
                "oauth_providers.auth_url",
                compact_str::format_compact!("{prefix}auth_url"),
            ),
            (
                "oauth_providers.token_url",
                compact_str::format_compact!("{prefix}token_url"),
            ),
            (
                "oauth_providers.info_url",
                compact_str::format_compact!("{prefix}info_url"),
            ),
            (
                "oauth_providers.info_urls",
                compact_str::format_compact!("{prefix}info_urls"),
            ),
            (
                "oauth_providers.scopes",
                compact_str::format_compact!("{prefix}scopes"),
            ),
            (
                "oauth_providers.identifier_path",
                compact_str::format_compact!("{prefix}identifier_path"),
            ),
            (
                "oauth_providers.email_path",
                compact_str::format_compact!("{prefix}email_path"),
            ),
            (
                "oauth_providers.username_path",
                compact_str::format_compact!("{prefix}username_path"),
            ),
            (
                "oauth_providers.name_first_path",
                compact_str::format_compact!("{prefix}name_first_path"),
            ),
            (
                "oauth_providers.name_last_path",
                compact_str::format_compact!("{prefix}name_last_path"),
            ),
            (
                "oauth_providers.avatar_url_template",
                compact_str::format_compact!("{prefix}avatar_url_template"),
            ),
            (
                "oauth_providers.avatar_overwrite",
                compact_str::format_compact!("{prefix}avatar_overwrite"),
            ),
            (
                "oauth_providers.enabled",
                compact_str::format_compact!("{prefix}enabled"),
            ),
            (
                "oauth_providers.login_viewable",
                compact_str::format_compact!("{prefix}login_viewable"),
            ),
            (
                "oauth_providers.login_only",
                compact_str::format_compact!("{prefix}login_only"),
            ),
            (
                "oauth_providers.login_bypass_two_factor",
                compact_str::format_compact!("{prefix}login_bypass_two_factor"),
            ),
            (
                "oauth_providers.link_viewable",
                compact_str::format_compact!("{prefix}link_viewable"),
            ),
            (
                "oauth_providers.api_linkable",
                compact_str::format_compact!("{prefix}api_linkable"),
            ),
            (
                "oauth_providers.user_manageable",
                compact_str::format_compact!("{prefix}user_manageable"),
            ),
            (
                "oauth_providers.basic_auth",
                compact_str::format_compact!("{prefix}basic_auth"),
            ),
            (
                "oauth_providers.pkce",
                compact_str::format_compact!("{prefix}pkce"),
            ),
            (
                "oauth_providers.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            icon: row.try_get(compact_str::format_compact!("{prefix}icon").as_str())?,
            client_id: row.try_get(compact_str::format_compact!("{prefix}client_id").as_str())?,
            client_secret: row
                .try_get(compact_str::format_compact!("{prefix}client_secret").as_str())?,
            auth_url: row.try_get(compact_str::format_compact!("{prefix}auth_url").as_str())?,
            token_url: row.try_get(compact_str::format_compact!("{prefix}token_url").as_str())?,
            info_url: row.try_get(compact_str::format_compact!("{prefix}info_url").as_str())?,
            info_urls: serde_json::from_value(row.try_get::<serde_json::Value, _>(
                compact_str::format_compact!("{prefix}info_urls").as_str(),
            )?)?,
            scopes: row.try_get(compact_str::format_compact!("{prefix}scopes").as_str())?,
            identifier_path: row
                .try_get(compact_str::format_compact!("{prefix}identifier_path").as_str())?,
            email_path: row.try_get(compact_str::format_compact!("{prefix}email_path").as_str())?,
            username_path: row
                .try_get(compact_str::format_compact!("{prefix}username_path").as_str())?,
            name_first_path: row
                .try_get(compact_str::format_compact!("{prefix}name_first_path").as_str())?,
            name_last_path: row
                .try_get(compact_str::format_compact!("{prefix}name_last_path").as_str())?,
            avatar_url_template: row
                .try_get(compact_str::format_compact!("{prefix}avatar_url_template").as_str())?,
            avatar_overwrite: row
                .try_get(compact_str::format_compact!("{prefix}avatar_overwrite").as_str())?,
            enabled: row.try_get(compact_str::format_compact!("{prefix}enabled").as_str())?,
            login_viewable: row
                .try_get(compact_str::format_compact!("{prefix}login_viewable").as_str())?,
            login_only: row.try_get(compact_str::format_compact!("{prefix}login_only").as_str())?,
            login_bypass_two_factor: row.try_get(
                compact_str::format_compact!("{prefix}login_bypass_two_factor").as_str(),
            )?,
            link_viewable: row
                .try_get(compact_str::format_compact!("{prefix}link_viewable").as_str())?,
            api_linkable: row
                .try_get(compact_str::format_compact!("{prefix}api_linkable").as_str())?,
            user_manageable: row
                .try_get(compact_str::format_compact!("{prefix}user_manageable").as_str())?,
            basic_auth: row.try_get(compact_str::format_compact!("{prefix}basic_auth").as_str())?,
            pkce: row.try_get(compact_str::format_compact!("{prefix}pkce").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }

    fn cache_invalidation_keys(&self) -> Vec<compact_str::CompactString> {
        vec![
            compact_str::format_compact!("{}::{}", Self::NAME, self.uuid),
            compact_str::CompactString::const_new("oauth_providers::usable"),
            crate::icons::REFERENCED_ICONS_CACHE_KEY.into(),
        ]
    }
}

pub struct OAuthProviderInfo {
    pub info: serde_json::Value,
    pub sources: IndexMap<compact_str::CompactString, serde_json::Value>,
}

impl OAuthProviderInfo {
    pub fn source(&self, source: Option<&str>) -> Option<&serde_json::Value> {
        match source {
            Some(source) => self.sources.get(source),
            None => Some(&self.info),
        }
    }
}

impl OAuthProvider {
    const MAX_AVATAR_URL_LENGTH: usize = 2048;
    const MAX_DISCOVERY_SIZE: usize = 64 * 1024;
    const MAX_INFO_SIZE: usize = 1024 * 1024;
    const INFO_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);
    const MAX_LOGGED_BODY_SIZE: usize = 4096;

    /// Fetches the info url and every additional info url with the user's access token.
    ///
    /// An additional info url responding with 404 is left out of the sources, so matchers on it
    /// fail as for a user outside of e.g. a discord guild. Any other failure aborts, since mappings
    /// revoking on a transient error would strip access the user still has.
    pub async fn fetch_info(
        &self,
        client: &reqwest::Client,
        access_token: &str,
    ) -> Result<OAuthProviderInfo, anyhow::Error> {
        let info = async {
            match Self::fetch_info_url(client, &self.info_url, access_token).await {
                Ok(Some(info)) => Ok(info),
                Ok(None) => Err(anyhow::anyhow!("info url responded with 404")),
                Err(err) => Err(err),
            }
            .map_err(|err| {
                tracing::warn!(
                    oauth_provider = %self.uuid,
                    "failed to fetch oauth info url: {:#?}",
                    err
                );

                anyhow::Error::from(crate::response::DisplayError::new(
                    "failed to fetch oauth user info",
                ))
            })
        };

        let sources = futures_util::future::try_join_all(self.info_urls.iter().map(
            |(key, url)| async move {
                match Self::fetch_info_url(client, url, access_token).await {
                    Ok(value) => Ok(value.map(|value| (key.clone(), value))),
                    Err(err) => {
                        tracing::warn!(
                            oauth_provider = %self.uuid,
                            key = %key,
                            "failed to fetch additional oauth info url: {:#?}",
                            err
                        );

                        Err(anyhow::Error::from(crate::response::DisplayError::new(
                            format!("failed to fetch additional oauth user info ({key})"),
                        )))
                    }
                }
            },
        ));

        let (info, sources) = tokio::try_join!(info, sources)?;

        Ok(OAuthProviderInfo {
            info,
            sources: sources.into_iter().flatten().collect(),
        })
    }

    async fn fetch_info_url(
        client: &reqwest::Client,
        url: &str,
        access_token: &str,
    ) -> Result<Option<serde_json::Value>, anyhow::Error> {
        let response = client
            .get(url)
            .bearer_auth(access_token)
            .timeout(Self::INFO_TIMEOUT)
            .send()
            .await?;

        let status = response.status();
        if status == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        let mut content = Vec::new();
        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.try_next().await? {
            if content.len() + chunk.len() > Self::MAX_INFO_SIZE {
                return Err(anyhow::anyhow!("response is too large"));
            }

            content.extend_from_slice(&chunk);
        }

        let body = || {
            crate::utils::slice_up_to(
                &String::from_utf8_lossy(&content),
                Self::MAX_LOGGED_BODY_SIZE,
            )
            .to_string()
        };

        if !status.is_success() {
            return Err(anyhow::anyhow!(
                "responded with status {status}: {}",
                body()
            ));
        }

        match serde_json::from_slice(&content) {
            Ok(value) => Ok(Some(value)),
            Err(err) => Err(anyhow::anyhow!(
                "responded with invalid json ({err}): {}",
                body()
            )),
        }
    }

    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM oauth_providers
                WHERE {search}
                "#,
                search = super::search_sql(1, &["oauth_providers.name"], &["oauth_providers.uuid"]),
            ),
            "oauth_providers.created, oauth_providers.uuid",
        )
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn exists_usable_except(
        database: &crate::database::Database,
        except: Option<uuid::Uuid>,
    ) -> Result<bool, sqlx::Error> {
        sqlx::query_scalar!(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM oauth_providers
                WHERE oauth_providers.enabled = true
                    AND ($1::uuid IS NULL OR oauth_providers.uuid != $1)
            ) AS "exists!"
            "#,
            except
        )
        .fetch_one(database.read())
        .await
    }

    pub async fn exists_registrable(
        database: &crate::database::Database,
    ) -> Result<bool, sqlx::Error> {
        sqlx::query_scalar!(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM oauth_providers
                WHERE oauth_providers.enabled = true AND oauth_providers.login_only = false
            ) AS "exists!"
            "#
        )
        .fetch_one(database.read())
        .await
    }

    pub async fn all_by_usable(
        database: &crate::database::Database,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM oauth_providers
            WHERE oauth_providers.enabled = true
            ORDER BY oauth_providers.created, oauth_providers.uuid
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    /// Looks up a required field in the info url response. The response never ends up in the
    /// returned error, as that is shown to whoever is logging in, so it is logged instead.
    fn extract_required<'a>(
        &self,
        field: &str,
        path: &str,
        value: &'a serde_json::Value,
    ) -> Result<&'a serde_json::Value, anyhow::Error> {
        match serde_json_path::JsonPath::parse(path)?.query(value).first() {
            Some(node) => Ok(node),
            None => {
                tracing::warn!(
                    oauth_provider = %self.uuid,
                    field,
                    path,
                    "unable to extract {field} from oauth info url response: {value}"
                );

                Err(crate::response::DisplayError::new(format!(
                    "unable to extract {field} from oauth user info"
                ))
                .into())
            }
        }
    }

    pub fn extract_identifier(&self, value: &serde_json::Value) -> Result<String, anyhow::Error> {
        Ok(
            match self.extract_required("identifier", &self.identifier_path, value)? {
                serde_json::Value::String(string) => {
                    crate::utils::truncate_up_to(string.clone(), 255)
                }
                val => crate::utils::truncate_up_to(val.to_string(), 255),
            },
        )
    }

    pub fn extract_email(&self, value: &serde_json::Value) -> Result<String, anyhow::Error> {
        let Some(path) = &self.email_path else {
            return Ok(format!(
                "{}@oauth.c7s.rs",
                rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 10)
            ));
        };

        Ok(match self.extract_required("email", path, value)? {
            serde_json::Value::String(string) => crate::utils::truncate_up_to(string.clone(), 255),
            val => crate::utils::truncate_up_to(val.to_string(), 255),
        })
    }

    pub fn extract_username(&self, value: &serde_json::Value) -> Result<String, anyhow::Error> {
        let Some(path) = &self.username_path else {
            return Ok(rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 10));
        };

        Ok(match self.extract_required("username", path, value)? {
            serde_json::Value::String(string) => crate::utils::truncate_up_to(string.clone(), 15),
            val => crate::utils::truncate_up_to(val.to_string(), 15),
        })
    }

    fn extract_optional_name(
        path: Option<&String>,
        value: &serde_json::Value,
    ) -> Result<Option<String>, anyhow::Error> {
        let path = match path {
            Some(path) => serde_json_path::JsonPath::parse(path)?,
            None => return Ok(None),
        };

        Ok(match path.query(value).first() {
            None | Some(serde_json::Value::Null) => None,
            Some(serde_json::Value::String(string)) => {
                if string.is_empty() {
                    None
                } else {
                    Some(crate::utils::truncate_up_to(string.clone(), 255))
                }
            }
            Some(val) => Some(crate::utils::truncate_up_to(val.to_string(), 255)),
        })
    }

    pub fn extract_name_first(
        &self,
        value: &serde_json::Value,
    ) -> Result<Option<String>, anyhow::Error> {
        Self::extract_optional_name(self.name_first_path.as_ref(), value)
    }

    pub fn extract_name_last(
        &self,
        value: &serde_json::Value,
    ) -> Result<Option<String>, anyhow::Error> {
        Self::extract_optional_name(self.name_last_path.as_ref(), value)
    }

    /// Resolves `avatar_url_template` against a provider's user info response, substituting every
    /// `{$.json.path}` placeholder with the value found at that path.
    ///
    /// A template that is nothing but a single placeholder yields that value verbatim, for the
    /// providers that hand back a whole avatar url (`{$.picture}`). Anywhere else the placeholder
    /// stands for one path or query component and its value is percent-encoded, so that a provider
    /// returning a crafted value cannot rewrite the rest of the url
    /// (`https://cdn.discordapp.com/avatars/{$.id}/{$.avatar}.png`).
    ///
    /// Yields `None` when no template is configured or when any placeholder resolves to nothing,
    /// which is the ordinary "this user has no avatar" case rather than an error.
    pub fn extract_avatar_url(
        &self,
        value: &serde_json::Value,
    ) -> Result<Option<String>, anyhow::Error> {
        match &self.avatar_url_template {
            Some(template) => Self::resolve_avatar_url_template(template, value),
            None => Ok(None),
        }
    }

    fn resolve_avatar_url_template(
        template: &str,
        value: &serde_json::Value,
    ) -> Result<Option<String>, anyhow::Error> {
        let verbatim = template.starts_with('{')
            && template.ends_with('}')
            && template.matches('{').count() == 1;

        let mut url = String::new();
        let mut rest = template;

        while let Some(start) = rest.find('{') {
            let Some(end) = rest[start..].find('}').map(|end| start + end) else {
                return Err(crate::response::DisplayError::new(
                    "unterminated placeholder in avatar url template",
                )
                .into());
            };

            url.push_str(&rest[..start]);

            let resolved = match serde_json_path::JsonPath::parse(&rest[start + 1..end])?
                .query(value)
                .first()
            {
                None | Some(serde_json::Value::Null) => return Ok(None),
                Some(serde_json::Value::String(string)) if string.is_empty() => return Ok(None),
                Some(serde_json::Value::String(string)) => string.clone(),
                Some(val) => val.to_string(),
            };

            if verbatim {
                url.push_str(&resolved);
            } else {
                url.push_str(&urlencoding::encode(&resolved));
            }

            rest = &rest[end + 1..];
        }

        url.push_str(rest);

        if url.len() > Self::MAX_AVATAR_URL_LENGTH {
            return Err(
                crate::response::DisplayError::new("resolved avatar url is too long").into(),
            );
        }

        let url = reqwest::Url::parse(&url)?;
        if !matches!(url.scheme(), "http" | "https") {
            return Err(crate::response::DisplayError::new(format!(
                "avatar url scheme {} is not http or https",
                url.scheme()
            ))
            .into());
        }

        Ok(Some(url.into()))
    }

    /// Fetches an OpenID Connect discovery document and derives provider settings from it.
    ///
    /// `url` may be either the issuer or the full `/.well-known/openid-configuration` url. Claim
    /// paths are only filled in when the provider advertises the claim, as a configured path that
    /// is missing from the userinfo response fails the login.
    pub async fn discover(
        state: &crate::State,
        url: &reqwest::Url,
    ) -> Result<DiscoveredOAuthProvider, anyhow::Error> {
        const WELL_KNOWN_PATH: &str = "/.well-known/openid-configuration";

        let mut url = url.clone();
        if !url.path().ends_with(WELL_KNOWN_PATH) {
            let path = format!("{}{WELL_KNOWN_PATH}", url.path().trim_end_matches('/'));
            url.set_path(&path);
            url.set_query(None);
        }
        url.set_fragment(None);

        let request =
            match crate::net::outbound_request(&state.env, reqwest::Method::GET, url.clone()) {
                Ok(request) => request,
                Err(err) => {
                    return Err(crate::response::DisplayError::new(format!(
                        "failed to fetch {url}: {err:#}"
                    ))
                    .into());
                }
            };

        let response = match request
            .header(reqwest::header::ACCEPT, "application/json")
            .send()
            .await
        {
            Ok(response) => response,
            Err(err) => {
                return Err(crate::response::DisplayError::new(format!(
                    "failed to fetch {url}: {:#}",
                    anyhow::Error::from(err)
                ))
                .into());
            }
        };

        if !response.status().is_success() {
            return Err(crate::response::DisplayError::new(format!(
                "{url} responded with status {}",
                response.status()
            ))
            .into());
        }

        let mut content = Vec::new();
        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.try_next().await? {
            if content.len() + chunk.len() > Self::MAX_DISCOVERY_SIZE {
                return Err(crate::response::DisplayError::new(
                    "openid configuration is too large",
                )
                .into());
            }

            content.extend_from_slice(&chunk);
        }

        let Ok(configuration) = serde_json::from_slice::<OpenIdConfiguration>(&content) else {
            return Err(crate::response::DisplayError::new(format!(
                "{url} did not return a valid openid configuration"
            ))
            .into());
        };

        let Some(info_url) = configuration.userinfo_endpoint else {
            return Err(crate::response::DisplayError::new(
                "openid configuration does not include a userinfo endpoint",
            )
            .into());
        };

        let lists = |list: &Option<Vec<String>>, item: &str| {
            list.as_ref()
                .is_none_or(|list| list.iter().any(|entry| entry == item))
        };
        let scope_email = lists(&configuration.scopes_supported, "email");
        let scope_profile = lists(&configuration.scopes_supported, "profile");
        let profile_claim =
            |claim: &str| scope_profile && lists(&configuration.claims_supported, claim);

        let graph_userinfo = reqwest::Url::parse(&info_url)
            .is_ok_and(|info_url| info_url.host_str() == Some("graph.microsoft.com"));

        let mut scopes = vec![compact_str::CompactString::const_new("openid")];
        if scope_email {
            scopes.push("email".into());
        }
        if scope_profile {
            scopes.push("profile".into());
        }

        let name = reqwest::Url::parse(&configuration.issuer)
            .ok()
            .and_then(|issuer| issuer.host_str().map(Into::into))
            .or_else(|| url.host_str().map(Into::into))
            .unwrap_or_else(|| configuration.issuer.as_str().into());

        Ok(DiscoveredOAuthProvider {
            name,
            auth_url: configuration.authorization_endpoint,
            token_url: configuration.token_endpoint,
            info_url,
            scopes,
            identifier_path: "$.sub".into(),
            email_path: (scope_email && lists(&configuration.claims_supported, "email"))
                .then(|| "$.email".into()),
            username_path: (profile_claim("preferred_username") && !graph_userinfo)
                .then(|| "$.preferred_username".into()),
            name_first_path: profile_claim("given_name").then(|| "$.given_name".into()),
            name_last_path: profile_claim("family_name").then(|| "$.family_name".into()),
            avatar_url_template: (profile_claim("picture") && !graph_userinfo)
                .then(|| "{$.picture}".into()),
            basic_auth: configuration
                .token_endpoint_auth_methods_supported
                .is_some_and(|methods| {
                    !methods.iter().any(|method| method == "client_secret_post")
                        && methods.iter().any(|method| method == "client_secret_basic")
                }),
            pkce: configuration
                .code_challenge_methods_supported
                .is_some_and(|methods| methods.iter().any(|method| method == "S256")),
        })
    }
}

#[derive(Deserialize)]
struct OpenIdConfiguration {
    issuer: String,
    authorization_endpoint: String,
    token_endpoint: String,
    userinfo_endpoint: Option<String>,
    scopes_supported: Option<Vec<String>>,
    claims_supported: Option<Vec<String>>,
    code_challenge_methods_supported: Option<Vec<String>>,
    token_endpoint_auth_methods_supported: Option<Vec<String>>,
}

#[derive(ToSchema, Serialize)]
pub struct DiscoveredOAuthProvider {
    pub name: compact_str::CompactString,

    pub auth_url: String,
    pub token_url: String,
    pub info_url: String,
    pub scopes: Vec<compact_str::CompactString>,

    pub identifier_path: String,
    pub email_path: Option<String>,
    pub username_path: Option<String>,
    pub name_first_path: Option<String>,
    pub name_last_path: Option<String>,
    pub avatar_url_template: Option<String>,

    pub basic_auth: bool,
    pub pkce: bool,
}

#[async_trait::async_trait]
impl IntoAdminApiObject for OAuthProvider {
    type AdminApiObject = AdminApiOAuthProvider;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiOAuthProvider::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiOAuthProvider {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                icon: self.icon,
                client_id: self.client_id,
                client_secret: match self.client_secret {
                    Some(client_secret) => Some(client_secret.decrypt(&state.database).await?),
                    None => None,
                },
                auth_url: self.auth_url,
                token_url: self.token_url,
                info_url: self.info_url,
                info_urls: self.info_urls,
                scopes: self.scopes,
                identifier_path: self.identifier_path,
                email_path: self.email_path,
                username_path: self.username_path,
                name_first_path: self.name_first_path,
                name_last_path: self.name_last_path,
                avatar_url_template: self.avatar_url_template,
                avatar_overwrite: self.avatar_overwrite,
                enabled: self.enabled,
                login_viewable: self.login_viewable,
                login_only: self.login_only,
                login_bypass_two_factor: self.login_bypass_two_factor,
                link_viewable: self.link_viewable,
                api_linkable: self.api_linkable,
                user_manageable: self.user_manageable,
                basic_auth: self.basic_auth,
                pkce: self.pkce,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for OAuthProvider {
    type ApiObject = ApiOAuthProvider;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiOAuthProvider::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiOAuthProvider {
                uuid: self.uuid,
                name: self.name,
                icon: self.icon,
                link_viewable: self.link_viewable,
                user_manageable: self.user_manageable,
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for OAuthProvider {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM oauth_providers
            WHERE oauth_providers.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }

    async fn by_uuid_with_transaction(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM oauth_providers
            WHERE oauth_providers.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

const MAX_INFO_URLS: usize = 8;
const MAX_INFO_URL_LENGTH: usize = 2048;

pub fn validate_info_urls(
    info_urls: &IndexMap<compact_str::CompactString, String>,
    _context: &(),
) -> garde::Result {
    if info_urls.len() > MAX_INFO_URLS {
        return Err(garde::Error::new(compact_str::format_compact!(
            "an oauth provider cannot have more than {MAX_INFO_URLS} additional info urls"
        )));
    }

    for (key, url) in info_urls {
        if key.is_empty()
            || key.len() > 64
            || !key
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            return Err(garde::Error::new(compact_str::format_compact!(
                "info url key {key:?} must be 1-64 characters of a-z, 0-9, _ or -"
            )));
        }

        if url.len() > MAX_INFO_URL_LENGTH {
            return Err(garde::Error::new(compact_str::format_compact!(
                "info url {key} must be at most {MAX_INFO_URL_LENGTH} characters"
            )));
        }

        if !reqwest::Url::parse(url).is_ok_and(|url| matches!(url.scheme(), "http" | "https")) {
            return Err(garde::Error::new(compact_str::format_compact!(
                "info url {key} must be a valid http or https url"
            )));
        }
    }

    Ok(())
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateOAuthProviderOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(
        length(chars, min = 1, max = 128),
        inner(custom(crate::icons::validate_icon))
    )]
    #[schema(min_length = 1, max_length = 128)]
    #[serde(default)]
    pub icon: Option<compact_str::CompactString>,
    #[garde(skip)]
    pub enabled: bool,
    #[garde(skip)]
    #[serde(default = "default_true")]
    pub login_viewable: bool,
    #[garde(skip)]
    pub login_only: bool,
    #[garde(skip)]
    pub login_bypass_two_factor: bool,
    #[garde(skip)]
    pub link_viewable: bool,
    #[garde(skip)]
    #[serde(default)]
    pub api_linkable: bool,
    #[garde(skip)]
    pub user_manageable: bool,
    #[garde(skip)]
    pub basic_auth: bool,
    #[garde(skip)]
    #[serde(default)]
    pub pkce: bool,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub client_id: compact_str::CompactString,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub client_secret: Option<compact_str::CompactString>,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub auth_url: String,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub token_url: String,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub info_url: String,
    #[garde(custom(validate_info_urls))]
    #[serde(default)]
    pub info_urls: IndexMap<compact_str::CompactString, String>,
    #[garde(length(max = 255))]
    #[schema(max_length = 255)]
    pub scopes: Vec<compact_str::CompactString>,

    #[garde(
        length(chars, min = 3, max = 255),
        custom(crate::utils::validate_json_path)
    )]
    #[schema(min_length = 3, max_length = 255)]
    pub identifier_path: String,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(custom(crate::utils::validate_json_path))
    )]
    #[schema(min_length = 1, max_length = 255)]
    pub email_path: Option<String>,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(custom(crate::utils::validate_json_path))
    )]
    #[schema(min_length = 1, max_length = 255)]
    pub username_path: Option<String>,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(custom(crate::utils::validate_json_path))
    )]
    #[schema(min_length = 1, max_length = 255)]
    pub name_first_path: Option<String>,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(custom(crate::utils::validate_json_path))
    )]
    #[schema(min_length = 1, max_length = 255)]
    pub name_last_path: Option<String>,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(custom(crate::utils::validate_avatar_url_template))
    )]
    #[schema(min_length = 1, max_length = 255)]
    pub avatar_url_template: Option<String>,
    #[garde(skip)]
    #[serde(default)]
    pub avatar_overwrite: bool,
}

#[async_trait::async_trait]
impl CreatableModel for OAuthProvider {
    type CreateOptions<'a> = CreateOAuthProviderOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<OAuthProvider>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("oauth_providers");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        let encrypted_client_secret = if let Some(ref client_secret) = options.client_secret {
            Some(
                EncryptedString::from_plaintext(client_secret.to_string(), &state.database)
                    .await
                    .map_err(|err| sqlx::Error::Encode(err.into()))?,
            )
        } else {
            None
        };

        query_builder
            .set("name", &options.name)
            .set("description", &options.description)
            .set("icon", &options.icon)
            .set("client_id", &options.client_id)
            .set("client_secret", encrypted_client_secret)
            .set("auth_url", &options.auth_url)
            .set("token_url", &options.token_url)
            .set("info_url", &options.info_url)
            .set("info_urls", OrderedJson(&options.info_urls))
            .set("scopes", &options.scopes)
            .set("identifier_path", &options.identifier_path)
            .set("email_path", &options.email_path)
            .set("username_path", &options.username_path)
            .set("name_first_path", &options.name_first_path)
            .set("name_last_path", &options.name_last_path)
            .set("avatar_url_template", &options.avatar_url_template)
            .set("avatar_overwrite", options.avatar_overwrite)
            .set("enabled", options.enabled)
            .set("login_viewable", options.login_viewable)
            .set("login_only", options.login_only)
            .set("login_bypass_two_factor", options.login_bypass_two_factor)
            .set("link_viewable", options.link_viewable)
            .set("api_linkable", options.api_linkable)
            .set("user_manageable", options.user_manageable)
            .set("basic_auth", options.basic_auth)
            .set("pkce", options.pkce);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut oauth_provider = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut oauth_provider, &options, state, transaction).await?;

        Ok(oauth_provider)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateOAuthProviderOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub description: Option<Option<compact_str::CompactString>>,
    #[garde(
        length(chars, min = 1, max = 128),
        inner(inner(custom(crate::icons::validate_icon)))
    )]
    #[schema(min_length = 1, max_length = 128)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub icon: Option<Option<compact_str::CompactString>>,
    #[garde(skip)]
    pub enabled: Option<bool>,
    #[garde(skip)]
    pub login_viewable: Option<bool>,
    #[garde(skip)]
    pub login_only: Option<bool>,
    #[garde(skip)]
    pub login_bypass_two_factor: Option<bool>,
    #[garde(skip)]
    pub link_viewable: Option<bool>,
    #[garde(skip)]
    pub api_linkable: Option<bool>,
    #[garde(skip)]
    pub user_manageable: Option<bool>,
    #[garde(skip)]
    pub basic_auth: Option<bool>,
    #[garde(skip)]
    pub pkce: Option<bool>,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub client_id: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub client_secret: Option<Option<compact_str::CompactString>>,

    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub auth_url: Option<String>,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub token_url: Option<String>,
    #[garde(length(chars, min = 3, max = 255))]
    #[schema(min_length = 3, max_length = 255)]
    pub info_url: Option<String>,
    #[garde(inner(custom(validate_info_urls)))]
    pub info_urls: Option<IndexMap<compact_str::CompactString, String>>,
    #[garde(length(max = 255))]
    #[schema(max_length = 255)]
    pub scopes: Option<Vec<compact_str::CompactString>>,

    #[garde(
        length(chars, min = 3, max = 255),
        inner(custom(crate::utils::validate_json_path))
    )]
    #[schema(min_length = 3, max_length = 255)]
    pub identifier_path: Option<String>,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(inner(custom(crate::utils::validate_json_path)))
    )]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub email_path: Option<Option<String>>,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(inner(custom(crate::utils::validate_json_path)))
    )]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub username_path: Option<Option<String>>,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(inner(custom(crate::utils::validate_json_path)))
    )]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub name_first_path: Option<Option<String>>,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(inner(custom(crate::utils::validate_json_path)))
    )]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub name_last_path: Option<Option<String>>,
    #[garde(
        length(chars, min = 1, max = 255),
        inner(inner(custom(crate::utils::validate_avatar_url_template)))
    )]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub avatar_url_template: Option<Option<String>>,
    #[garde(skip)]
    pub avatar_overwrite: Option<bool>,
}

impl UpdateOAuthProviderOptions {
    /// Whether this changes how the provider identifies users, how they may sign in with it or
    /// who may link accounts to it, which amounts to taking over every linked account.
    pub fn changes_identity(&self, oauth_provider: &OAuthProvider) -> bool {
        fn differs<T: PartialEq>(new: &Option<T>, current: &T) -> bool {
            new.as_ref().is_some_and(|new| new != current)
        }

        differs(&self.client_id, &oauth_provider.client_id)
            || differs(&self.auth_url, &oauth_provider.auth_url)
            || differs(&self.token_url, &oauth_provider.token_url)
            || differs(&self.info_url, &oauth_provider.info_url)
            || differs(&self.info_urls, &oauth_provider.info_urls)
            || differs(&self.scopes, &oauth_provider.scopes)
            || differs(&self.identifier_path, &oauth_provider.identifier_path)
            || differs(&self.login_only, &oauth_provider.login_only)
            || differs(
                &self.login_bypass_two_factor,
                &oauth_provider.login_bypass_two_factor,
            )
            || differs(&self.user_manageable, &oauth_provider.user_manageable)
            || differs(&self.api_linkable, &oauth_provider.api_linkable)
    }
}

#[async_trait::async_trait]
impl UpdatableModel for OAuthProvider {
    type UpdateOptions = UpdateOAuthProviderOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<OAuthProvider>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update_with_transaction(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = UpdateQueryBuilder::new("oauth_providers");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        let encrypted_client_secret = match options.client_secret {
            Some(Some(ref client_secret)) => Some(Some(
                EncryptedString::from_plaintext(client_secret.to_string(), &state.database)
                    .await
                    .map_err(|err| sqlx::Error::Encode(err.into()))?,
            )),
            Some(None) => Some(None),
            None => None,
        };

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("icon", options.icon.as_ref().map(|i| i.as_ref()))
            .set("client_id", options.client_id.as_ref())
            .set("client_secret", encrypted_client_secret.clone())
            .set("auth_url", options.auth_url.as_ref())
            .set("token_url", options.token_url.as_ref())
            .set("info_url", options.info_url.as_ref())
            .set("info_urls", options.info_urls.as_ref().map(OrderedJson))
            .set("scopes", options.scopes.as_ref())
            .set("identifier_path", options.identifier_path.as_ref())
            .set(
                "email_path",
                options.email_path.as_ref().map(|e| e.as_ref()),
            )
            .set(
                "username_path",
                options.username_path.as_ref().map(|u| u.as_ref()),
            )
            .set(
                "name_first_path",
                options.name_first_path.as_ref().map(|n| n.as_ref()),
            )
            .set(
                "name_last_path",
                options.name_last_path.as_ref().map(|n| n.as_ref()),
            )
            .set(
                "avatar_url_template",
                options.avatar_url_template.as_ref().map(|a| a.as_ref()),
            )
            .set("avatar_overwrite", options.avatar_overwrite)
            .set("enabled", options.enabled)
            .set("login_viewable", options.login_viewable)
            .set("login_only", options.login_only)
            .set("login_bypass_two_factor", options.login_bypass_two_factor)
            .set("link_viewable", options.link_viewable)
            .set("api_linkable", options.api_linkable)
            .set("user_manageable", options.user_manageable)
            .set("basic_auth", options.basic_auth)
            .set("pkce", options.pkce)
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(icon) = options.icon {
            self.icon = icon;
        }
        if let Some(enabled) = options.enabled {
            self.enabled = enabled;
        }
        if let Some(login_viewable) = options.login_viewable {
            self.login_viewable = login_viewable;
        }
        if let Some(login_only) = options.login_only {
            self.login_only = login_only;
        }
        if let Some(login_bypass_two_factor) = options.login_bypass_two_factor {
            self.login_bypass_two_factor = login_bypass_two_factor;
        }
        if let Some(link_viewable) = options.link_viewable {
            self.link_viewable = link_viewable;
        }
        if let Some(api_linkable) = options.api_linkable {
            self.api_linkable = api_linkable;
        }
        if let Some(user_manageable) = options.user_manageable {
            self.user_manageable = user_manageable;
        }
        if let Some(basic_auth) = options.basic_auth {
            self.basic_auth = basic_auth;
        }
        if let Some(pkce) = options.pkce {
            self.pkce = pkce;
        }
        if let Some(client_id) = options.client_id {
            self.client_id = client_id;
        }
        if let Some(client_secret) = encrypted_client_secret {
            self.client_secret = client_secret;
        }
        if let Some(auth_url) = options.auth_url {
            self.auth_url = auth_url;
        }
        if let Some(token_url) = options.token_url {
            self.token_url = token_url;
        }
        if let Some(info_url) = options.info_url {
            self.info_url = info_url;
        }
        if let Some(info_urls) = options.info_urls {
            self.info_urls = info_urls;
        }
        if let Some(scopes) = options.scopes {
            self.scopes = scopes;
        }
        if let Some(identifier_path) = options.identifier_path {
            self.identifier_path = identifier_path;
        }
        if let Some(email_path) = options.email_path {
            self.email_path = email_path;
        }
        if let Some(username_path) = options.username_path {
            self.username_path = username_path;
        }
        if let Some(name_first_path) = options.name_first_path {
            self.name_first_path = name_first_path;
        }
        if let Some(name_last_path) = options.name_last_path {
            self.name_last_path = name_last_path;
        }
        if let Some(avatar_url_template) = options.avatar_url_template {
            self.avatar_url_template = avatar_url_template;
        }
        if let Some(avatar_overwrite) = options.avatar_overwrite {
            self.avatar_overwrite = avatar_overwrite;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for OAuthProvider {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<OAuthProvider>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        self.run_delete_handlers(&options, state, transaction)
            .await?;

        sqlx::query(
            r#"
            DELETE FROM oauth_providers
            WHERE oauth_providers.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[derive(Validate)]
pub struct DuplicateOAuthProviderOptions {
    #[garde(length(chars, min = 1, max = 255))]
    pub name: compact_str::CompactString,
}

#[async_trait::async_trait]
impl DuplicableModel for OAuthProvider {
    type DuplicateOptions<'a> = DuplicateOAuthProviderOptions;
    type DuplicateResult = Self;

    fn get_duplicate_handlers() -> &'static LazyLock<DuplicateHandlerList<Self>> {
        static DUPLICATE_LISTENERS: LazyLock<DuplicateHandlerList<OAuthProvider>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DUPLICATE_LISTENERS
    }

    async fn duplicate_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DuplicateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        self.run_duplicate_handlers(&options, state, transaction)
            .await?;

        let mut query_builder = InsertQueryBuilder::new("oauth_providers");

        query_builder
            .set("name", &options.name)
            .set("description", &self.description)
            .set("icon", &self.icon)
            .set("client_id", &self.client_id)
            .set("client_secret", self.client_secret.clone())
            .set("auth_url", &self.auth_url)
            .set("token_url", &self.token_url)
            .set("info_url", &self.info_url)
            .set("info_urls", OrderedJson(&self.info_urls))
            .set("scopes", &self.scopes)
            .set("identifier_path", &self.identifier_path)
            .set("email_path", &self.email_path)
            .set("username_path", &self.username_path)
            .set("name_first_path", &self.name_first_path)
            .set("name_last_path", &self.name_last_path)
            .set("avatar_url_template", &self.avatar_url_template)
            .set("avatar_overwrite", self.avatar_overwrite)
            .set("enabled", self.enabled)
            .set("login_viewable", self.login_viewable)
            .set("login_only", self.login_only)
            .set("login_bypass_two_factor", self.login_bypass_two_factor)
            .set("link_viewable", self.link_viewable)
            .set("api_linkable", self.api_linkable)
            .set("user_manageable", self.user_manageable)
            .set("basic_auth", self.basic_auth)
            .set("pkce", self.pkce);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut oauth_provider = Self::map(None, &row)?;

        sqlx::query!(
            "INSERT INTO oauth_provider_mappings (oauth_provider_uuid, matcher, mapping)
            SELECT $1, oauth_provider_mappings.matcher, oauth_provider_mappings.mapping
            FROM oauth_provider_mappings
            WHERE oauth_provider_mappings.oauth_provider_uuid = $2",
            oauth_provider.uuid,
            self.uuid,
        )
        .execute(&mut **transaction)
        .await?;

        self.run_after_duplicate_handlers(&mut oauth_provider, &options, state, transaction)
            .await?;

        Ok(oauth_provider)
    }
}

#[schema_extension_derive::extendible]
#[init_args(OAuthProvider, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminOAuthProvider")]
pub struct AdminApiOAuthProvider {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,
    pub icon: Option<compact_str::CompactString>,

    pub client_id: compact_str::CompactString,
    pub client_secret: Option<compact_str::CompactString>,
    pub auth_url: String,
    pub token_url: String,
    pub info_url: String,
    pub info_urls: IndexMap<compact_str::CompactString, String>,
    pub scopes: Vec<compact_str::CompactString>,

    pub identifier_path: String,
    pub email_path: Option<String>,
    pub username_path: Option<String>,
    pub name_first_path: Option<String>,
    pub name_last_path: Option<String>,
    pub avatar_url_template: Option<String>,
    pub avatar_overwrite: bool,

    pub enabled: bool,
    pub login_viewable: bool,
    pub login_only: bool,
    pub login_bypass_two_factor: bool,
    pub link_viewable: bool,
    pub api_linkable: bool,
    pub user_manageable: bool,
    pub basic_auth: bool,
    pub pkce: bool,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(OAuthProvider, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "OAuthProvider")]
pub struct ApiOAuthProvider {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub icon: Option<compact_str::CompactString>,

    pub link_viewable: bool,
    pub user_manageable: bool,
}
