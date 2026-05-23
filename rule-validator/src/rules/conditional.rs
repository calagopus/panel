use crate::{ParseValidationRule, ValidateRule, Validator};

fn is_present_and_nonempty(value: Option<&&str>) -> bool {
    matches!(value, Some(v) if !v.is_empty() && **v != *"null")
}

fn is_accepted(value: &str) -> bool {
    matches!(value, "true" | "1" | "yes" | "on")
}

fn is_declined(value: &str) -> bool {
    matches!(value, "false" | "0" | "no" | "off")
}

fn parse_key_value_pairs(
    rule: &[compact_str::CompactString],
    rule_name: &str,
) -> Result<Vec<(compact_str::CompactString, compact_str::CompactString)>, compact_str::CompactString>
{
    if rule.len() < 2 {
        return Err(compact_str::format_compact!(
            "{rule_name} requires a key and value to check"
        ));
    }

    let mut keys = Vec::new();
    for i in (0..rule.len()).step_by(2) {
        if i + 1 < rule.len() {
            keys.push((rule[i].clone(), rule[i + 1].clone()));
        } else {
            return Err(compact_str::format_compact!(
                "{rule_name} requires an even number of arguments"
            ));
        }
    }
    Ok(keys)
}

pub struct AcceptedIf {
    keys: Vec<(compact_str::CompactString, compact_str::CompactString)>,
}

impl ParseValidationRule for AcceptedIf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(AcceptedIf {
            keys: parse_key_value_pairs(rule, "accepted_if")?,
        }))
    }
}

impl ValidateRule for AcceptedIf {
    fn label(&self) -> &'static str {
        "accepted_if"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        for (check_key, check_value) in &self.keys {
            if let Some(value) = data.data.get(check_key.as_str())
                && value == check_value
            {
                match data.data.get(key).copied() {
                    Some(v) if is_accepted(v) => return Ok(false),
                    _ => return Err("must be 'true', '1', 'yes', or 'on'".into()),
                }
            }
        }
        Ok(false)
    }
}

pub struct DeclinedIf {
    keys: Vec<(compact_str::CompactString, compact_str::CompactString)>,
}

impl ParseValidationRule for DeclinedIf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(DeclinedIf {
            keys: parse_key_value_pairs(rule, "declined_if")?,
        }))
    }
}

impl ValidateRule for DeclinedIf {
    fn label(&self) -> &'static str {
        "declined_if"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        for (check_key, check_value) in &self.keys {
            if let Some(value) = data.data.get(check_key.as_str())
                && value == check_value
            {
                match data.data.get(key).copied() {
                    Some(v) if is_declined(v) => return Ok(false),
                    _ => return Err("must be 'false', '0', 'no', or 'off'".into()),
                }
            }
        }
        Ok(false)
    }
}

pub struct RequiredIf {
    keys: Vec<(compact_str::CompactString, compact_str::CompactString)>,
}

impl ParseValidationRule for RequiredIf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(RequiredIf {
            keys: parse_key_value_pairs(rule, "required_if")?,
        }))
    }
}

impl ValidateRule for RequiredIf {
    fn label(&self) -> &'static str {
        "required_if"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        for (check_key, check_value) in &self.keys {
            if let Some(value) = data.data.get(check_key.as_str()).copied()
                && value == check_value
            {
                if is_present_and_nonempty(data.data.get(key)) {
                    return Ok(false);
                }
                return Err(compact_str::format_compact!(
                    "is required when '{check_key}' is '{check_value}'"
                ));
            }
        }
        Ok(true)
    }
}

pub struct RequiredUnless {
    keys: Vec<(compact_str::CompactString, compact_str::CompactString)>,
}

impl ParseValidationRule for RequiredUnless {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(RequiredUnless {
            keys: parse_key_value_pairs(rule, "required_unless")?,
        }))
    }
}

impl ValidateRule for RequiredUnless {
    fn label(&self) -> &'static str {
        "required_unless"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        // Required UNLESS any (key, value) pair matches.
        for (check_key, check_value) in &self.keys {
            if let Some(value) = data.data.get(check_key.as_str()).copied()
                && value == check_value
            {
                return Ok(true);
            }
        }

        if is_present_and_nonempty(data.data.get(key)) {
            Ok(false)
        } else {
            let pairs = self
                .keys
                .iter()
                .map(|(k, v)| format!("{k}={v}"))
                .collect::<Vec<_>>()
                .join(", ");
            Err(compact_str::format_compact!(
                "is required unless one of [{pairs}]"
            ))
        }
    }
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(self.other_key.as_str()).copied()
            && is_accepted(value)
        {
            if is_present_and_nonempty(data.data.get(key)) {
                return Ok(false);
            }
            return Err(compact_str::format_compact!(
                "is required when '{}' is accepted",
                self.other_key
            ));
        }
        Ok(true)
    }
}

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

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if let Some(value) = data.data.get(self.other_key.as_str()).copied()
            && is_declined(value)
        {
            if is_present_and_nonempty(data.data.get(key)) {
                return Ok(false);
            }
            return Err(compact_str::format_compact!(
                "is required when '{}' is declined",
                self.other_key
            ));
        }
        Ok(true)
    }
}

/// `required_with:f1,f2,...` — required if ANY listed field is present and non-empty.
pub struct RequiredWith {
    others: Vec<compact_str::CompactString>,
}

/// `required_with_all:f1,f2,...` — required if ALL listed fields are present and non-empty.
pub struct RequiredWithAll {
    others: Vec<compact_str::CompactString>,
}

/// `required_without:f1,f2,...` — required if ANY listed field is absent or empty.
pub struct RequiredWithout {
    others: Vec<compact_str::CompactString>,
}

/// `required_without_all:f1,f2,...` — required if ALL listed fields are absent or empty.
pub struct RequiredWithoutAll {
    others: Vec<compact_str::CompactString>,
}

fn parse_field_list(
    rule: &[compact_str::CompactString],
    rule_name: &str,
) -> Result<Vec<compact_str::CompactString>, compact_str::CompactString> {
    if rule.is_empty() {
        return Err(compact_str::format_compact!(
            "{rule_name} requires at least one field name"
        ));
    }
    Ok(rule.to_vec())
}

impl ParseValidationRule for RequiredWith {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(RequiredWith {
            others: parse_field_list(rule, "required_with")?,
        }))
    }
}

impl ValidateRule for RequiredWith {
    fn label(&self) -> &'static str {
        "required_with"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        let any_present = self
            .others
            .iter()
            .any(|f| is_present_and_nonempty(data.data.get(f.as_str())));

        if !any_present {
            return Ok(true);
        }

        if is_present_and_nonempty(data.data.get(key)) {
            Ok(false)
        } else {
            Err(compact_str::format_compact!(
                "is required when any of [{}] is present",
                self.others.join(", ")
            ))
        }
    }
}

impl ParseValidationRule for RequiredWithAll {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(RequiredWithAll {
            others: parse_field_list(rule, "required_with_all")?,
        }))
    }
}

impl ValidateRule for RequiredWithAll {
    fn label(&self) -> &'static str {
        "required_with_all"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        let all_present = self
            .others
            .iter()
            .all(|f| is_present_and_nonempty(data.data.get(f.as_str())));

        if !all_present {
            return Ok(true);
        }

        if is_present_and_nonempty(data.data.get(key)) {
            Ok(false)
        } else {
            Err(compact_str::format_compact!(
                "is required when all of [{}] are present",
                self.others.join(", ")
            ))
        }
    }
}

impl ParseValidationRule for RequiredWithout {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(RequiredWithout {
            others: parse_field_list(rule, "required_without")?,
        }))
    }
}

impl ValidateRule for RequiredWithout {
    fn label(&self) -> &'static str {
        "required_without"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        let any_absent = self
            .others
            .iter()
            .any(|f| !is_present_and_nonempty(data.data.get(f.as_str())));

        if !any_absent {
            return Ok(true);
        }

        if is_present_and_nonempty(data.data.get(key)) {
            Ok(false)
        } else {
            Err(compact_str::format_compact!(
                "is required when any of [{}] is absent",
                self.others.join(", ")
            ))
        }
    }
}

impl ParseValidationRule for RequiredWithoutAll {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(RequiredWithoutAll {
            others: parse_field_list(rule, "required_without_all")?,
        }))
    }
}

impl ValidateRule for RequiredWithoutAll {
    fn label(&self) -> &'static str {
        "required_without_all"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        let all_absent = self
            .others
            .iter()
            .all(|f| !is_present_and_nonempty(data.data.get(f.as_str())));

        if !all_absent {
            return Ok(true);
        }

        if is_present_and_nonempty(data.data.get(key)) {
            Ok(false)
        } else {
            Err(compact_str::format_compact!(
                "is required when all of [{}] are absent",
                self.others.join(", ")
            ))
        }
    }
}

/// `prohibited` — field must be absent or empty.
pub struct Prohibited;

impl ParseValidationRule for Prohibited {
    fn parse_rule(
        _rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Prohibited))
    }
}

impl ValidateRule for Prohibited {
    fn label(&self) -> &'static str {
        "prohibited"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if !is_present_and_nonempty(data.data.get(key)) {
            return Ok(false);
        }
        Err("is prohibited and must be empty".into())
    }
}

pub struct ProhibitedIf {
    keys: Vec<(compact_str::CompactString, compact_str::CompactString)>,
}

impl ParseValidationRule for ProhibitedIf {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(ProhibitedIf {
            keys: parse_key_value_pairs(rule, "prohibited_if")?,
        }))
    }
}

impl ValidateRule for ProhibitedIf {
    fn label(&self) -> &'static str {
        "prohibited_if"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        for (check_key, check_value) in &self.keys {
            if let Some(value) = data.data.get(check_key.as_str()).copied()
                && value == check_value
            {
                if is_present_and_nonempty(data.data.get(key)) {
                    return Err(compact_str::format_compact!(
                        "is prohibited when '{check_key}' is '{check_value}'"
                    ));
                }
                return Ok(false);
            }
        }
        Ok(false)
    }
}

pub struct ProhibitedUnless {
    keys: Vec<(compact_str::CompactString, compact_str::CompactString)>,
}

impl ParseValidationRule for ProhibitedUnless {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(ProhibitedUnless {
            keys: parse_key_value_pairs(rule, "prohibited_unless")?,
        }))
    }
}

impl ValidateRule for ProhibitedUnless {
    fn label(&self) -> &'static str {
        "prohibited_unless"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        // Prohibited UNLESS any (key, value) pair matches.
        for (check_key, check_value) in &self.keys {
            if let Some(value) = data.data.get(check_key.as_str()).copied()
                && value == check_value
            {
                return Ok(false);
            }
        }

        if is_present_and_nonempty(data.data.get(key)) {
            let pairs = self
                .keys
                .iter()
                .map(|(k, v)| format!("{k}={v}"))
                .collect::<Vec<_>>()
                .join(", ");
            Err(compact_str::format_compact!(
                "is prohibited unless one of [{pairs}]"
            ))
        } else {
            Ok(false)
        }
    }
}

/// `prohibits:f1,f2,...` — if this field is present and non-empty, none of the
/// listed fields may be present and non-empty.
pub struct Prohibits {
    others: Vec<compact_str::CompactString>,
}

impl ParseValidationRule for Prohibits {
    fn parse_rule(
        rule: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
        Ok(Box::new(Prohibits {
            others: parse_field_list(rule, "prohibits")?,
        }))
    }
}

impl ValidateRule for Prohibits {
    fn label(&self) -> &'static str {
        "prohibits"
    }

    fn validate(&self, key: &str, data: &Validator) -> Result<bool, compact_str::CompactString> {
        if !is_present_and_nonempty(data.data.get(key)) {
            return Ok(false);
        }

        let conflicting: Vec<&str> = self
            .others
            .iter()
            .filter(|f| is_present_and_nonempty(data.data.get(f.as_str())))
            .map(|f| f.as_str())
            .collect();

        if conflicting.is_empty() {
            Ok(false)
        } else {
            Err(compact_str::format_compact!(
                "presence prohibits [{}]",
                conflicting.join(", ")
            ))
        }
    }
}
