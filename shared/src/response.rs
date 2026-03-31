use crate::{ApiError, database::DatabaseError};
use accept_header::Accept;
use axum::response::IntoResponse;
use std::{
    borrow::Cow,
    fmt::{Debug, Display},
    str::FromStr,
};

pub type ApiResponseResult = Result<ApiResponse, ApiResponse>;

tokio::task_local! {
    pub static ACCEPT_HEADER: Option<Accept>;
    pub static APP_DEBUG: bool;
}

pub fn accept_from_headers(headers: &axum::http::HeaderMap) -> Option<Accept> {
    let header_value = headers.get(axum::http::header::ACCEPT)?;
    let header_str = header_value.to_str().ok()?;

    Accept::from_str(header_str).ok()
}

#[derive(Debug)]
pub struct ApiResponse {
    pub body: axum::body::Body,
    pub status: axum::http::StatusCode,
    pub headers: axum::http::HeaderMap,
}

impl ApiResponse {
    #[inline]
    pub fn new(body: axum::body::Body) -> Self {
        Self {
            body,
            status: axum::http::StatusCode::OK,
            headers: axum::http::HeaderMap::new(),
        }
    }

    #[inline]
    pub fn new_stream(stream: impl tokio::io::AsyncRead + Send + 'static) -> Self {
        Self {
            body: axum::body::Body::from_stream(tokio_util::io::ReaderStream::with_capacity(
                stream,
                crate::BUFFER_SIZE,
            )),
            status: axum::http::StatusCode::OK,
            headers: axum::http::HeaderMap::new(),
        }
    }

    /// Create a new API response with content negotiation based on the `Accept` header.
    pub fn new_serialized(body: impl serde::Serialize) -> Self {
        let accept_header = ACCEPT_HEADER.try_with(|h| h.clone()).ok().flatten();

        static AVAILABLE_SERIALIZERS: &[mime::Mime] = &[
            mime::APPLICATION_JSON,
            mime::APPLICATION_MSGPACK,
            mime::TEXT_XML,
        ];

        let negotiated = accept_header
            .as_ref()
            .and_then(|accept| accept.negotiate(AVAILABLE_SERIALIZERS).ok())
            .unwrap_or(mime::APPLICATION_JSON);

        let (content_type, body) = match negotiated {
            m if m.essence_str() == mime::APPLICATION_MSGPACK.essence_str() => {
                let mut bytes = Vec::new();
                let mut se = rmp_serde::Serializer::new(&mut bytes)
                    .with_struct_map()
                    .with_human_readable();
                if let Err(err) = body.serialize(&mut se) {
                    tracing::error!(
                        "failed to serialize response body to MessagePack: {:?}",
                        err
                    );

                    (
                        axum::http::HeaderValue::from_static("application/json"),
                        axum::body::Body::from("{}"),
                    )
                } else {
                    (
                        axum::http::HeaderValue::from_static("application/msgpack"),
                        axum::body::Body::from(bytes),
                    )
                }
            }
            m if m.essence_str() == mime::TEXT_XML.essence_str() => {
                let string = serde_xml_rs::to_string(&body).unwrap_or_else(|err| {
                    tracing::error!("failed to serialize response body to XML: {:?}", err);
                    "<error>serialization failed</error>".to_string()
                });

                (
                    axum::http::HeaderValue::from_static("text/xml"),
                    axum::body::Body::from(string),
                )
            }
            _ => {
                let bytes = serde_json::to_vec(&body).unwrap_or_else(|err| {
                    tracing::error!("failed to serialize response body to JSON: {:?}", err);
                    b"{}".to_vec()
                });

                (
                    axum::http::HeaderValue::from_static("application/json"),
                    axum::body::Body::from(bytes),
                )
            }
        };

        Self {
            body,
            status: axum::http::StatusCode::OK,
            headers: axum::http::HeaderMap::from_iter([
                (axum::http::header::CONTENT_TYPE, content_type),
                (
                    axum::http::header::VARY,
                    axum::http::HeaderValue::from_static("Accept"),
                ),
            ]),
        }
    }

    #[inline]
    pub fn error(err: impl AsRef<str>) -> Self {
        Self::new_serialized(ApiError::new_value(&[err.as_ref()]))
            .with_status(axum::http::StatusCode::BAD_REQUEST)
    }

    #[inline]
    pub fn with_status(mut self, status: axum::http::StatusCode) -> Self {
        self.status = status;
        self
    }

    #[inline]
    pub fn with_header(mut self, key: &'static str, value: impl AsRef<str>) -> Self {
        if let Ok(header_value) = axum::http::HeaderValue::from_str(value.as_ref()) {
            self.headers.insert(key, header_value);
        }

        self
    }

    #[inline]
    pub fn with_optional_header(
        mut self,
        key: &'static str,
        value: Option<impl AsRef<str>>,
    ) -> Self {
        let value = match value {
            Some(value) => value,
            None => return self,
        };

        if let Ok(header_value) = axum::http::HeaderValue::from_str(value.as_ref()) {
            self.headers.insert(key, header_value);
        }

        self
    }

    #[inline]
    pub fn with_headers(mut self, headers: &axum::http::HeaderMap) -> Self {
        for (key, value) in headers.iter() {
            self.headers.insert(key, value.clone());
        }

        self
    }

    #[inline]
    pub fn ok(self) -> ApiResponseResult {
        Ok(self)
    }
}

impl<T> From<T> for ApiResponse
where
    T: Into<anyhow::Error>,
{
    fn from(err: T) -> Self {
        let err: anyhow::Error = err.into();

        if let Some(error) = err.downcast_ref::<DisplayError>() {
            return ApiResponse::error(&error.message).with_status(error.status);
        } else if let Some(DatabaseError::Validation(error)) = err.downcast_ref::<DatabaseError>() {
            let error_messages = crate::utils::flatten_validation_errors(error);

            return ApiResponse::new_serialized(ApiError::new_strings_value(error_messages))
                .with_status(axum::http::StatusCode::BAD_REQUEST);
        } else if let Some(DatabaseError::InvalidRelation(error)) =
            err.downcast_ref::<DatabaseError>()
        {
            return ApiResponse::error(error.to_string())
                .with_status(axum::http::StatusCode::BAD_REQUEST);
        }

        tracing::error!("a request error occurred: {:?}", err);
        sentry_anyhow::capture_anyhow(&err);

        let debug = APP_DEBUG.try_get().unwrap_or_default();

        ApiResponse::error(if debug {
            Cow::Owned(err.to_string())
        } else {
            "internal server error".into()
        })
        .with_status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
    }
}

impl IntoResponse for ApiResponse {
    #[inline]
    fn into_response(self) -> axum::response::Response {
        let mut response = axum::response::Response::new(self.body);
        *response.status_mut() = self.status;
        *response.headers_mut() = self.headers;

        response
    }
}

#[derive(Debug)]
pub struct DisplayError<'a> {
    status: axum::http::StatusCode,
    message: Cow<'a, str>,
}

impl<'a> DisplayError<'a> {
    pub fn new(message: impl Into<Cow<'a, str>>) -> Self {
        Self {
            status: axum::http::StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    pub fn with_status(mut self, status: axum::http::StatusCode) -> Self {
        self.status = status;

        self
    }
}

impl<'a> Display for DisplayError<'a> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DisplayError")
            .field("status", &self.status)
            .field("message", &self.message)
            .finish()
    }
}

impl<'a> std::error::Error for DisplayError<'a> {}
