// This file is auto-generated from OpenAPI spec. Do not edit manually.
use super::*;
use futures_util::TryStreamExt;
use reqwest::{Client, Method, StatusCode};
use serde::de::DeserializeOwned;
use std::{
    pin::Pin,
    sync::LazyLock,
    task::{Context, Poll},
};
use tokio::io::AsyncRead;
use tokio_tungstenite::tungstenite::{Error, client::IntoClientRequest, http::HeaderValue};

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
    WebSocket(tokio_tungstenite::tungstenite::Error),
    MsgpackEncode(rmp_serde::encode::Error),
    MsgpackDecode(rmp_serde::decode::Error),
}

impl From<ApiHttpError> for anyhow::Error {
    fn from(value: ApiHttpError) -> Self {
        match value {
            ApiHttpError::Http(status, err) => {
                anyhow::anyhow!("db agent api status code {status}: {}", err.error)
            }
            ApiHttpError::Reqwest(err) => anyhow::anyhow!(err),
            ApiHttpError::WebSocket(err) => anyhow::anyhow!(err),
            ApiHttpError::MsgpackEncode(err) => anyhow::anyhow!(err),
            ApiHttpError::MsgpackDecode(err) => anyhow::anyhow!(err),
        }
    }
}

pub struct AsyncResponseReader(Box<dyn AsyncRead + Send + Unpin>);

impl AsyncRead for AsyncResponseReader {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.0).poll_read(cx, buf)
    }
}

impl<'de> Deserialize<'de> for AsyncResponseReader {
    fn deserialize<D>(_deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        Ok(Self(Box::new(tokio::io::empty())))
    }
}

pub struct AsyncRequestReader(Box<dyn AsyncRead + Send + Unpin>);

impl AsyncRequestReader {
    #[inline]
    pub fn new(reader: impl AsyncRead + Send + Unpin + 'static) -> Self {
        Self(Box::new(reader))
    }
}

impl AsyncRead for AsyncRequestReader {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.0).poll_read(cx, buf)
    }
}

async fn request_impl<T: DeserializeOwned + 'static>(
    client: &DbAgentClient,
    method: Method,
    endpoint: impl AsRef<str>,
    body: Option<&impl Serialize>,
    body_reader: Option<AsyncRequestReader>,
) -> Result<T, ApiHttpError> {
    let url = format!(
        "{}{}",
        client.base_url.trim_end_matches('/'),
        endpoint.as_ref()
    );
    let mut request = CLIENT.request(method, &url);
    request = request.header("Accept", "application/msgpack");

    if !client.token.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", client.token));
    }

    if let Some(body) = body {
        request = request.header("Content-Type", "application/msgpack");

        let mut bytes = Vec::new();
        let mut se = rmp_serde::Serializer::new(&mut bytes)
            .with_struct_map()
            .with_human_readable();
        if let Err(err) = body.serialize(&mut se) {
            return Err(ApiHttpError::MsgpackEncode(err));
        }
        request = request.body(bytes);
    } else if let Some(body_reader) = body_reader {
        request = request.body(reqwest::Body::wrap_stream(
            tokio_util::io::ReaderStream::new(body_reader),
        ));
    }

    match request.send().await {
        Ok(response) => {
            if response.status().is_success() {
                if std::any::type_name::<T>() == std::any::type_name::<AsyncResponseReader>() {
                    let stream = response.bytes_stream().map_err(|err| {
                        std::io::Error::other(format!("failed to read multipart field: {err}"))
                    });
                    let stream_reader = tokio_util::io::StreamReader::new(stream);

                    return Ok(*(Box::new(AsyncResponseReader(Box::new(stream_reader)))
                        as Box<dyn std::any::Any>)
                        .downcast::<T>()
                        .unwrap());
                }

                match response.bytes().await {
                    Ok(data) => {
                        let mut de =
                            rmp_serde::Deserializer::new(data.as_ref()).with_human_readable();
                        match T::deserialize(&mut de) {
                            Ok(data) => Ok(data),
                            Err(err) => Err(ApiHttpError::MsgpackDecode(err)),
                        }
                    }
                    Err(err) => Err(ApiHttpError::Reqwest(err)),
                }
            } else {
                Err(ApiHttpError::Http(
                    response.status(),
                    match response.bytes().await {
                        Ok(data) => {
                            let mut de =
                                rmp_serde::Deserializer::new(data.as_ref()).with_human_readable();
                            match super::ApiError::deserialize(&mut de) {
                                Ok(data) => data,
                                Err(err) => super::ApiError {
                                    error: err.to_string().into(),
                                },
                            }
                        }
                        Err(err) => super::ApiError {
                            error: err.to_string().into(),
                        },
                    },
                ))
            }
        }
        Err(err) => Err(ApiHttpError::Reqwest(err)),
    }
}

pub struct DbAgentClient {
    base_url: String,
    token: String,
}

impl DbAgentClient {
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

    pub async fn open_websocket(
        &self,
        endpoint: impl AsRef<str>,
        headers: reqwest::header::HeaderMap,
    ) -> Result<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        ApiHttpError,
    > {
        let url = format!(
            "{}{}",
            self.base_url.trim_end_matches('/'),
            endpoint.as_ref()
        );
        let url = if let Some(rest) = url.strip_prefix("https://") {
            format!("wss://{rest}")
        } else if let Some(rest) = url.strip_prefix("http://") {
            format!("ws://{rest}")
        } else {
            url
        };

        let mut request = url.into_client_request().map_err(ApiHttpError::WebSocket)?;

        if !self.token.is_empty() {
            let value = HeaderValue::from_str(&format!("Bearer {}", self.token))
                .map_err(|err| ApiHttpError::WebSocket(Error::HttpFormat(err.into())))?;
            request.headers_mut().insert("Authorization", value);
        }

        for (header, value) in headers {
            let Some(header) = header else {
                continue;
            };
            request.headers_mut().insert(header, value);
        }

        let (stream, _) = tokio_tungstenite::connect_async(request)
            .await
            .map_err(ApiHttpError::WebSocket)?;

        Ok(stream)
    }

    pub async fn get_instances(&self) -> Result<super::instances::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/instances", None::<&()>, None).await
    }

    pub async fn post_instances(
        &self,
        data: &super::instances::post::RequestBody,
    ) -> Result<super::instances::post::Response, ApiHttpError> {
        request_impl(self, Method::POST, "/api/instances", Some(data), None).await
    }

    pub async fn get_instances_utilization(
        &self,
    ) -> Result<super::instances_utilization::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            "/api/instances/utilization",
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_instances_instance(
        &self,
        instance: uuid::Uuid,
    ) -> Result<super::instances_instance::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/instances/{instance}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn delete_instances_instance(
        &self,
        instance: uuid::Uuid,
    ) -> Result<super::instances_instance::delete::Response, ApiHttpError> {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/instances/{instance}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn patch_instances_instance(
        &self,
        instance: uuid::Uuid,
        data: &super::instances_instance::patch::RequestBody,
    ) -> Result<super::instances_instance::patch::Response, ApiHttpError> {
        request_impl(
            self,
            Method::PATCH,
            format!("/api/instances/{instance}"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_instances_instance_databases(
        &self,
        instance: uuid::Uuid,
    ) -> Result<super::instances_instance_databases::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/instances/{instance}/databases"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_instances_instance_databases(
        &self,
        instance: uuid::Uuid,
        data: &super::instances_instance_databases::post::RequestBody,
    ) -> Result<super::instances_instance_databases::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/instances/{instance}/databases"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_instances_instance_databases_database(
        &self,
        instance: uuid::Uuid,
        database: uuid::Uuid,
    ) -> Result<super::instances_instance_databases_database::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/instances/{instance}/databases/{database}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn delete_instances_instance_databases_database(
        &self,
        instance: uuid::Uuid,
        database: uuid::Uuid,
    ) -> Result<super::instances_instance_databases_database::delete::Response, ApiHttpError> {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/instances/{instance}/databases/{database}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_instances_instance_databases_database_recreate(
        &self,
        instance: uuid::Uuid,
        database: uuid::Uuid,
    ) -> Result<super::instances_instance_databases_database_recreate::post::Response, ApiHttpError>
    {
        request_impl(
            self,
            Method::POST,
            format!("/api/instances/{instance}/databases/{database}/recreate"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_instances_instance_databases_database_size(
        &self,
        instance: uuid::Uuid,
        database: uuid::Uuid,
    ) -> Result<super::instances_instance_databases_database_size::get::Response, ApiHttpError>
    {
        request_impl(
            self,
            Method::GET,
            format!("/api/instances/{instance}/databases/{database}/size"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_instances_instance_export(
        &self,
        instance: uuid::Uuid,
        query: &super::instances_instance_export::get::Query,
    ) -> Result<super::instances_instance_export::get::Response, ApiHttpError> {
        let mut query_parts: Vec<compact_str::CompactString> = Vec::new();
        if let Some(value) = &query.db {
            query_parts.push(format!("db={}", urlencoding::encode(value)).into());
        }
        let query = if query_parts.is_empty() {
            String::new()
        } else {
            format!("?{}", query_parts.join("&"))
        };
        request_impl(
            self,
            Method::GET,
            format!("/api/instances/{instance}/export{query}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_instances_instance_import(
        &self,
        instance: uuid::Uuid,
        data: super::instances_instance_import::post::RequestBody,
        query: &super::instances_instance_import::post::Query,
    ) -> Result<super::instances_instance_import::post::Response, ApiHttpError> {
        let mut query_parts: Vec<compact_str::CompactString> = Vec::new();
        if let Some(value) = &query.db {
            query_parts.push(format!("db={}", urlencoding::encode(value)).into());
        }
        if let Some(value) = query.wipe {
            query_parts.push(format!("wipe={}", value).into());
        }
        let query = if query_parts.is_empty() {
            String::new()
        } else {
            format!("?{}", query_parts.join("&"))
        };
        request_impl(
            self,
            Method::POST,
            format!("/api/instances/{instance}/import{query}"),
            None::<&()>,
            Some(data),
        )
        .await
    }

    pub async fn get_instances_instance_logs(
        &self,
        instance: uuid::Uuid,
        query: &super::instances_instance_logs::get::Query,
    ) -> Result<super::instances_instance_logs::get::Response, ApiHttpError> {
        let mut query_parts: Vec<compact_str::CompactString> = Vec::new();
        if let Some(value) = query.lines {
            query_parts.push(format!("lines={}", value).into());
        }
        let query = if query_parts.is_empty() {
            String::new()
        } else {
            format!("?{}", query_parts.join("&"))
        };
        request_impl(
            self,
            Method::GET,
            format!("/api/instances/{instance}/logs{query}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_instances_instance_power(
        &self,
        instance: uuid::Uuid,
        data: &super::instances_instance_power::post::RequestBody,
    ) -> Result<super::instances_instance_power::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/instances/{instance}/power"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn post_instances_instance_query(
        &self,
        instance: uuid::Uuid,
        data: &super::instances_instance_query::post::RequestBody,
    ) -> Result<super::instances_instance_query::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/instances/{instance}/query"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_instances_instance_users(
        &self,
        instance: uuid::Uuid,
    ) -> Result<super::instances_instance_users::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/instances/{instance}/users"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_instances_instance_users(
        &self,
        instance: uuid::Uuid,
        data: &super::instances_instance_users::post::RequestBody,
    ) -> Result<super::instances_instance_users::post::Response, ApiHttpError> {
        request_impl(
            self,
            Method::POST,
            format!("/api/instances/{instance}/users"),
            Some(data),
            None,
        )
        .await
    }

    pub async fn get_instances_instance_users_user(
        &self,
        instance: uuid::Uuid,
        user: uuid::Uuid,
    ) -> Result<super::instances_instance_users_user::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/instances/{instance}/users/{user}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn delete_instances_instance_users_user(
        &self,
        instance: uuid::Uuid,
        user: uuid::Uuid,
    ) -> Result<super::instances_instance_users_user::delete::Response, ApiHttpError> {
        request_impl(
            self,
            Method::DELETE,
            format!("/api/instances/{instance}/users/{user}"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn post_instances_instance_users_user_rotate_password(
        &self,
        instance: uuid::Uuid,
        user: uuid::Uuid,
    ) -> Result<super::instances_instance_users_user_rotate_password::post::Response, ApiHttpError>
    {
        request_impl(
            self,
            Method::POST,
            format!("/api/instances/{instance}/users/{user}/rotate-password"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_instances_instance_utilization(
        &self,
        instance: uuid::Uuid,
    ) -> Result<super::instances_instance_utilization::get::Response, ApiHttpError> {
        request_impl(
            self,
            Method::GET,
            format!("/api/instances/{instance}/utilization"),
            None::<&()>,
            None,
        )
        .await
    }

    pub async fn get_status(&self) -> Result<super::status::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/status", None::<&()>, None).await
    }

    pub async fn get_system(&self) -> Result<super::system::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/system", None::<&()>, None).await
    }

    pub async fn get_system_config(
        &self,
    ) -> Result<super::system_config::get::Response, ApiHttpError> {
        request_impl(self, Method::GET, "/api/system/config", None::<&()>, None).await
    }

    pub async fn patch_system_config(
        &self,
        data: &super::system_config::patch::RequestBody,
    ) -> Result<super::system_config::patch::Response, ApiHttpError> {
        request_impl(self, Method::PATCH, "/api/system/config", Some(data), None).await
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
}
