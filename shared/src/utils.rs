use colored::Colorize;
use compact_str::ToCompactString;
use garde::Validate;

pub fn handle_startup_error<T>(err: anyhow::Error) -> T {
    eprintln!("{}: {err:#?}", "an error occurred during startup".red());
    std::process::exit(1);
}

#[inline]
pub fn slice_up_to(s: &str, max_len: usize) -> &str {
    if max_len >= s.len() || s.is_empty() {
        return s;
    }

    let mut idx = max_len;
    while !s.is_char_boundary(idx) {
        idx -= 1;
    }

    &s[..idx]
}

#[inline]
pub fn truncate_up_to(mut s: String, max_len: usize) -> String {
    if max_len >= s.len() || s.is_empty() {
        return s;
    }

    let mut idx = max_len;
    while !s.is_char_boundary(idx) {
        idx -= 1;
    }

    s.truncate(idx);
    s
}

const SENSITIVE_QUERY_KEY_PARTS: [&str; 6] = [
    "token",
    "secret",
    "password",
    "key",
    "signature",
    "credential",
];
const SENSITIVE_QUERY_KEYS: [&str; 2] = ["code", "data"];

fn contains_ignore_ascii_case(haystack: &str, needle: &str) -> bool {
    haystack
        .as_bytes()
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}

fn is_sensitive_query_key(key: &str) -> bool {
    SENSITIVE_QUERY_KEYS
        .iter()
        .any(|sensitive| key.eq_ignore_ascii_case(sensitive))
        || SENSITIVE_QUERY_KEY_PARTS
            .iter()
            .any(|part| contains_ignore_ascii_case(key, part))
}

pub fn redact_query(query: &str) -> std::borrow::Cow<'_, str> {
    fn is_sensitive_pair(pair: &str) -> bool {
        pair.split_once('=')
            .is_some_and(|(key, _)| is_sensitive_query_key(key))
    }

    if !query.split('&').any(is_sensitive_pair) {
        return std::borrow::Cow::Borrowed(query);
    }

    let mut redacted = String::with_capacity(query.len());
    for (index, pair) in query.split('&').enumerate() {
        if index > 0 {
            redacted.push('&');
        }

        match pair.split_once('=') {
            Some((key, _)) if is_sensitive_query_key(key) => {
                redacted.push_str(key);
                redacted.push_str("=<redacted>");
            }
            _ => redacted.push_str(pair),
        }
    }

    std::borrow::Cow::Owned(redacted)
}

pub fn redact_url(url: &str) -> std::borrow::Cow<'_, str> {
    let Some((base, query)) = url.split_once('?') else {
        return std::borrow::Cow::Borrowed(url);
    };

    match redact_query(query) {
        std::borrow::Cow::Borrowed(_) => std::borrow::Cow::Borrowed(url),
        std::borrow::Cow::Owned(redacted) => std::borrow::Cow::Owned(format!("{base}?{redacted}")),
    }
}

pub fn validate_language(
    language: &compact_str::CompactString,
    _context: &(),
) -> Result<(), garde::Error> {
    if !crate::FRONTEND_LANGUAGES.contains(language) {
        return Err(garde::Error::new(compact_str::format_compact!(
            "invalid language: {language}"
        )));
    }

    Ok(())
}

pub fn validate_host(host: &compact_str::CompactString, _context: &()) -> Result<(), garde::Error> {
    if host.parse::<std::net::IpAddr>().is_ok() {
        return Ok(());
    }

    let is_valid_hostname = host.len() <= 253
        && host.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
        });

    if !is_valid_hostname {
        return Err(garde::Error::new("must be a valid IP address or hostname"));
    }

    Ok(())
}

pub fn validate_json_path(path: &str, _context: &()) -> Result<(), garde::Error> {
    if let Err(err) = serde_json_path::JsonPath::parse(path) {
        return Err(garde::Error::new(compact_str::format_compact!(
            "must be a valid json path: {err}"
        )));
    }

    Ok(())
}

pub fn validate_time_in_future(
    time: &chrono::DateTime<chrono::Utc>,
    _context: &(),
) -> Result<(), garde::Error> {
    let now = chrono::Utc::now();
    if *time <= now {
        return Err(garde::Error::new("time must be in the future"));
    }

    Ok(())
}

#[inline]
pub fn validate_data<T: Validate>(data: &T) -> Result<(), Vec<String>>
where
    T::Context: Default,
{
    if let Err(err) = data.validate() {
        let error_messages = flatten_validation_errors(&err);

        return Err(error_messages);
    }

    Ok(())
}

pub fn flatten_validation_errors(errors: &garde::Report) -> Vec<String> {
    let mut messages = Vec::new();

    for (path, error) in errors.iter() {
        let full_name = path.to_compact_string();

        messages.push(format!("{full_name}: {}", error.message()));
    }

    messages
}

pub fn axum_to_tungstenite(
    msg: axum::extract::ws::Message,
) -> tokio_tungstenite::tungstenite::Message {
    use axum::extract::ws::Message;
    use tokio_tungstenite::tungstenite::{Message as Tung, protocol::CloseFrame as TungClose};

    match msg {
        Message::Text(text) => Tung::Text(text.as_str().into()),
        Message::Binary(data) => Tung::Binary(data),
        Message::Ping(data) => Tung::Ping(data),
        Message::Pong(data) => Tung::Pong(data),
        Message::Close(frame) => Tung::Close(frame.map(|f| TungClose {
            code: f.code.into(),
            reason: f.reason.as_str().into(),
        })),
    }
}

pub fn tungstenite_to_axum(
    msg: tokio_tungstenite::tungstenite::Message,
) -> Option<axum::extract::ws::Message> {
    use axum::extract::ws::{CloseFrame, Message};
    use tokio_tungstenite::tungstenite::Message as Tung;

    Some(match msg {
        Tung::Text(text) => Message::Text(text.as_str().into()),
        Tung::Binary(data) => Message::Binary(data),
        Tung::Ping(data) => Message::Ping(data),
        Tung::Pong(data) => Message::Pong(data),
        Tung::Close(frame) => Message::Close(frame.map(|f| CloseFrame {
            code: f.code.into(),
            reason: f.reason.as_str().into(),
        })),
        Tung::Frame(_) => return None,
    })
}

pub fn push_scope_or_star<'a>(
    permissions: &mut Vec<&'a str>,
    scope: Option<&'a [compact_str::CompactString]>,
) {
    match scope {
        Some(scope) => permissions.extend(scope.iter().map(compact_str::CompactString::as_str)),
        None => permissions.push("*"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // redact_query

    #[test]
    fn redact_query_leaves_harmless_queries_borrowed() {
        let query = "directory=%2F&ignored=&per_page=100&page=1";

        assert!(matches!(redact_query(query), std::borrow::Cow::Borrowed(_)));
        assert_eq!(redact_query(query), query);
        assert_eq!(redact_query(""), "");
    }

    #[test]
    fn redact_query_redacts_the_download_and_upload_tokens() {
        assert_eq!(
            redact_query(
                "token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzY29wZSI6ImJhY2t1cC1kb3dubG9hZCJ9.sig"
            ),
            "token=<redacted>"
        );
        assert_eq!(
            redact_query("token=eyJ0eXAi.eyJzY29wZSJ9.sig&archive_format=tar_gz"),
            "token=<redacted>&archive_format=tar_gz"
        );
    }

    #[test]
    fn redact_query_redacts_the_password_reset_and_oauth_parameters() {
        assert_eq!(
            redact_query("token=6RnJvbTNoZVNoYWRvd3NPZlRoZURlZXBXZUNhbGxUb1RoZWU"),
            "token=<redacted>"
        );
        assert_eq!(
            redact_query("code=abc123&state=xyz"),
            "code=<redacted>&state=xyz"
        );
        assert_eq!(redact_query("data=eyJ1c2VyIjp7fX0="), "data=<redacted>");
    }

    #[test]
    fn redact_query_matches_keys_case_insensitively_and_by_substring() {
        assert_eq!(redact_query("Token=abc"), "Token=<redacted>");
        assert_eq!(redact_query("access_token=abc"), "access_token=<redacted>");
        assert_eq!(redact_query("api_key=abc"), "api_key=<redacted>");
        assert_eq!(
            redact_query("X-Amz-Signature=abc&X-Amz-Credential=def&X-Amz-Date=20260825T000000Z"),
            "X-Amz-Signature=<redacted>&X-Amz-Credential=<redacted>&X-Amz-Date=20260825T000000Z"
        );
    }

    #[test]
    fn redact_query_keeps_valueless_and_malformed_pairs_intact() {
        assert_eq!(redact_query("token"), "token");
        assert_eq!(redact_query("token="), "token=<redacted>");
        assert_eq!(redact_query("&&"), "&&");
        assert_eq!(redact_query("token=a=b&x=1"), "token=<redacted>&x=1");
    }
}
