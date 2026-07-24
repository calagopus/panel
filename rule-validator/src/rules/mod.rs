use super::{ParseValidationRule, ValidateRule, Validator};

mod format;
mod presence;
mod size;
mod string;

pub use format::*;
pub use presence::*;
pub use size::*;
pub use string::*;

pub fn parse_validation_rule(
    rule: &str,
) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
    let mut rule_parts = rule.splitn(2, ':');
    let rule_name = rule_parts.next().ok_or("invalid rule format".to_string())?;
    let rule_args: Vec<compact_str::CompactString> = rule_parts
        .next()
        .map(|args| {
            if matches!(rule_name, "regex" | "not_regex") {
                vec![compact_str::CompactString::from(args)]
            } else {
                args.split(',')
                    .map(compact_str::CompactString::from)
                    .collect()
            }
        })
        .unwrap_or_default();

    match rule_name {
        "accepted" => Accepted::parse_rule(&rule_args),
        "accepted_if" => AcceptedIf::parse_rule(&rule_args),
        "alpha" => Alpha::parse_rule(&rule_args),
        "alpha_dash" => AlphaDash::parse_rule(&rule_args),
        "alpha_num" => AlphaNum::parse_rule(&rule_args),
        "ascii" => Ascii::parse_rule(&rule_args),
        "between" => Between::parse_rule(&rule_args),
        "boolean" => Boolean::parse_rule(&rule_args),
        "confirmed" => Confirmed::parse_rule(&rule_args),
        "date" => Date::parse_rule(&rule_args),
        "date_format" => DateFormat::parse_rule(&rule_args),
        "declined" => Declined::parse_rule(&rule_args),
        "declined_if" => DeclinedIf::parse_rule(&rule_args),
        "different" => Different::parse_rule(&rule_args),
        "digits" => Digits::parse_rule(&rule_args),
        "digits_between" => DigitsBetween::parse_rule(&rule_args),
        "doesnt_start_with" => DoesntStartWith::parse_rule(&rule_args),
        "doesnt_end_with" => DoesntEndWith::parse_rule(&rule_args),
        "ends_with" => EndsWith::parse_rule(&rule_args),
        "gt" => Gt::parse_rule(&rule_args),
        "gte" => Gte::parse_rule(&rule_args),
        "hex_color" => HexColor::parse_rule(&rule_args),
        "in" => In::parse_rule(&rule_args),
        "integer" | "int" => Integer::parse_rule(&rule_args),
        "ip" => Ip::parse_rule(&rule_args),
        "ipv4" => Ipv4::parse_rule(&rule_args),
        "ipv6" => Ipv6::parse_rule(&rule_args),
        "json" => Json::parse_rule(&rule_args),
        "lt" => Lt::parse_rule(&rule_args),
        "lte" => Lte::parse_rule(&rule_args),
        "lowercase" => Lowercase::parse_rule(&rule_args),
        "mac_address" => MacAddress::parse_rule(&rule_args),
        "max" => Max::parse_rule(&rule_args),
        "max_digits" => MaxDigits::parse_rule(&rule_args),
        "min" => Min::parse_rule(&rule_args),
        "min_digits" => MinDigits::parse_rule(&rule_args),
        "multiple_of" => MultipleOf::parse_rule(&rule_args),
        "not_in" => NotIn::parse_rule(&rule_args),
        "not_regex" => NotRegex::parse_rule(&rule_args),
        "nullable" => Nullable::parse_rule(&rule_args),
        "numeric" | "num" => Numeric::parse_rule(&rule_args),
        "regex" => Regex::parse_rule(&rule_args),
        "required" => Required::parse_rule(&rule_args),
        "required_if" => RequiredIf::parse_rule(&rule_args),
        "required_if_accepted" => RequiredIfAccepted::parse_rule(&rule_args),
        "required_if_declined" => RequiredIfDeclined::parse_rule(&rule_args),
        "same" => Same::parse_rule(&rule_args),
        "size" => Size::parse_rule(&rule_args),
        "starts_with" => StartsWith::parse_rule(&rule_args),
        "string" | "str" => StringRule::parse_rule(&rule_args),
        "timezone" => Timezone::parse_rule(&rule_args),
        "uppercase" => Uppercase::parse_rule(&rule_args),
        "url" => Url::parse_rule(&rule_args),
        "uuid" => Uuid::parse_rule(&rule_args),
        rule => Err(compact_str::format_compact!(
            "unknown or unsupported validation rule: {rule}"
        )),
    }
}

// Mirrors PHP is_numeric()
pub(crate) fn is_numeric(value: &str) -> bool {
    let trimmed = value.trim();

    !trimmed.is_empty()
        && trimmed
            .bytes()
            .all(|b| matches!(b, b'0'..=b'9' | b'e' | b'E' | b'+' | b'-' | b'.'))
        && trimmed.parse::<f64>().is_ok()
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2131
pub(crate) fn is_filled(value: &str) -> bool {
    !value.trim().is_empty()
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2780
pub(crate) fn get_size(key: &str, value: &str, validator: &Validator) -> f64 {
    if is_numeric(value) && has_numeric_rule(key, validator) {
        value.trim().parse().unwrap_or(0.0)
    } else {
        value.chars().count() as f64
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Validator.php#L301
pub(crate) fn has_numeric_rule(key: &str, validator: &Validator) -> bool {
    validator.has_rule(key, "numeric") || validator.has_rule(key, "integer")
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2435
pub(crate) fn parse_dependent_parameters(
    rule_name: &str,
    rule: &[compact_str::CompactString],
) -> Result<(compact_str::CompactString, Vec<compact_str::CompactString>), compact_str::CompactString>
{
    if rule.len() < 2 {
        return Err(compact_str::format_compact!(
            "{rule_name} requires a key and at least one value to check"
        ));
    }

    Ok((rule[0].clone(), rule[1..].to_vec()))
}

pub(crate) fn parse_preg_pattern(raw: &str) -> Result<regex::Regex, compact_str::CompactString> {
    let mut pattern = raw;
    let mut flags = "";

    if let Some(delimiter) = raw.chars().next()
        && !delimiter.is_alphanumeric()
        && delimiter != '\\'
        && !delimiter.is_whitespace()
    {
        let closing = match delimiter {
            '(' => ')',
            '[' => ']',
            '{' => '}',
            '<' => '>',
            other => other,
        };

        let body = &raw[delimiter.len_utf8()..];
        if let Some(end) = body.rfind(closing) {
            let candidate_flags = &body[end + closing.len_utf8()..];

            if candidate_flags.chars().all(|c| c.is_ascii_alphabetic()) {
                pattern = &body[..end];
                flags = candidate_flags;
            }
        }
    }

    let mut inline_flags = String::new();
    for flag in flags.chars() {
        match flag {
            'i' | 'm' | 's' | 'x' | 'U' => inline_flags.push(flag),
            _ => {}
        }
    }

    let pattern = if inline_flags.is_empty() {
        pattern.to_string()
    } else {
        format!("(?{inline_flags}){pattern}")
    };

    regex::Regex::new(&pattern)
        .map_err(|_| compact_str::CompactString::const_new("invalid regex pattern"))
}
