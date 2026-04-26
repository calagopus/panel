use crate::response::ApiResponse;
use axum::{
    body::Bytes,
    extract::{FromRequest, OptionalFromRequest, Request},
    response::IntoResponse,
};
use serde::de::DeserializeOwned;
use std::{str::FromStr, sync::LazyLock};

pub struct PayloadRejection(anyhow::Error);

impl IntoResponse for PayloadRejection {
    fn into_response(self) -> axum::response::Response {
        ApiResponse::error(format!("invalid payload: {}", self.0))
            .with_status(axum::http::StatusCode::BAD_REQUEST)
            .into_response()
    }
}

impl From<anyhow::Error> for PayloadRejection {
    fn from(err: anyhow::Error) -> Self {
        Self(err)
    }
}

static AVAILABLE_DESERIALIZERS: LazyLock<[mime::Mime; 4]> = LazyLock::new(|| {
    [
        mime::APPLICATION_JSON,
        mime::APPLICATION_MSGPACK,
        mime::TEXT_XML,
        mime::Mime::from_str("application/yaml").unwrap(),
    ]
});

/// A small axum payload extractor with content negotiation based on the `Accept` header.
pub struct Payload<T: DeserializeOwned>(pub T);

impl<T: DeserializeOwned> Payload<T> {
    pub fn into_inner(self) -> T {
        self.0
    }

    pub fn from_bytes(content_type: mime::Mime, bytes: &Bytes) -> Result<Self, PayloadRejection> {
        match content_type.essence_str() {
            m if m == mime::APPLICATION_JSON.essence_str() => {
                let value = serde_json::from_slice(bytes).map_err(anyhow::Error::from)?;
                Ok(Payload(value))
            }
            m if m == mime::APPLICATION_MSGPACK.essence_str() => {
                let mut de = rmp_serde::Deserializer::new(bytes.as_ref()).with_human_readable();
                let value = T::deserialize(&mut de).map_err(anyhow::Error::from)?;
                Ok(Payload(value))
            }
            m if m == mime::TEXT_XML.essence_str() => {
                let value =
                    serde_xml_rs::from_reader(bytes.as_ref()).map_err(anyhow::Error::from)?;
                Ok(Payload(value))
            }
            "application/yaml" => {
                let value = serde_norway::from_slice(bytes).map_err(anyhow::Error::from)?;
                Ok(Payload(value))
            }
            _ => Err(PayloadRejection(anyhow::anyhow!(
                "unsupported content type"
            ))),
        }
    }
}

impl<T: DeserializeOwned, S: Send + Sync> FromRequest<S> for Payload<T> {
    type Rejection = PayloadRejection;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let content_type = req
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<mime::Mime>().ok());

        let Some(content_type) = content_type else {
            return Err(PayloadRejection(anyhow::anyhow!("missing content type")));
        };

        if !AVAILABLE_DESERIALIZERS.contains(&content_type) {
            return Err(PayloadRejection(anyhow::anyhow!(
                "unsupported content type"
            )));
        }

        let bytes = match Bytes::from_request(req, state).await {
            Ok(b) => b,
            Err(_) => return Err(PayloadRejection(anyhow::anyhow!("failed to read body"))),
        };
        Self::from_bytes(content_type, &bytes)
    }
}

impl<T, S> OptionalFromRequest<S> for Payload<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = PayloadRejection;

    async fn from_request(req: Request, state: &S) -> Result<Option<Self>, Self::Rejection> {
        let content_type = req
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<mime::Mime>().ok());
        let Some(content_type) = content_type else {
            return Ok(None);
        };

        if !AVAILABLE_DESERIALIZERS.contains(&content_type) {
            return Err(PayloadRejection(anyhow::anyhow!(
                "unsupported content type"
            )));
        }

        let bytes = match Bytes::from_request(req, state).await {
            Ok(b) => b,
            Err(_) => return Err(PayloadRejection(anyhow::anyhow!("failed to read body"))),
        };
        Self::from_bytes(content_type, &bytes).map(Some)
    }
}
