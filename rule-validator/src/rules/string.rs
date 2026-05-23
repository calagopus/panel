use std::sync::OnceLock;

use crate::{ParseValidationRule, ValidateRule, Validator};

pub struct Alpha {
    only_ascii: bool,
}

impl ParseValidationRule for Alpha {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        let only_ascii = rule.first().is_some_and(|s| s == "ascii");
        Ok(Box::new(Alpha { only_ascii }))
    }
}

impl ValidateRule for Alpha {
    fn label(&self) -> &'static str {
        "alpha"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = if self.only_ascii {
                value.chars().all(|c| c.is_ascii_alphabetic())
            } else {
                value.chars().all(|c| c.is_alphabetic())
            };
            if ok {
                return Ok(false);
            }
        }

        Err("must contain only alphabetic characters".into())
    }
}

pub struct AlphaDash {
    only_ascii: bool,
}

impl ParseValidationRule for AlphaDash {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        let only_ascii = rule.first().is_some_and(|s| s == "ascii");
        Ok(Box::new(AlphaDash { only_ascii }))
    }
}

impl ValidateRule for AlphaDash {
    fn label(&self) -> &'static str {
        "alpha_dash"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = if self.only_ascii {
                value
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
            } else {
                value
                    .chars()
                    .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
            };
            if ok {
                return Ok(false);
            }
        }

        Err("must contain only alphanumeric characters, dashes, or underscores".into())
    }
}

pub struct AlphaNum {
    only_ascii: bool,
}

impl ParseValidationRule for AlphaNum {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        let only_ascii = rule.first().is_some_and(|s| s == "ascii");
        Ok(Box::new(AlphaNum { only_ascii }))
    }
}

impl ValidateRule for AlphaNum {
    fn label(&self) -> &'static str {
        "alpha_num"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = if self.only_ascii {
                value.chars().all(|c| c.is_ascii_alphanumeric())
            } else {
                value.chars().all(|c| c.is_alphanumeric())
            };
            if ok {
                return Ok(false);
            }
        }

        Err("must contain only alphanumeric characters".into())
    }
}

pub struct Ascii;

impl ParseValidationRule for Ascii {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Ascii))
    }
}

impl ValidateRule for Ascii {
    fn label(&self) -> &'static str {
        "ascii"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.is_ascii()
        {
            return Ok(false);
        }

        Err("must contain only ASCII characters".into())
    }
}

pub struct Lowercase;

impl ParseValidationRule for Lowercase {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Lowercase))
    }
}

impl ValidateRule for Lowercase {
    fn label(&self) -> &'static str {
        "lowercase"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| !c.is_alphabetic() || c.is_lowercase())
        {
            return Ok(false);
        }

        Err("must be lowercase".into())
    }
}

pub struct Uppercase;

impl ParseValidationRule for Uppercase {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Uppercase))
    }
}

impl ValidateRule for Uppercase {
    fn label(&self) -> &'static str {
        "uppercase"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| !c.is_alphabetic() || c.is_uppercase())
        {
            return Ok(false);
        }

        Err("must be uppercase".into())
    }
}

/// `email` — regex-based check (not DNS or RFC-strict). Laravel offers
/// stricter modes (`rfc`, `dns`, `spoof`, `filter`) that we do not replicate.
pub struct Email;

fn email_regex() -> &'static regex::Regex {
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    RE.get_or_init(|| {
        regex::Regex::new(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,63}$").unwrap()
    })
}

impl ParseValidationRule for Email {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Email))
    }
}

impl ValidateRule for Email {
    fn label(&self) -> &'static str {
        "email"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && email_regex().is_match(value)
        {
            return Ok(false);
        }

        Err("must be a valid email address".into())
    }
}

pub struct StartsWith {
    prefixes: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for StartsWith {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("starts_with requires at least one prefix".into());
        }

        Ok(Box::new(StartsWith {
            prefixes: rule.to_vec(),
        }))
    }
}

impl ValidateRule for StartsWith {
    fn label(&self) -> &'static str {
        "starts_with"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            for prefix in &self.prefixes {
                if value.starts_with(&**prefix) {
                    return Ok(false);
                }
            }
        }

        Err(compact_str::format_compact!(
            "must start with one of: {}",
            self.prefixes.join(", ")
        ))
    }
}

/// `ends_with` — previously inverted (copy-paste of `doesnt_end_with`); now
/// correctly accepts values that end with any of the listed suffixes.
pub struct EndsWith {
    suffixes: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for EndsWith {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("ends_with requires at least one suffix".into());
        }

        Ok(Box::new(EndsWith {
            suffixes: rule.to_vec(),
        }))
    }
}

impl ValidateRule for EndsWith {
    fn label(&self) -> &'static str {
        "ends_with"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            for suffix in &self.suffixes {
                if value.ends_with(&**suffix) {
                    return Ok(false);
                }
            }
        }

        Err(compact_str::format_compact!(
            "must end with one of: {}",
            self.suffixes.join(", ")
        ))
    }
}

pub struct DoesntStartWith {
    prefixes: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for DoesntStartWith {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("doesnt_start_with requires at least one prefix".into());
        }

        Ok(Box::new(DoesntStartWith {
            prefixes: rule.to_vec(),
        }))
    }
}

impl ValidateRule for DoesntStartWith {
    fn label(&self) -> &'static str {
        "doesnt_start_with"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            for prefix in &self.prefixes {
                if value.starts_with(&**prefix) {
                    return Err(compact_str::format_compact!(
                        "must not start with '{prefix}'"
                    ));
                }
            }
        }

        Ok(false)
    }
}

pub struct DoesntEndWith {
    suffixes: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for DoesntEndWith {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("doesnt_end_with requires at least one suffix".into());
        }

        Ok(Box::new(DoesntEndWith {
            suffixes: rule.to_vec(),
        }))
    }
}

impl ValidateRule for DoesntEndWith {
    fn label(&self) -> &'static str {
        "doesnt_end_with"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            for suffix in &self.suffixes {
                if value.ends_with(&**suffix) {
                    return Err(compact_str::format_compact!("must not end with '{suffix}'"));
                }
            }
        }

        Ok(false)
    }
}

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

    fn validate(&self, _key: &str, _data: &Validator) -> Result<bool, compact_str::CompactString> {
        Ok(false)
    }
}
