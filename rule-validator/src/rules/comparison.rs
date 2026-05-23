use crate::{ParseValidationRule, ValidateRule, Validator};

/// Decides numeric-vs-character-length comparison for `min`/`max`/`between`/`size`.
/// If the field has an explicit `string` rule, always use char length. Otherwise
/// try to parse as a number; if that succeeds, use numeric semantics; if not,
/// fall back to char length.
enum SizeMode {
    Numeric(f64),
    Length(usize),
}

fn measure(value: &str, key: &str, data: &Validator) -> SizeMode {
    if !data.has_rule(key, "string")
        && let Ok(num) = value.parse::<f64>()
    {
        SizeMode::Numeric(num)
    } else {
        SizeMode::Length(value.chars().count())
    }
}

/// `max:N` — numeric `<= N` if the value parses as a number and no `string`
/// rule is set; otherwise character length `<= N`.
pub struct Max {
    value: f64,
}

impl ParseValidationRule for Max {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("max requires one numeric value".into());
        }

        let value = rule[0]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for max"))?;

        Ok(Box::new(Max { value }))
    }
}

impl ValidateRule for Max {
    fn label(&self) -> &'static str {
        "max"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = match measure(value, key, data) {
                SizeMode::Numeric(num) => num <= self.value,
                SizeMode::Length(len) => (len as f64) <= self.value,
            };
            if ok {
                return Ok(false);
            }
        }

        Err(compact_str::format_compact!(
            "must be less than or equal to {}",
            self.value
        ))
    }
}

/// `min:N` — analogous to [`Max`]; numeric or char-length based on rule context.
pub struct Min {
    value: f64,
}

impl ParseValidationRule for Min {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("min requires one numeric value".into());
        }

        let value = rule[0]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for min"))?;

        Ok(Box::new(Min { value }))
    }
}

impl ValidateRule for Min {
    fn label(&self) -> &'static str {
        "min"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = match measure(value, key, data) {
                SizeMode::Numeric(num) => num >= self.value,
                SizeMode::Length(len) => (len as f64) >= self.value,
            };
            if ok {
                return Ok(false);
            }
        }

        Err(compact_str::format_compact!(
            "must be greater than or equal to {}",
            self.value
        ))
    }
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = match measure(value, key, data) {
                SizeMode::Numeric(num) => num >= self.min && num <= self.max,
                SizeMode::Length(len) => {
                    let len = len as f64;
                    len >= self.min && len <= self.max
                }
            };
            if ok {
                return Ok(false);
            }
        }

        Err(compact_str::format_compact!(
            "must be between {} and {}",
            self.min,
            self.max
        ))
    }
}

pub struct Size {
    size: f64,
}

impl ParseValidationRule for Size {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("size requires one numeric value".into());
        }

        let size = rule[0]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for size"))?;

        Ok(Box::new(Size { size }))
    }
}

impl ValidateRule for Size {
    fn label(&self) -> &'static str {
        "size"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = match measure(value, key, data) {
                SizeMode::Numeric(num) => num == self.size,
                SizeMode::Length(len) => (len as f64) == self.size,
            };
            if ok {
                return Ok(false);
            }
        }

        Err(compact_str::format_compact!(
            "must be equal to {}",
            self.size
        ))
    }
}

pub struct Gt {
    value: f64,
}

impl ParseValidationRule for Gt {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("gt requires one numeric value".into());
        }

        let value = rule[0]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for gt"))?;

        Ok(Box::new(Gt { value }))
    }
}

impl ValidateRule for Gt {
    fn label(&self) -> &'static str {
        "gt"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = match measure(value, key, data) {
                SizeMode::Numeric(num) => num > self.value,
                SizeMode::Length(len) => (len as f64) > self.value,
            };
            if ok {
                return Ok(false);
            }
        }

        Err(compact_str::format_compact!(
            "must be greater than {}",
            self.value
        ))
    }
}

pub struct Gte {
    value: f64,
}

impl ParseValidationRule for Gte {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("gte requires one numeric value".into());
        }

        let value = rule[0]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for gte"))?;

        Ok(Box::new(Gte { value }))
    }
}

impl ValidateRule for Gte {
    fn label(&self) -> &'static str {
        "gte"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = match measure(value, key, data) {
                SizeMode::Numeric(num) => num >= self.value,
                SizeMode::Length(len) => (len as f64) >= self.value,
            };
            if ok {
                return Ok(false);
            }
        }

        Err(compact_str::format_compact!(
            "must be greater than or equal to {}",
            self.value
        ))
    }
}

pub struct Lt {
    value: f64,
}

impl ParseValidationRule for Lt {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("lt requires one numeric value".into());
        }

        let value = rule[0]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for lt"))?;

        Ok(Box::new(Lt { value }))
    }
}

impl ValidateRule for Lt {
    fn label(&self) -> &'static str {
        "lt"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = match measure(value, key, data) {
                SizeMode::Numeric(num) => num < self.value,
                SizeMode::Length(len) => (len as f64) < self.value,
            };
            if ok {
                return Ok(false);
            }
        }

        Err(compact_str::format_compact!(
            "must be less than {}",
            self.value
        ))
    }
}

pub struct Lte {
    value: f64,
}

impl ParseValidationRule for Lte {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("lte requires one numeric value".into());
        }

        let value = rule[0]
            .parse::<f64>()
            .map_err(|_| compact_str::CompactString::const_new("invalid value for lte"))?;

        Ok(Box::new(Lte { value }))
    }
}

impl ValidateRule for Lte {
    fn label(&self) -> &'static str {
        "lte"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key) {
            let ok = match measure(value, key, data) {
                SizeMode::Numeric(num) => num <= self.value,
                SizeMode::Length(len) => (len as f64) <= self.value,
            };
            if ok {
                return Ok(false);
            }
        }

        Err(compact_str::format_compact!(
            "must be less than or equal to {}",
            self.value
        ))
    }
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && let Some(other_value) = data.data.get(self.other_key.as_str())
            && value == other_value
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must be the same as '{}'",
            self.other_key
        ))
    }
}

pub struct Different {
    other_key: compact_str::CompactString,
}

impl ParseValidationRule for Different {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.len() != 1 {
            return Err("different requires one key to compare against".into());
        }

        Ok(Box::new(Different {
            other_key: rule[0].clone(),
        }))
    }
}

impl ValidateRule for Different {
    fn label(&self) -> &'static str {
        "different"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && let Some(other_value) = data.data.get(self.other_key.as_str())
            && value != other_value
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must be different from '{}'",
            self.other_key
        ))
    }
}
