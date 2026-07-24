use super::is_numeric;
use crate::{ParseValidationRule, ValidateRule, Validator};

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L506
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        match data.data.get(key).copied() {
            Some("0") | Some("1") | Some("false") | Some("true") => Ok(()),
            _ => Err("must be a boolean ('0', '1', 'true' or 'false')".into()),
        }
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1588
pub struct Integer;

impl ParseValidationRule for Integer {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Integer))
    }
}

impl ValidateRule for Integer {
    fn label(&self) -> &'static str {
        "integer"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.trim().parse::<i64>().is_ok()
        {
            return Ok(());
        }

        Err("must be a valid integer".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1985
pub struct Numeric;

impl ParseValidationRule for Numeric {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Numeric))
    }
}

impl ValidateRule for Numeric {
    fn label(&self) -> &'static str {
        "numeric"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && is_numeric(value)
        {
            return Ok(());
        }

        Err("must be a valid numeric value".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2704
pub struct StringRule;

impl ParseValidationRule for StringRule {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(StringRule))
    }
}

impl ValidateRule for StringRule {
    fn label(&self) -> &'static str {
        "string"
    }

    fn validate(&self, _key: &str, _data: &Validator) -> Result<(), compact_str::CompactString> {
        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L593
pub struct Date;

impl ParseValidationRule for Date {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Date))
    }
}

impl ValidateRule for Date {
    fn label(&self) -> &'static str {
        "date"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && (value.parse::<chrono::NaiveDate>().is_ok()
                || value.parse::<chrono::NaiveDateTime>().is_ok()
                || chrono::DateTime::parse_from_rfc3339(value).is_ok())
        {
            return Ok(());
        }

        Err("must be a valid date".into())
    }
}

// https://www.php.net/manual/en/datetimeimmutable.createfromformat.php
fn php_format_to_chrono(format: &str) -> String {
    let mut out = String::with_capacity(format.len() * 2);
    let mut chars = format.chars();

    while let Some(c) = chars.next() {
        match c {
            'd' => out.push_str("%d"),
            'j' => out.push_str("%-d"),
            'D' => out.push_str("%a"),
            'l' => out.push_str("%A"),
            'N' => out.push_str("%u"),
            'w' => out.push_str("%w"),
            'm' => out.push_str("%m"),
            'n' => out.push_str("%-m"),
            'M' => out.push_str("%b"),
            'F' => out.push_str("%B"),
            'y' => out.push_str("%y"),
            'Y' => out.push_str("%Y"),
            'H' => out.push_str("%H"),
            'G' => out.push_str("%-H"),
            'h' => out.push_str("%I"),
            'g' => out.push_str("%-I"),
            'i' => out.push_str("%M"),
            's' => out.push_str("%S"),
            'A' => out.push_str("%p"),
            'a' => out.push_str("%P"),
            'u' => out.push_str("%6f"),
            'v' => out.push_str("%3f"),
            'e' | 'T' => out.push_str("%Z"),
            'P' => out.push_str("%:z"),
            'O' => out.push_str("%z"),
            'U' => out.push_str("%s"),
            '%' => out.push_str("%%"),
            '\\' => {
                if let Some(escaped) = chars.next() {
                    if escaped == '%' {
                        out.push_str("%%");
                    } else {
                        out.push(escaped);
                    }
                }
            }
            other => out.push(other),
        }
    }

    out
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L620
pub struct DateFormat {
    formats: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for DateFormat {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("date_format requires a format string".into());
        }

        Ok(Box::new(DateFormat {
            formats: rule.to_vec(),
        }))
    }
}

impl ValidateRule for DateFormat {
    fn label(&self) -> &'static str {
        "date_format"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            for format in &self.formats {
                let chrono_format = php_format_to_chrono(format);

                if chrono::NaiveDateTime::parse_from_str(value, &chrono_format).is_ok()
                    || chrono::NaiveDate::parse_from_str(value, &chrono_format).is_ok()
                    || chrono::NaiveTime::parse_from_str(value, &chrono_format).is_ok()
                {
                    return Ok(());
                }
            }
        }

        Err(compact_str::format_compact!(
            "must match the format '{}'",
            self.formats.join(", ")
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1489
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && let Some(digits) = value.strip_prefix('#')
            && matches!(digits.len(), 3 | 4 | 6 | 8)
            && digits.chars().all(|c| c.is_ascii_hexdigit())
        {
            return Ok(());
        }

        Err("must be a valid hex color code".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1604
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<std::net::IpAddr>().is_ok()
        {
            return Ok(());
        }

        Err("must be a valid IP address".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1616
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<std::net::Ipv4Addr>().is_ok()
        {
            return Ok(());
        }

        Err("must be a valid IPv4 address".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1628
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<std::net::Ipv6Addr>().is_ok()
        {
            return Ok(());
        }

        Err("must be a valid IPv6 address".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1640
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        fn groups_of(value: &str, separator: char, count: usize, length: usize) -> bool {
            let parts: Vec<&str> = value.split(separator).collect();
            parts.len() == count
                && parts
                    .iter()
                    .all(|part| part.len() == length && part.chars().all(|c| c.is_ascii_hexdigit()))
        }

        if let Some(value) = data.data.get(key)
            && (groups_of(value, ':', 6, 2)
                || groups_of(value, '-', 6, 2)
                || groups_of(value, '.', 3, 4))
        {
            return Ok(());
        }

        Err("must be a valid MAC address".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1652
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && serde_json::from_str::<serde_json::Value>(value).is_ok()
        {
            return Ok(());
        }

        Err("must be valid JSON".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2717
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<chrono_tz::Tz>().is_ok()
        {
            return Ok(());
        }

        Err("must be a valid timezone".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2733
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && let Ok(url) = reqwest::Url::parse(value)
            && !url.cannot_be_a_base()
            && (self.protocols.is_empty() || self.protocols.contains(&url.scheme().into()))
        {
            return Ok(());
        }

        if self.protocols.is_empty() {
            return Err("must be a valid URL".into());
        }

        Err(compact_str::format_compact!(
            "must be a valid URL with one of the following protocols: {}",
            self.protocols.join(", ")
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2758
pub struct Uuid {
    version: Option<compact_str::CompactString>,
}

impl ParseValidationRule for Uuid {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if let Some(version) = rule.first()
            && version != "max"
            && !version.parse::<u8>().is_ok_and(|v| v <= 8)
        {
            return Err("invalid uuid version".into());
        }

        Ok(Box::new(Uuid {
            version: rule.first().cloned(),
        }))
    }
}

impl ValidateRule for Uuid {
    fn label(&self) -> &'static str {
        "uuid"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && let Ok(uuid) = uuid::Uuid::parse_str(value)
        {
            let version_matches = match &self.version {
                None => true,
                Some(version) if version == "max" => uuid == uuid::Uuid::max(),
                Some(version) => version
                    .parse::<usize>()
                    .is_ok_and(|v| uuid.get_version_num() == v),
            };

            if version_matches {
                return Ok(());
            }
        }

        Err("must be a valid UUID".into())
    }
}
