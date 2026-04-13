use compact_str::ToCompactString;
use garde::Validate;

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
