use crate::{ParseValidationRule, ValidateRule, Validator};

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<f64>().is_ok()
        {
            return Ok(false);
        }

        Err("must be a valid numeric value".into())
    }
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<i64>().is_ok()
        {
            return Ok(false);
        }

        Err("must be a valid integer".into())
    }
}

/// `decimal:N` (exact N decimal places) or `decimal:N,M` (between N and M).
pub struct Decimal {
    min: usize,
    max: usize,
}

impl ParseValidationRule for Decimal {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        let (min, max) = match rule.len() {
            1 => {
                let n = rule[0]
                    .parse::<usize>()
                    .map_err(|_| compact_str::CompactString::const_new("invalid value for decimal"))?;
                (n, n)
            }
            2 => {
                let n = rule[0]
                    .parse::<usize>()
                    .map_err(|_| compact_str::CompactString::const_new("invalid value for decimal"))?;
                let m = rule[1]
                    .parse::<usize>()
                    .map_err(|_| compact_str::CompactString::const_new("invalid value for decimal"))?;
                (n, m)
            }
            _ => return Err("decimal requires one or two numeric values".into()),
        };

        Ok(Box::new(Decimal { min, max }))
    }
}

impl ValidateRule for Decimal {
    fn label(&self) -> &'static str {
        "decimal"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<f64>().is_ok()
        {
            let decimals = match value.split_once('.') {
                Some((_, frac)) => frac.len(),
                None => 0,
            };
            if decimals >= self.min && decimals <= self.max {
                return Ok(false);
            }
        }

        if self.min == self.max {
            Err(compact_str::format_compact!(
                "must have exactly {} decimal places",
                self.min
            ))
        } else {
            Err(compact_str::format_compact!(
                "must have between {} and {} decimal places",
                self.min,
                self.max
            ))
        }
    }
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| c.is_ascii_digit())
            && value.len() == self.length
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must contain exactly {} digits",
            self.length
        ))
    }
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| c.is_ascii_digit())
        {
            let len = value.len();
            if len >= self.minimum && len <= self.maximum {
                return Ok(false);
            }
        }

        Err(compact_str::format_compact!(
            "must contain between {} and {} digits",
            self.minimum,
            self.maximum
        ))
    }
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| c.is_ascii_digit())
            && value.len() <= self.value
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must contain at most {} digits",
            self.value
        ))
    }
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.chars().all(|c| c.is_ascii_digit())
            && value.len() >= self.value
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must contain at least {} digits",
            self.value
        ))
    }
}

pub struct MultipleOf {
    value: f64,
}

impl ParseValidationRule for MultipleOf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("multiple_of requires one numeric value".into());
        }

        let value = rule[0]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for multiple_of"))?;

        Ok(Box::new(MultipleOf { value }))
    }
}

impl ValidateRule for MultipleOf {
    fn label(&self) -> &'static str {
        "multiple_of"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && let Ok(num) = value.parse::<f64>()
            && num % self.value == 0.0
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must be a multiple of {}",
            self.value
        ))
    }
}
