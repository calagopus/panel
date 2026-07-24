use super::{is_filled, parse_dependent_parameters};
use crate::{ParseValidationRule, ValidateRule, Validator};

fn is_accepted_value(value: &str) -> bool {
    matches!(value, "yes" | "on" | "1" | "true")
}

fn is_declined_value(value: &str) -> bool {
    matches!(value, "no" | "off" | "0" | "false")
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L44
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

    fn is_implicit(&self) -> bool {
        true
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        match data.data.get(key).copied() {
            Some(value) if is_filled(value) && is_accepted_value(value) => Ok(()),
            _ => Err("must be 'yes', 'on', '1', or 'true'".into()),
        }
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L59
pub struct AcceptedIf {
    other_key: compact_str::CompactString,
    values: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for AcceptedIf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        let (other_key, values) = parse_dependent_parameters("accepted_if", rule)?;

        Ok(Box::new(AcceptedIf { other_key, values }))
    }
}

impl ValidateRule for AcceptedIf {
    fn label(&self) -> &'static str {
        "accepted_if"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(other) = data.data.get(self.other_key.as_str())
            && self.values.iter().any(|value| value == other)
        {
            match data.data.get(key).copied() {
                Some(value) if is_filled(value) && is_accepted_value(value) => return Ok(()),
                _ => {
                    return Err(compact_str::format_compact!(
                        "must be 'yes', 'on', '1', or 'true' when '{}' is '{other}'",
                        self.other_key
                    ));
                }
            }
        }

        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L83
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

    fn is_implicit(&self) -> bool {
        true
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        match data.data.get(key).copied() {
            Some(value) if is_filled(value) && is_declined_value(value) => Ok(()),
            _ => Err("must be 'no', 'off', '0', or 'false'".into()),
        }
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L98
pub struct DeclinedIf {
    other_key: compact_str::CompactString,
    values: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for DeclinedIf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        let (other_key, values) = parse_dependent_parameters("declined_if", rule)?;

        Ok(Box::new(DeclinedIf { other_key, values }))
    }
}

impl ValidateRule for DeclinedIf {
    fn label(&self) -> &'static str {
        "declined_if"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(other) = data.data.get(self.other_key.as_str())
            && self.values.iter().any(|value| value == other)
        {
            match data.data.get(key).copied() {
                Some(value) if is_filled(value) && is_declined_value(value) => return Ok(()),
                _ => {
                    return Err(compact_str::format_compact!(
                        "must be 'no', 'off', '0', or 'false' when '{}' is '{other}'",
                        self.other_key
                    ));
                }
            }
        }

        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2131
pub struct Required;

impl ParseValidationRule for Required {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Required))
    }
}

impl ValidateRule for Required {
    fn label(&self) -> &'static str {
        "required"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && is_filled(value)
        {
            return Ok(());
        }

        Err("is required and cannot be empty".into())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2154
pub struct RequiredIf {
    other_key: compact_str::CompactString,
    values: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for RequiredIf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        let (other_key, values) = parse_dependent_parameters("required_if", rule)?;

        Ok(Box::new(RequiredIf { other_key, values }))
    }
}

impl ValidateRule for RequiredIf {
    fn label(&self) -> &'static str {
        "required_if"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(other) = data.data.get(self.other_key.as_str())
            && self.values.iter().any(|value| value == other)
        {
            if let Some(value) = data.data.get(key)
                && is_filled(value)
            {
                return Ok(());
            }

            return Err(compact_str::format_compact!(
                "is required when '{}' is '{other}'",
                self.other_key
            ));
        }

        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2179
pub struct RequiredIfAccepted {
    other_key: compact_str::CompactString,
}

impl ParseValidationRule for RequiredIfAccepted {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("required_if_accepted requires one key to check".into());
        }

        Ok(Box::new(RequiredIfAccepted {
            other_key: rule[0].clone(),
        }))
    }
}

impl ValidateRule for RequiredIfAccepted {
    fn label(&self) -> &'static str {
        "required_if_accepted"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(other) = data.data.get(self.other_key.as_str()).copied()
            && is_accepted_value(other)
        {
            if let Some(value) = data.data.get(key)
                && is_filled(value)
            {
                return Ok(());
            }

            return Err(compact_str::format_compact!(
                "is required when '{}' is accepted",
                self.other_key
            ));
        }

        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2198
pub struct RequiredIfDeclined {
    other_key: compact_str::CompactString,
}

impl ParseValidationRule for RequiredIfDeclined {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("required_if_declined requires one key to check".into());
        }

        Ok(Box::new(RequiredIfDeclined {
            other_key: rule[0].clone(),
        }))
    }
}

impl ValidateRule for RequiredIfDeclined {
    fn label(&self) -> &'static str {
        "required_if_declined"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(other) = data.data.get(self.other_key.as_str()).copied()
            && is_declined_value(other)
        {
            if let Some(value) = data.data.get(key)
                && is_filled(value)
            {
                return Ok(());
            }

            return Err(compact_str::format_compact!(
                "is required when '{}' is declined",
                self.other_key
            ));
        }

        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1959
pub struct Nullable;

impl ParseValidationRule for Nullable {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Nullable))
    }
}

impl ValidateRule for Nullable {
    fn label(&self) -> &'static str {
        "nullable"
    }

    fn validate(&self, _key: &str, _data: &Validator) -> Result<(), compact_str::CompactString> {
        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L525
pub struct Confirmed {
    other_key: Option<compact_str::CompactString>,
}

impl ParseValidationRule for Confirmed {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Confirmed {
            other_key: rule.first().cloned(),
        }))
    }
}

impl ValidateRule for Confirmed {
    fn label(&self) -> &'static str {
        "confirmed"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        let confirm_key = match &self.other_key {
            Some(other_key) => other_key.to_string(),
            None => format!("{key}_confirmation"),
        };

        if let Some(value) = data.data.get(key)
            && let Some(confirm_value) = data.data.get(confirm_key.as_str())
            && value == confirm_value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "does not match confirmation field '{confirm_key}'"
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2589
pub struct Same {
    other_key: compact_str::CompactString,
}

impl ParseValidationRule for Same {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("same requires one key to compare against".into());
        }

        Ok(Box::new(Same {
            other_key: rule[0].clone(),
        }))
    }
}

impl ValidateRule for Same {
    fn label(&self) -> &'static str {
        "same"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && let Some(other_value) = data.data.get(self.other_key.as_str())
            && value == other_value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must be the same as '{}'",
            self.other_key
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L698
pub struct Different {
    other_keys: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for Different {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("different requires at least one key to compare against".into());
        }

        Ok(Box::new(Different {
            other_keys: rule.to_vec(),
        }))
    }
}

impl ValidateRule for Different {
    fn label(&self) -> &'static str {
        "different"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        let value = data.data.get(key);

        for other_key in &self.other_keys {
            if let Some(other_value) = data.data.get(other_key.as_str())
                && value == Some(other_value)
            {
                return Err(compact_str::format_compact!(
                    "must be different from '{other_key}'"
                ));
            }
        }

        Ok(())
    }
}
