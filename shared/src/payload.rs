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

const MAX_XML_NESTING_DEPTH: usize = 256;

fn check_xml_nesting_depth(content: &[u8]) -> Result<(), anyhow::Error> {
    let mut reader = quick_xml::Reader::from_reader(content);
    let mut buffer = Vec::new();
    let mut depth: usize = 0;

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(quick_xml::events::Event::Start(_)) => {
                depth += 1;

                if depth > MAX_XML_NESTING_DEPTH {
                    return Err(anyhow::anyhow!(
                        "xml nesting exceeds the maximum depth of {MAX_XML_NESTING_DEPTH}"
                    ));
                }
            }
            Ok(quick_xml::events::Event::End(_)) => depth = depth.saturating_sub(1),
            Ok(quick_xml::events::Event::Eof) | Err(_) => break,
            _ => {}
        }

        buffer.clear();
    }

    Ok(())
}

/// A small axum payload extractor with content negotiation based on the `Accept` header.
pub struct Payload<T: DeserializeOwned>(pub T);

impl<T: DeserializeOwned> Payload<T> {
    pub fn into_inner(self) -> T {
        self.0
    }

    pub fn from_bytes(
        content_type: mime::Mime,
        mut bytes: Bytes,
    ) -> Result<Self, PayloadRejection> {
        match content_type.essence_str() {
            m if m == mime::APPLICATION_JSON.essence_str() => {
                if bytes.is_empty() {
                    bytes = Bytes::from_static(b"{}");
                }

                let value = serde_json::from_slice(&bytes).map_err(anyhow::Error::from)?;
                Ok(Payload(value))
            }
            m if m == mime::APPLICATION_MSGPACK.essence_str() => {
                if bytes.is_empty() {
                    bytes = Bytes::from_static(&[0x80]);
                }

                let mut de = rmp_serde::Deserializer::new(bytes.as_ref()).with_human_readable();
                let value = T::deserialize(&mut de).map_err(anyhow::Error::from)?;
                Ok(Payload(value))
            }
            m if m == mime::TEXT_XML.essence_str() => {
                if bytes.is_empty() {
                    bytes = Bytes::from_static(b"<root></root>");
                }

                check_xml_nesting_depth(bytes.as_ref())?;

                let value =
                    quick_xml::de::from_reader(bytes.as_ref()).map_err(anyhow::Error::from)?;
                Ok(Payload(value))
            }
            "application/yaml" => {
                if bytes.is_empty() {
                    bytes = Bytes::from_static(b"{}");
                }

                let value = serde_norway::from_slice(&bytes).map_err(anyhow::Error::from)?;
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
            return Err(PayloadRejection(anyhow::anyhow!(
                "missing content type header"
            )));
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
        Self::from_bytes(content_type, bytes)
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
        Self::from_bytes(content_type, bytes).map(Some)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xml_nesting_within_the_limit_is_accepted() {
        let body = "<a>".repeat(MAX_XML_NESTING_DEPTH);

        assert!(check_xml_nesting_depth(body.as_bytes()).is_ok());
    }

    #[test]
    fn xml_nesting_beyond_the_limit_is_rejected() {
        let body = "<a>".repeat(MAX_XML_NESTING_DEPTH + 1);

        assert!(check_xml_nesting_depth(body.as_bytes()).is_err());
    }

    #[test]
    fn xml_siblings_do_not_accumulate_depth() {
        let body = format!(
            "<root>{}</root>",
            "<a></a>".repeat(MAX_XML_NESTING_DEPTH * 4)
        );

        assert!(check_xml_nesting_depth(body.as_bytes()).is_ok());
    }

    #[test]
    fn xml_payloads_within_the_limit_still_deserialize() {
        let payload = match Payload::<serde_json::Value>::from_bytes(
            mime::TEXT_XML,
            Bytes::from_static(b"<root><nested><key>value</key></nested></root>"),
        ) {
            Ok(payload) => payload,
            Err(err) => panic!("payload rejected: {}", err.0),
        };

        assert_eq!(payload.0["nested"]["key"]["$text"], "value");
    }

    #[test]
    fn deeply_nested_xml_payloads_are_rejected_before_deserialization() {
        let body = format!("<root>{}", "<a>".repeat(MAX_XML_NESTING_DEPTH + 1));

        assert!(
            Payload::<serde_json::Value>::from_bytes(mime::TEXT_XML, Bytes::from(body)).is_err()
        );
    }
}
