use crate::models::user::{AuthMethod, GetAuthMethod};
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

pub fn api_key_scope(auth: Option<&GetAuthMethod>) -> Option<&[compact_str::CompactString]> {
    match &***auth? {
        AuthMethod::ApiKey(api_key) => Some(&api_key.server_permissions),
        _ => None,
    }
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
