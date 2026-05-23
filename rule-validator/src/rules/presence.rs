use crate::{ParseValidationRule, ValidateRule, Validator};

/// `required` — field must be present and non-empty.
///
/// Treats both `""` and the literal string `"null"` as empty so that `required`
/// and [`Nullable`] agree on what "empty" means in this scalar env-var model.
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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key).copied()
            && !value.is_empty()
            && value != "null"
        {
            return Ok(false);
        }

        Err("is required and cannot be empty".into())
    }
}

/// `nullable` — short-circuit further validation for this field when the value
/// is empty or the literal string `"null"`.
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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(key).copied()
            && (value.is_empty() || value == "null")
        {
            return Ok(true);
        }

        Ok(false)
    }
}

/// `filled` — if the field is present, it must be non-empty. Distinct from
/// `required`: absent fields are OK, only present-and-empty is an error.
pub struct Filled;

impl ParseValidationRule for Filled {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Filled))
    }
}

impl ValidateRule for Filled {
    fn label(&self) -> &'static str {
        "filled"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        match data.data.get(key).copied() {
            Some(value) if value.is_empty() || value == "null" => {
                Err("must not be empty when present".into())
            }
            _ => Ok(false),
        }
    }
}

pub struct Confirmed;

impl ParseValidationRule for Confirmed {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Confirmed))
    }
}

impl ValidateRule for Confirmed {
    fn label(&self) -> &'static str {
        "confirmed"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        let confirm_key = format!("{key}_confirmation");
        if let Some(value) = data.data.get(key)
            && let Some(confirm_value) = data.data.get(confirm_key.as_str())
            && value == confirm_value
        {
            return Ok(false);
        }

        Err(compact_str::format_compact!(
            "does not match confirmation field '{confirm_key}'"
        ))
    }
}

// `bail` and `sometimes` are control flags in Laravel that the current
// validator's per-field, first-error semantics already cover. We accept them
// for Laravel-string compatibility but they have no runtime effect here.
no_op_rule!(Bail, "bail");
no_op_rule!(Sometimes, "sometimes");

// `present` and its variants require the key to exist in the input. In our
// flat `HashMap<&str, &str>` model, the key always exists if any rule was
// defined for it, so these are trivially true. Parsed for import compat.
no_op_rule!(Present, "present");
no_op_rule!(PresentIf, "present_if");
no_op_rule!(PresentUnless, "present_unless");
no_op_rule!(PresentWith, "present_with");
no_op_rule!(PresentWithAll, "present_with_all");

// `missing` and variants are the inverse — field must NOT be present. Env vars
// are always supplied in this model, so these are no-ops for import compat.
no_op_rule!(Missing, "missing");
no_op_rule!(MissingIf, "missing_if");
no_op_rule!(MissingUnless, "missing_unless");
no_op_rule!(MissingWith, "missing_with");
no_op_rule!(MissingWithAll, "missing_with_all");
