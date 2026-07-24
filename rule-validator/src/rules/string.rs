use super::parse_preg_pattern;
use crate::{ParseValidationRule, ValidateRule, Validator};

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L373
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && !value.is_empty()
        {
            if self.only_ascii {
                if value.chars().all(|c| c.is_ascii_alphabetic()) {
                    return Ok(());
                }
            } else if value.chars().all(|c| c.is_alphabetic()) {
                return Ok(());
            }
        }

        Err("must contain only alphabetic characters".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L392
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && !value.is_empty()
        {
            if self.only_ascii {
                if value
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
                {
                    return Ok(());
                }
            } else if value
                .chars()
                .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
            {
                return Ok(());
            }
        }

        Err("must contain only alphanumeric characters, dashes, or underscores".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L414
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && !value.is_empty()
        {
            if self.only_ascii {
                if value.chars().all(|c| c.is_ascii_alphanumeric()) {
                    return Ok(());
                }
            } else if value.chars().all(|c| c.is_alphanumeric()) {
                return Ok(());
            }
        }

        Err("must contain only alphanumeric characters".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L160
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.is_ascii()
        {
            return Ok(());
        }

        Err("must contain only ASCII characters".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1465
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && !value.chars().any(|c| c.is_uppercase())
        {
            return Ok(());
        }

        Err("must be lowercase".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1477
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && !value.chars().any(|c| c.is_lowercase())
        {
            return Ok(());
        }

        Err("must be uppercase".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2637
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && self
                .prefixes
                .iter()
                .any(|prefix| value.starts_with(&**prefix))
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must start with one of: {}",
            self.prefixes.join(", ")
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2654
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            for prefix in &self.prefixes {
                if value.starts_with(&**prefix) {
                    return Err(compact_str::format_compact!(
                        "must not start with '{prefix}'"
                    ));
                }
            }
        }

        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2671
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && self
                .suffixes
                .iter()
                .any(|suffix| value.ends_with(&**suffix))
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must end with one of: {}",
            self.suffixes.join(", ")
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2688
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            for suffix in &self.suffixes {
                if value.ends_with(&**suffix) {
                    return Err(compact_str::format_compact!("must not end with '{suffix}'"));
                }
            }
        }

        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2094
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

        Ok(Box::new(Regex {
            pattern: parse_preg_pattern(&rule[0])?,
        }))
    }
}

impl ValidateRule for Regex {
    fn label(&self) -> &'static str {
        "regex"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && self.pattern.is_match(value)
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must match the regex pattern '{}'",
            self.pattern
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2113
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

        Ok(Box::new(NotRegex {
            pattern: parse_preg_pattern(&rule[0])?,
        }))
    }
}

impl ValidateRule for NotRegex {
    fn label(&self) -> &'static str {
        "not_regex"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && !self.pattern.is_match(value)
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must not match the regex pattern '{}'",
            self.pattern
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1521
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key).copied()
            && self.options.iter().any(|option| option == value)
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must be one of: {}",
            self.options.join(", ")
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1972
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

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key).copied()
            && !self.options.iter().any(|option| option == value)
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must not be one of: {}",
            self.options.join(", ")
        ))
    }
}
