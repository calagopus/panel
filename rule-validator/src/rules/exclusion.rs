use super::{dependent_value_matches, is_filled, parse_dependent_parameters};
use crate::{Exclusion, ParseValidationRule, ValidateRule, Validator};

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2327
pub struct Exclude;

impl ParseValidationRule for Exclude {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Exclude))
    }
}

impl ValidateRule for Exclude {
    fn label(&self) -> &'static str {
        "exclude"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn exclusion(&self, _data: &Validator) -> Option<Exclusion<'_>> {
        Some(Exclusion {
            reference: None,
            excluded: true,
        })
    }

    fn validate(&self, _key: &str, _data: &Validator) -> Result<(), compact_str::CompactString> {
        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2340
pub struct ExcludeIf {
    other_key: compact_str::CompactString,
    values: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for ExcludeIf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        let (other_key, values) = parse_dependent_parameters("exclude_if", rule)?;

        Ok(Box::new(ExcludeIf { other_key, values }))
    }
}

impl ValidateRule for ExcludeIf {
    fn label(&self) -> &'static str {
        "exclude_if"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn exclusion(&self, data: &Validator) -> Option<Exclusion<'_>> {
        Some(Exclusion {
            reference: Some(&self.other_key),
            excluded: data.data.contains_key(self.other_key.as_str())
                && dependent_value_matches(&self.other_key, &self.values, data),
        })
    }

    fn validate(&self, _key: &str, _data: &Validator) -> Result<(), compact_str::CompactString> {
        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2361
pub struct ExcludeUnless {
    other_key: compact_str::CompactString,
    values: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for ExcludeUnless {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        let (other_key, values) = parse_dependent_parameters("exclude_unless", rule)?;

        Ok(Box::new(ExcludeUnless { other_key, values }))
    }
}

impl ValidateRule for ExcludeUnless {
    fn label(&self) -> &'static str {
        "exclude_unless"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn exclusion(&self, data: &Validator) -> Option<Exclusion<'_>> {
        Some(Exclusion {
            reference: Some(&self.other_key),
            excluded: !dependent_value_matches(&self.other_key, &self.values, data),
        })
    }

    fn validate(&self, _key: &str, _data: &Validator) -> Result<(), compact_str::CompactString> {
        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2399
pub struct ExcludeWith {
    other_key: compact_str::CompactString,
}

impl ParseValidationRule for ExcludeWith {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("exclude_with requires one key to check".into());
        }

        Ok(Box::new(ExcludeWith {
            other_key: rule[0].clone(),
        }))
    }
}

impl ValidateRule for ExcludeWith {
    fn label(&self) -> &'static str {
        "exclude_with"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn exclusion(&self, data: &Validator) -> Option<Exclusion<'_>> {
        Some(Exclusion {
            reference: Some(&self.other_key),
            excluded: data.data.contains_key(self.other_key.as_str()),
        })
    }

    fn validate(&self, _key: &str, _data: &Validator) -> Result<(), compact_str::CompactString> {
        Ok(())
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2418
pub struct ExcludeWithout {
    other_key: compact_str::CompactString,
}

impl ParseValidationRule for ExcludeWithout {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("exclude_without requires one key to check".into());
        }

        Ok(Box::new(ExcludeWithout {
            other_key: rule[0].clone(),
        }))
    }
}

impl ValidateRule for ExcludeWithout {
    fn label(&self) -> &'static str {
        "exclude_without"
    }

    fn is_implicit(&self) -> bool {
        true
    }

    fn exclusion(&self, data: &Validator) -> Option<Exclusion<'_>> {
        Some(Exclusion {
            reference: Some(&self.other_key),
            excluded: !data
                .data
                .get(self.other_key.as_str())
                .is_some_and(|value| is_filled(value)),
        })
    }

    fn validate(&self, _key: &str, _data: &Validator) -> Result<(), compact_str::CompactString> {
        Ok(())
    }
}
