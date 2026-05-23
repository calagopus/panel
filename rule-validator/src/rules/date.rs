use crate::{ParseValidationRule, ValidateRule, Validator};

fn parse_date_or_field(
    arg: &str,
    data: &Validator,
) -> Option<chrono::NaiveDate> {
    // Try as a literal date first.
    if let Ok(d) = arg.parse::<chrono::NaiveDate>() {
        return Some(d);
    }
    // Then as a reference to another field.
    data.data
        .get(arg)
        .and_then(|v| v.parse::<chrono::NaiveDate>().ok())
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && value.parse::<chrono::NaiveDate>().is_ok()
        {
            return Ok(false);
        }

        Err("must be a valid date".into())
    }
}

pub struct DateFormat {
    format: compact_str::CompactString,
}

impl ParseValidationRule for DateFormat {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        if rule.is_empty() {
            return Err("date_format requires a format string".into());
        }

        let format = rule[0].clone();
        Ok(Box::new(DateFormat { format }))
    }
}

impl ValidateRule for DateFormat {
    fn label(&self) -> &'static str {
        "date_format"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key)
            && chrono::NaiveDate::parse_from_str(value, &self.format).is_ok()
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "must match the format '{}'",
            self.format
        ))
    }
}

macro_rules! date_compare_rule {
    ($name:ident, $label:literal, $op:tt, $err:literal) => {
        pub struct $name {
            other: compact_str::CompactString,
        }

        impl ParseValidationRule for $name {
            fn parse_rule(
                rule: &[compact_str::CompactString],
            ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
                if rule.len() != 1 {
                    return Err(concat!($label, " requires one date or field reference").into());
                }
                Ok(Box::new($name {
                    other: rule[0].clone(),
                }))
            }
        }

        impl ValidateRule for $name {
            fn label(&self) -> &'static str {
                $label
            }

            fn validate(
                &self,
                key: &str,
                data: &Validator,
            ) -> Result<bool, compact_str::CompactString> {
                if let Some(value) = data.data.get(key)
                    && let Ok(this_date) = value.parse::<chrono::NaiveDate>()
                    && let Some(other_date) = parse_date_or_field(&self.other, data)
                    && this_date $op other_date
                {
                    return Ok(false);
                }

                Err(compact_str::format_compact!(
                    concat!("must be ", $err, " '{}'"),
                    self.other
                ))
            }
        }
    };
}

date_compare_rule!(After, "after", >, "after");
date_compare_rule!(AfterOrEqual, "after_or_equal", >=, "after or equal to");
date_compare_rule!(Before, "before", <, "before");
date_compare_rule!(BeforeOrEqual, "before_or_equal", <=, "before or equal to");
