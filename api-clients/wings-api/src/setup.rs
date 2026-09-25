use hmac::{Hmac, KeyInit, Mac};
use http_client::CLIENT;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::time::Duration;
use utoipa::ToSchema;

const SIGNATURE_HEADER: &str = "X-Pairing-Signature";
const PROBE_PATH: &str = "/setup/probe";
const ENROLL_PATH: &str = "/setup/enroll";

#[derive(Debug, ToSchema, Deserialize, Serialize)]
pub struct SetupProbeDocker {
    pub available: bool,
    pub version: Option<String>,
}

#[derive(Debug, ToSchema, Deserialize, Serialize)]
pub struct SetupProbe {
    pub version: String,
    pub container: bool,
    pub architecture: String,
    pub cpu_count: u64,
    pub memory_bytes: u64,
    pub disk_bytes: u64,
    pub ips: Vec<String>,
    pub api_port: u16,
    pub sftp_port: u16,
    pub docker: SetupProbeDocker,
}

#[derive(Debug)]
pub enum SetupError {
    Unreachable(reqwest::Error),
    NotWaitingForPairing,
    InvalidPairingCode,
    Rejected(Option<compact_str::CompactString>),
}

impl std::fmt::Display for SetupError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unreachable(_) => write!(f, "the node could not be reached at this address"),
            Self::NotWaitingForPairing => {
                write!(
                    f,
                    "wings at this address is already configured or too old to pair"
                )
            }
            Self::InvalidPairingCode => write!(f, "the pairing code is incorrect"),
            Self::Rejected(Some(error)) => write!(f, "{error}"),
            Self::Rejected(None) => write!(f, "wings rejected the request"),
        }
    }
}

impl std::error::Error for SetupError {}

fn normalize_pairing_code(code: &str) -> String {
    code.chars()
        .filter(char::is_ascii_alphanumeric)
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

fn sign(pairing_code: &str, method: &str, path: &str, body: &[u8]) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(normalize_pairing_code(pairing_code).as_bytes())
        .expect("hmac accepts keys of any length");
    mac.update(method.as_bytes());
    mac.update(b"\n");
    mac.update(path.as_bytes());
    mac.update(b"\n");
    mac.update(body);

    hex::encode(mac.finalize().into_bytes())
}

async fn send(
    base_url: &str,
    path: &str,
    pairing_code: &str,
    body: Vec<u8>,
    timeout: Duration,
) -> Result<reqwest::Response, SetupError> {
    let response = CLIENT
        .post(format!("{}{path}", base_url.trim_end_matches('/')))
        .header("Content-Type", "application/json")
        .header(SIGNATURE_HEADER, sign(pairing_code, "POST", path, &body))
        .timeout(timeout)
        .body(body)
        .send()
        .await
        .map_err(SetupError::Unreachable)?;

    match response.status() {
        status if status.is_success() => Ok(response),
        reqwest::StatusCode::NOT_FOUND | reqwest::StatusCode::METHOD_NOT_ALLOWED => {
            Err(SetupError::NotWaitingForPairing)
        }
        reqwest::StatusCode::UNAUTHORIZED => Err(SetupError::InvalidPairingCode),
        _ => Err(SetupError::Rejected(
            response
                .json::<super::ApiError>()
                .await
                .map(|body| body.error)
                .ok(),
        )),
    }
}

pub async fn probe(base_url: &str, pairing_code: &str) -> Result<SetupProbe, SetupError> {
    send(
        base_url,
        PROBE_PATH,
        pairing_code,
        b"{}".to_vec(),
        Duration::from_secs(15),
    )
    .await?
    .json()
    .await
    .map_err(|_| SetupError::NotWaitingForPairing)
}

pub async fn enroll(
    base_url: &str,
    pairing_code: &str,
    panel_url: &str,
    enrollment_code: &str,
) -> Result<(), SetupError> {
    let body = serde_json::to_vec(&serde_json::json!({
        "panel_url": panel_url,
        "code": enrollment_code,
    }))
    .expect("json serialization of string values cannot fail");

    send(
        base_url,
        ENROLL_PATH,
        pairing_code,
        body,
        Duration::from_secs(30),
    )
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const KNOWN_BODY: &[u8] = br#"{"code":"x"}"#;
    const KNOWN_SIGNATURE: &str =
        "f1e766580abcfd6257d8ef54c8cd7d09e3a01132dead1deb853b3a2fdb1dc307";

    // sign
    #[test]
    fn sign_matches_known_answer() {
        assert_eq!(
            sign("ABCD2345", "POST", "/setup/enroll", KNOWN_BODY),
            KNOWN_SIGNATURE
        );
    }

    #[test]
    fn sign_normalizes_pairing_code() {
        for code in ["abcd-2345", " ABCD 2345 "] {
            assert_eq!(
                sign(code, "POST", "/setup/enroll", KNOWN_BODY),
                KNOWN_SIGNATURE
            );
        }
    }

    // normalize_pairing_code
    #[test]
    fn keeps_only_ascii_alphanumerics_uppercased() {
        assert_eq!(normalize_pairing_code("ab-c\u{e4}1 \u{0663}z\n"), "ABC1Z");
    }

    // SetupError
    #[test]
    fn rejected_display_shows_error_or_falls_back() {
        assert_eq!(
            SetupError::Rejected(None).to_string(),
            "wings rejected the request"
        );
        assert_eq!(
            SetupError::Rejected(Some("bad token".into())).to_string(),
            "bad token"
        );
    }
}
