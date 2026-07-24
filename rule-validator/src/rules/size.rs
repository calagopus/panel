use super::{get_size, is_numeric};
use crate::{ParseValidationRule, ValidateRule, Validator};

fn parse_numeric_arg(
    rule_name: &str,
    rule: &[compact_str::CompactString],
) -> Result<f64, compact_str::CompactString> {
    if rule.len() != 1 {
        return Err(compact_str::format_compact!(
            "{rule_name} requires one numeric value"
        ));
    }

    rule[0]
        .parse::<f64>()
        .map_err(|_| compact_str::format_compact!("invalid value for {rule_name}"))
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L485
pub struct Between {
    min: f64,
    max: f64,
}

impl ParseValidationRule for Between {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 2 {
            return Err("between requires two numeric values".into());
        }

        let min = rule[0]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid minimum value"))?;
        let max = rule[1]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid maximum value"))?;

        Ok(Box::new(Between { min, max }))
    }
}

impl ValidateRule for Between {
    fn label(&self) -> &'static str {
        "between"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let size = get_size(key, value, data);
            if size >= self.min && size <= self.max {
                return Ok(());
            }
        }

        Err(compact_str::format_compact!(
            "must be between {} and {}",
            self.min,
            self.max
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2606
pub struct Size {
    size: f64,
}

impl ParseValidationRule for Size {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Size {
            size: parse_numeric_arg("size", rule)?,
        }))
    }
}

impl ValidateRule for Size {
    fn label(&self) -> &'static str {
        "size"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && get_size(key, value, data) == self.size
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must be equal to {}",
            self.size
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1787
pub struct Min {
    value: f64,
}

impl ParseValidationRule for Min {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Min {
            value: parse_numeric_arg("min", rule)?,
        }))
    }
}

impl ValidateRule for Min {
    fn label(&self) -> &'static str {
        "min"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && get_size(key, value, data) >= self.value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must be greater than or equal to {}",
            self.value
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1673
pub struct Max {
    value: f64,
}

impl ParseValidationRule for Max {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Max {
            value: parse_numeric_arg("max", rule)?,
        }))
    }
}

impl ValidateRule for Max {
    fn label(&self) -> &'static str {
        "max"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && get_size(key, value, data) <= self.value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must be less than or equal to {}",
            self.value
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1286
pub struct Gt {
    value: f64,
}

impl ParseValidationRule for Gt {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Gt {
            value: parse_numeric_arg("gt", rule)?,
        }))
    }
}

impl ValidateRule for Gt {
    fn label(&self) -> &'static str {
        "gt"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && is_numeric(value)
            && get_size(key, value, data) > self.value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must be greater than {}",
            self.value
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1376
pub struct Gte {
    value: f64,
}

impl ParseValidationRule for Gte {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Gte {
            value: parse_numeric_arg("gte", rule)?,
        }))
    }
}

impl ValidateRule for Gte {
    fn label(&self) -> &'static str {
        "gte"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && is_numeric(value)
            && get_size(key, value, data) >= self.value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must be greater than or equal to {}",
            self.value
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1333
pub struct Lt {
    value: f64,
}

impl ParseValidationRule for Lt {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Lt {
            value: parse_numeric_arg("lt", rule)?,
        }))
    }
}

impl ValidateRule for Lt {
    fn label(&self) -> &'static str {
        "lt"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && is_numeric(value)
            && get_size(key, value, data) < self.value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must be less than {}",
            self.value
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1423
pub struct Lte {
    value: f64,
}

impl ParseValidationRule for Lte {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Lte {
            value: parse_numeric_arg("lte", rule)?,
        }))
    }
}

impl ValidateRule for Lte {
    fn label(&self) -> &'static str {
        "lte"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && is_numeric(value)
            && get_size(key, value, data) <= self.value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must be less than or equal to {}",
            self.value
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L723
pub struct Digits {
    length: usize,
}

impl ParseValidationRule for Digits {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("digits requires one numeric value for length".into());
        }

        let length = rule[0]
            .parse::<usize>()
            .map_err(|_| compact_str::CompactString::const_new("invalid length value"))?;

        Ok(Box::new(Digits { length }))
    }
}

impl ValidateRule for Digits {
    fn label(&self) -> &'static str {
        "digits"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| c.is_ascii_digit())
            && value.len() == self.length
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must contain exactly {} digits",
            self.length
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L740
pub struct DigitsBetween {
    minimum: usize,
    maximum: usize,
}

impl ParseValidationRule for DigitsBetween {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 2 {
            return Err("digits_between requires two numeric values".into());
        }

        let minimum = rule[0]
            .parse::<usize>()
            .map_err(|_| compact_str::CompactString::const_new("invalid minimum value"))?;
        let maximum = rule[1]
            .parse::<usize>()
            .map_err(|_| compact_str::CompactString::const_new("invalid maximum value"))?;

        Ok(Box::new(DigitsBetween { minimum, maximum }))
    }
}

impl ValidateRule for DigitsBetween {
    fn label(&self) -> &'static str {
        "digits_between"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| c.is_ascii_digit())
        {
            let len = value.len();
            if len >= self.minimum && len <= self.maximum {
                return Ok(());
            }
        }

        Err(compact_str::format_compact!(
            "must contain between {} and {} digits",
            self.minimum,
            self.maximum
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1696
pub struct MaxDigits {
    value: usize,
}

impl ParseValidationRule for MaxDigits {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("max_digits requires one numeric value".into());
        }

        let value = rule[0]
            .parse::<usize>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for max_digits"))?;

        Ok(Box::new(MaxDigits { value }))
    }
}

impl ValidateRule for MaxDigits {
    fn label(&self) -> &'static str {
        "max_digits"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| c.is_ascii_digit())
            && value.len() <= self.value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must contain at most {} digits",
            self.value
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1806
pub struct MinDigits {
    value: usize,
}

impl ParseValidationRule for MinDigits {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("min_digits requires one numeric value".into());
        }

        let value = rule[0]
            .parse::<usize>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for min_digits"))?;

        Ok(Box::new(MinDigits { value }))
    }
}

impl ValidateRule for MinDigits {
    fn label(&self) -> &'static str {
        "min_digits"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| c.is_ascii_digit())
            && value.len() >= self.value
        {
            return Ok(());
        }

        Err(compact_str::format_compact!(
            "must contain at least {} digits",
            self.value
        ))
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L1922
pub struct MultipleOf {
    value: f64,
}

impl ParseValidationRule for MultipleOf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(MultipleOf {
            value: parse_numeric_arg("multiple_of", rule)?,
        }))
    }
}

impl ValidateRule for MultipleOf {
    fn label(&self) -> &'static str {
        "multiple_of"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<(), compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && is_numeric(value)
            && let Ok(num) = value.trim().parse::<f64>()
        {
            let passes = if num == 0.0 {
                self.value != 0.0
            } else {
                self.value != 0.0 && num % self.value == 0.0
            };

            if passes {
                return Ok(());
            }
        }

        Err(compact_str::format_compact!(
            "must be a multiple of {}",
            self.value
        ))
    }
}
