// This file is auto-generated from OpenAPI spec. Do not edit manually.
use super::*;
use reqwest::{Client, Method, StatusCode};
use serde::de::DeserializeOwned;
use std::sync::LazyLock;

static CLIENT: LazyLock<Client> = LazyLock::new(|| {
    Client::builder()
        .user_agent("Calagopus Panel")
        .build()
        .expect("Failed to create reqwest client")
});

#[derive(Debug)]
pub enum ApiHttpError {
    Http(StatusCode, super::ApiError),
    Reqwest(reqwest::Error),
}

impl From<ApiHttpError> for anyhow::Error {
    fn from(value: ApiHttpError) -> Self {
        match value {
            ApiHttpError::Http(status, err) => {
                anyhow::anyhow!("wings api status code {status}: {}", err.error)
            }
            ApiHttpError::Reqwest(err) => anyhow::anyhow!(err),
        }
    }
}

async fn request_impl<T: DeserializeOwned + 'static>(
    client: &WingsClient,
    method: Method,
    endpoint: impl AsRef<str>,
    body: Option<&impl Serialize>,
    body_raw: Option<compact_str::CompactString>,
) -> Result<T, ApiHttpError> {
    let url = format!(
        "{}{}",
        client.base_url.trim_end_matches('/'),
        endpoint.as_ref()
    );
    let mut request = CLIENT.request(method, &url);

    if !client.token.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", client.token));
    }

    if let Some(body) = body {
        request = request.json(body);
    } else if let Some(body_raw) = body_raw {
        request = request.body(Vec::from(body_raw));
    }

    match request.send().await {
        Ok(response) => {
            if response.status().is_success() {
                if std::any::type_name::<T>() == std::any::type_name::<String>() {
                    return match response.text().await {
                        Ok(text) => Ok(*(Box::new(text) as Box<dyn std::any::Any>)
                            .downcast::<T>()
                            .unwrap()),
                        Err(err) => Err(ApiHttpError::Http(
                            StatusCode::PRECONDITION_FAILED,
                            super::ApiError {
                                error: err.to_string().into(),
                            },
                        )),
                    };
                }

                match response.json().await {
                    Ok(data) => Ok(data),
                    Err(err) => Err(ApiHttpError::Reqwest(err)),
                }
            } else {
                Err(ApiHttpError::Http(
                    response.status(),
                    response.json().await.unwrap_or_else(|err| super::ApiError {
                        error: err.to_string().into(),
                    }),
                ))
            }
        }
        Err(err) => Err(ApiHttpError::Reqwest(err)),
    }
}

pub struct WingsClient {
    base_url: String,
    token: String,
}

impl WingsClient {
    #[inline]
    pub fn new(base_url: String, token: String) -> Self {
        Self { base_url, token }
    }

    pub fn request_raw(
        &self,
        method: Method,
        endpoint: impl AsRef<str>,
    ) -> reqwest::RequestBuilder {
        let url = format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            endpoint.as_ref().trim_start_matches('/')
        );
        let mut request = CLIENT.request(method, &url);

        if !self.token.is_empty() {
            request = request.header("Authorization", format!("Bearer {}", self.token));
        }

        request
    }

    pub async fn delete_backups_backup(
        &self,
        backup: uuid::Uuid,
        data: &super::backups_backup::delete::RequestBody,
    ) -> Result<super::backups_backup::delete::Response, ApiHttpError> {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/backups/{backup}"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_deauthorize_user(
        &self,
        data: &super::deauthorize_user::post::RequestBody,
    ) -> Result<super::deauthorize_user::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            "/api/deauthorize-user",
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_servers(&self) -> Result<super::servers::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/servers", None::<&()>, None).await
    }

    pub async fn post_servers(
        &self,
        data: &super::servers::post::RequestBody,
    ) -> Result<super::servers::post::Response, ApiHttpError> {
        request_impl(self, Method::POST, "/api/servers", Some(data), None).await
    }

    pub async fn post_servers_power(
        &self,
        data: &super::servers_power::post::RequestBody,
    ) -> Result<super::servers_power::post::Response, ApiHttpError> {
        request_impl(self, Method::POST, "/api/servers/power", Some(data), None).await
    }

    pub async fn get_servers_server(
        &self,
        server: uuid::Uuid,
    ) -> Result<super::servers_server::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/servers/{server}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn delete_servers_server(
        &self,
        server: uuid::Uuid,
    ) -> Result<super::servers_server::delete::Response, ApiHttpError> {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/servers/{server}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_servers_server_backup(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_backup::post::RequestBody,
    ) -> Result<super::servers_server_backup::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/backup"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn delete_servers_server_backup_backup(
        &self,
        server: uuid::Uuid,
        backup: uuid::Uuid,
    ) -> Result<super::servers_server_backup_backup::delete::Response, ApiHttpError> {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/servers/{server}/backup/{backup}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_servers_server_backup_backup_restore(
        &self,
        server: uuid::Uuid,
        backup: uuid::Uuid,
        data: &super::servers_server_backup_backup_restore::post::RequestBody,
    ) -> Result<super::servers_server_backup_backup_restore::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/backup/{backup}/restore"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_commands(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_commands::post::RequestBody,
    ) -> Result<super::servers_server_commands::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/commands"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_chmod(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_chmod::post::RequestBody,
    ) -> Result<super::servers_server_files_chmod::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/chmod"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_compress(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_compress::post::RequestBody,
    ) -> Result<super::servers_server_files_compress::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/compress"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_servers_server_files_contents(
        &self,
        server: uuid::Uuid,
        file: &str,
        download: bool,
        max_size: u64,
    ) -> Result<super::servers_server_files_contents::get::Response, ApiHttpError> {
        let file = urlencoding::encode(file);
        request_impl(self, Method::GET, format!("/api/servers/{server}/files/contents?file={file}&download={download}&max_size={max_size}"), None::<&()>, None).await
    }

    pub async fn post_servers_server_files_copy(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_copy::post::RequestBody,
    ) -> Result<super::servers_server_files_copy::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/copy"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_copy_remote(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_copy_remote::post::RequestBody,
    ) -> Result<super::servers_server_files_copy_remote::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/copy-remote"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_create_directory(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_create_directory::post::RequestBody,
    ) -> Result<super::servers_server_files_create_directory::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/create-directory"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_decompress(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_decompress::post::RequestBody,
    ) -> Result<super::servers_server_files_decompress::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/decompress"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_delete(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_delete::post::RequestBody,
    ) -> Result<super::servers_server_files_delete::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/delete"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_servers_server_files_fingerprints(
        &self,
        server: uuid::Uuid,
        algorithm: Algorithm,
        files: Vec<compact_str::CompactString>,
    ) -> Result<super::servers_server_files_fingerprints::get::Response, ApiHttpError> {
        let files = files
            .into_iter()
            .map(|s| urlencoding::encode(&s).into())
            .collect::<Vec<compact_str::CompactString>>()
            .join("&files=");
        request_impl(
            self,
            Method::GET,
            format!("/api/servers/{server}/files/fingerprints?algorithm={algorithm}&files={files}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_servers_server_files_list(
        &self,
        server: uuid::Uuid,
        directory: &str,
        ignored: Vec<compact_str::CompactString>,
        per_page: u64,
        page: u64,
    ) -> Result<super::servers_server_files_list::get::Response, ApiHttpError> {
        let directory = urlencoding::encode(directory);
        let ignored = ignored
            .into_iter()
            .map(|s| urlencoding::encode(&s).into())
            .collect::<Vec<compact_str::CompactString>>()
            .join("&ignored=");
        request_impl(self, Method::GET, format!("/api/servers/{server}/files/list?directory={directory}&ignored={ignored}&per_page={per_page}&page={page}"), None::<&()>, None).await
    }

    pub async fn get_servers_server_files_list_directory(
        &self,
        server: uuid::Uuid,
        directory: &str,
    ) -> Result<super::servers_server_files_list_directory::get::Response, ApiHttpError> {
        let directory = urlencoding::encode(directory);
        request_impl(
            self,
            Method::GET,
            format!("/api/servers/{server}/files/list-directory?directory={directory}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn delete_servers_server_files_operations_operation(
        &self,
        server: uuid::Uuid,
        operation: uuid::Uuid,
    ) -> Result<super::servers_server_files_operations_operation::delete::Response, ApiHttpError>
    {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/servers/{server}/files/operations/{operation}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_servers_server_files_pull(
        &self,
        server: uuid::Uuid,
    ) -> Result<super::servers_server_files_pull::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/servers/{server}/files/pull"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_pull(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_pull::post::RequestBody,
    ) -> Result<super::servers_server_files_pull::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/pull"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_pull_query(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_pull_query::post::RequestBody,
    ) -> Result<super::servers_server_files_pull_query::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/pull/query"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn delete_servers_server_files_pull_pull(
        &self,
        server: uuid::Uuid,
        pull: uuid::Uuid,
    ) -> Result<super::servers_server_files_pull_pull::delete::Response, ApiHttpError> {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/servers/{server}/files/pull/{pull}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn put_servers_server_files_rename(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_rename::put::RequestBody,
    ) -> Result<super::servers_server_files_rename::put::Response, ApiHttpError> {
        request_impl(
            self,
            Method::PUT,
            format!("/api/servers/{server}/files/rename"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_search(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_files_search::post::RequestBody,
    ) -> Result<super::servers_server_files_search::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/search"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_files_write(
        &self,
        server: uuid::Uuid,
        file: &str,
        data: super::servers_server_files_write::post::RequestBody,
    ) -> Result<super::servers_server_files_write::post::Response, ApiHttpError> {
        let file = urlencoding::encode(file);
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/files/write?file={file}"),
            None::<&()>,
            Some(data),
        )
        .await
    }

    pub async fn post_servers_server_install_abort(
        &self,
        server: uuid::Uuid,
    ) -> Result<super::servers_server_install_abort::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/install/abort"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_servers_server_logs(
        &self,
        server: uuid::Uuid,
        lines: u64,
    ) -> Result<super::servers_server_logs::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/servers/{server}/logs?lines={lines}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_servers_server_logs_install(
        &self,
        server: uuid::Uuid,
    ) -> Result<super::servers_server_logs_install::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/servers/{server}/logs/install"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_servers_server_power(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_power::post::RequestBody,
    ) -> Result<super::servers_server_power::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/power"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_reinstall(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_reinstall::post::RequestBody,
    ) -> Result<super::servers_server_reinstall::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/reinstall"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_servers_server_schedules_schedule(
        &self,
        server: uuid::Uuid,
        schedule: uuid::Uuid,
    ) -> Result<super::servers_server_schedules_schedule::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/servers/{server}/schedules/{schedule}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_servers_server_schedules_schedule_abort(
        &self,
        server: uuid::Uuid,
        schedule: uuid::Uuid,
    ) -> Result<super::servers_server_schedules_schedule_abort::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/schedules/{schedule}/abort"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_servers_server_schedules_schedule_trigger(
        &self,
        server: uuid::Uuid,
        schedule: uuid::Uuid,
        data: &super::servers_server_schedules_schedule_trigger::post::RequestBody,
    ) -> Result<super::servers_server_schedules_schedule_trigger::post::Response, ApiHttpError>
    {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/schedules/{schedule}/trigger"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_script(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_script::post::RequestBody,
    ) -> Result<super::servers_server_script::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/script"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_sync(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_sync::post::RequestBody,
    ) -> Result<super::servers_server_sync::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/sync"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn delete_servers_server_transfer(
        &self,
        server: uuid::Uuid,
    ) -> Result<super::servers_server_transfer::delete::Response, ApiHttpError> {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/servers/{server}/transfer"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_servers_server_transfer(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_transfer::post::RequestBody,
    ) -> Result<super::servers_server_transfer::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/transfer"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_servers_server_version(
        &self,
        server: uuid::Uuid,
        game: Game,
    ) -> Result<super::servers_server_version::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/servers/{server}/version?game={game}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_servers_server_ws_deny(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_ws_deny::post::RequestBody,
    ) -> Result<super::servers_server_ws_deny::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/ws/deny"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_servers_server_ws_permissions(
        &self,
        server: uuid::Uuid,
        data: &super::servers_server_ws_permissions::post::RequestBody,
    ) -> Result<super::servers_server_ws_permissions::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/servers/{server}/ws/permissions"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_system(&self) -> Result<super::system::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/system", None::<&()>, None).await
    }

    pub async fn get_system_config(
        &self,
    ) -> Result<super::system_config::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/system/config", None::<&()>, None).await
    }

    pub async fn get_system_logs(&self) -> Result<super::system_logs::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/system/logs", None::<&()>, None).await
    }

    pub async fn get_system_logs_file(
        &self,
        file: &str,
    ) -> Result<super::system_logs_file::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/system/logs/{file}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_system_overview(
        &self,
    ) -> Result<super::system_overview::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/system/overview", None::<&()>, None).await
    }

    pub async fn get_system_stats(
        &self,
    ) -> Result<super::system_stats::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/system/stats", None::<&()>, None).await
    }

    pub async fn post_system_upgrade(
        &self,
        data: &super::system_upgrade::post::RequestBody,
    ) -> Result<super::system_upgrade::post::Response, ApiHttpError> {
        request_impl(self, Method::POST, "/api/system/upgrade", Some(data), None).await
    }

    pub async fn post_transfers(&self) -> Result<super::transfers::post::Response, ApiHttpError> {
        request_impl(self, Method::POST, "/api/transfers", None::<&()>, None).await
    }

    pub async fn post_transfers_files(
        &self,
    ) -> Result<super::transfers_files::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            "/api/transfers/files",
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn delete_transfers_server(
        &self,
        server: uuid::Uuid,
    ) -> Result<super::transfers_server::delete::Response, ApiHttpError> {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/transfers/{server}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_update(
        &self,
        data: &super::update::post::RequestBody,
    ) -> Result<super::update::post::Response, ApiHttpError> {
        request_impl(self, Method::POST, "/api/update", Some(data), None).await
    }
}
