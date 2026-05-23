use crate::{ParseValidationRule, ValidateRule, Validator};

pub struct Url {
    protocols: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for Url {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Url {
            protocols: rule.to_vec(),
        }))
    }
}

impl ValidateRule for Url {
    fn label(&self) -> &'static str {
        "url"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && let Ok(url) = reqwest::Url::parse(value)
            && (self.protocols.is_empty() || self.protocols.contains(&url.scheme().into()))
        {
            return Ok(false);
        }

        if self.protocols.is_empty() {
            Err("must be a valid URL".into())
        } else {
            Err(compact_str::format_compact!(
                "must be a valid URL with one of the following protocols: {}",
                self.protocols.join(", ")
            ))
        }
    }
}

pub struct Uuid;

impl ParseValidationRule for Uuid {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Uuid))
    }
}

impl ValidateRule for Uuid {
    fn label(&self) -> &'static str {
        "uuid"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && uuid::Uuid::parse_str(value).is_ok()
        {
            return Ok(false);
        }

        Err("must be a valid UUID".into())
    }
}

/// `ulid` — 26 characters in Crockford base32 (0-9, A-Z minus I, L, O, U).
pub struct Ulid;

const CROCKFORD_ALPHABET: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

fn is_crockford_base32_char(c: char) -> bool {
    let upper = c.to_ascii_uppercase() as u8;
    CROCKFORD_ALPHABET.contains(&upper)
}

impl ParseValidationRule for Ulid {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Ulid))
    }
}

impl ValidateRule for Ulid {
    fn label(&self) -> &'static str {
        "ulid"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.len() == 26
            && value.chars().all(is_crockford_base32_char)
        {
            return Ok(false);
        }

        Err("must be a valid ULID".into())
    }
}

pub struct Json;

impl ParseValidationRule for Json {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Json))
    }
}

impl ValidateRule for Json {
    fn label(&self) -> &'static str {
        "json"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && serde_json::from_str::<serde_json::Value>(value).is_ok()
        {
            return Ok(false);
        }

        Err("must be valid JSON".into())
    }
}

pub struct Regex {
    pattern: regex::Regex,
}

impl ParseValidationRule for Regex {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("regex requires a regex pattern".into());
        }

        let pattern = rule[0].trim_matches('/').to_string();
        let regex = regex::Regex::new(&pattern)
            .map_err(|_| compact_str::CompactString::const_new("invalid regex pattern"))?;

        Ok(Box::new(Regex { pattern: regex }))
    }
}

impl ValidateRule for Regex {
    fn label(&self) -> &'static str {
        "regex"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && self.pattern.is_match(value)
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must match the regex pattern '{}'",
            self.pattern
        ))
    }
}

pub struct NotRegex {
    pattern: regex::Regex,
}

impl ParseValidationRule for NotRegex {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("not_regex requires a regex pattern".into());
        }

        let pattern = rule[0].trim_matches('/').to_string();
        let regex = regex::Regex::new(&pattern)
            .map_err(|_| compact_str::CompactString::const_new("invalid regex pattern"))?;

        Ok(Box::new(NotRegex { pattern: regex }))
    }
}

impl ValidateRule for NotRegex {
    fn label(&self) -> &'static str {
        "not_regex"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && !self.pattern.is_match(value)
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must not match the regex pattern '{}'",
            self.pattern
        ))
    }
}

pub struct Ip;

impl ParseValidationRule for Ip {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Ip))
    }
}

impl ValidateRule for Ip {
    fn label(&self) -> &'static str {
        "ip"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<std::net::IpAddr>().is_ok()
        {
            return Ok(false);
        }

        Err("must be a valid IP address".into())
    }
}

pub struct Ipv4;

impl ParseValidationRule for Ipv4 {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Ipv4))
    }
}

impl ValidateRule for Ipv4 {
    fn label(&self) -> &'static str {
        "ipv4"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<std::net::Ipv4Addr>().is_ok()
        {
            return Ok(false);
        }

        Err("must be a valid IPv4 address".into())
    }
}

pub struct Ipv6;

impl ParseValidationRule for Ipv6 {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Ipv6))
    }
}

impl ValidateRule for Ipv6 {
    fn label(&self) -> &'static str {
        "ipv6"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<std::net::Ipv6Addr>().is_ok()
        {
            return Ok(false);
        }

        Err("must be a valid IPv6 address".into())
    }
}

pub struct MacAddress;

impl ParseValidationRule for MacAddress {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(MacAddress))
    }
}

impl ValidateRule for MacAddress {
    fn label(&self) -> &'static str {
        "mac_address"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let parts: Vec<&str> = value.split(':').collect();
            if parts.len() == 6
                && parts
                    .iter()
                    .all(|part| part.len() == 2 && part.chars().all(|c| c.is_ascii_hexdigit()))
            {
                return Ok(false);
            }
        }

        Err("must be a valid MAC address".into())
    }
}

pub struct HexColor;

impl ParseValidationRule for HexColor {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(HexColor))
    }
}

impl ValidateRule for HexColor {
    fn label(&self) -> &'static str {
        "hex_color"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && let Some(rest) = value.strip_prefix('#')
            && matches!(rest.len(), 3 | 4 | 6 | 8)
            && rest.chars().all(|c| c.is_ascii_hexdigit())
        {
            return Ok(false);
        }

        Err("must be a valid hex color code".into())
    }
}

pub struct Timezone;

impl ParseValidationRule for Timezone {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Timezone))
    }
}

impl ValidateRule for Timezone {
    fn label(&self) -> &'static str {
        "timezone"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key).copied()
            && (value.parse::<chrono::FixedOffset>().is_ok()
                || value.parse::<chrono_tz::Tz>().is_ok())
        {
            return Ok(false);
        }

        Err("must be a valid timezone".into())
    }
}

pub struct In {
    options: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for In {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("in requires at least one option".into());
        }

        Ok(Box::new(In {
            options: rule.to_vec(),
        }))
    }
}

impl ValidateRule for In {
    fn label(&self) -> &'static str {
        "in"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key).copied()
            && self.options.iter().any(|option| option == value)
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must be one of: {}",
            self.options.join(", ")
        ))
    }
}

pub struct NotIn {
    options: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for NotIn {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("not_in requires at least one option".into());
        }

        Ok(Box::new(NotIn {
            options: rule.to_vec(),
        }))
    }
}

impl ValidateRule for NotIn {
    fn label(&self) -> &'static str {
        "not_in"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key).copied()
            && !self.options.iter().any(|option| option == value)
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must not be one of: {}",
            self.options.join(", ")
        ))
    }
}

pub struct Boolean;

impl ParseValidationRule for Boolean {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Boolean))
    }
}

impl ValidateRule for Boolean {
    fn label(&self) -> &'static str {
        "boolean"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        match data.data.get(key).copied() {
            Some("true" | "1" | "yes" | "on" | "false" | "0" | "no" | "off") => Ok(false),
            _ => Err("must be a boolean (true/false, 1/0, yes/no, on/off)".into()),
        }
    }
}

pub struct Accepted;

impl ParseValidationRule for Accepted {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Accepted))
    }
}

impl ValidateRule for Accepted {
    fn label(&self) -> &'static str {
        "accepted"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        match data.data.get(key).copied() {
            Some("true" | "1" | "yes" | "on") => Ok(false),
            _ => Err("value must be 'true', '1', 'yes', or 'on'".into()),
        }
    }
}

pub struct Declined;

impl ParseValidationRule for Declined {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Declined))
    }
}

impl ValidateRule for Declined {
    fn label(&self) -> &'static str {
        "declined"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        match data.data.get(key).copied() {
            Some("false" | "0" | "no" | "off") => Ok(false),
            _ => Err("value must be 'false', '0', 'no', or 'off'".into()),
        }
    }
}
