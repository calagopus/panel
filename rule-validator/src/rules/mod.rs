use super::{ParseValidationRule, ValidateRule, Validator};

mod exclusion;
mod format;
mod presence;
mod size;
mod string;

pub use exclusion::*;
pub use format::*;
pub use presence::*;
pub use size::*;
pub use string::*;

pub enum RuleArguments {
    None,
    Flag(&'static str),
    Number,
    NumberRange,
    Version,
    Field,
    Fields,
    FieldValues,
    Values,
    Pattern,
    Formats,
}

pub type RuleParser =
    fn(&[compact_str::CompactString]) -> Result<Box<dyn ValidateRule>, compact_str::CompactString>;

pub struct RuleDefinition {
    pub name: &'static str,
    pub aliases: &'static [&'static str],
    pub implicit: bool,
    pub arguments: RuleArguments,
    pub optional_arguments: bool,
    pub parse: RuleParser,
}

pub static RULES: &[RuleDefinition] = &[
    RuleDefinition {
        name: "accepted",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Accepted::parse_rule,
    },
    RuleDefinition {
        name: "accepted_if",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::FieldValues,
        optional_arguments: false,
        parse: AcceptedIf::parse_rule,
    },
    RuleDefinition {
        name: "alpha",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Flag("ascii"),
        optional_arguments: true,
        parse: Alpha::parse_rule,
    },
    RuleDefinition {
        name: "alpha_dash",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Flag("ascii"),
        optional_arguments: true,
        parse: AlphaDash::parse_rule,
    },
    RuleDefinition {
        name: "alpha_num",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Flag("ascii"),
        optional_arguments: true,
        parse: AlphaNum::parse_rule,
    },
    RuleDefinition {
        name: "ascii",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Ascii::parse_rule,
    },
    RuleDefinition {
        name: "between",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::NumberRange,
        optional_arguments: false,
        parse: Between::parse_rule,
    },
    RuleDefinition {
        name: "boolean",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Boolean::parse_rule,
    },
    RuleDefinition {
        name: "confirmed",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Field,
        optional_arguments: true,
        parse: Confirmed::parse_rule,
    },
    RuleDefinition {
        name: "date",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Date::parse_rule,
    },
    RuleDefinition {
        name: "date_format",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Formats,
        optional_arguments: false,
        parse: DateFormat::parse_rule,
    },
    RuleDefinition {
        name: "declined",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Declined::parse_rule,
    },
    RuleDefinition {
        name: "declined_if",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::FieldValues,
        optional_arguments: false,
        parse: DeclinedIf::parse_rule,
    },
    RuleDefinition {
        name: "different",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Fields,
        optional_arguments: false,
        parse: Different::parse_rule,
    },
    RuleDefinition {
        name: "digits",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: Digits::parse_rule,
    },
    RuleDefinition {
        name: "digits_between",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::NumberRange,
        optional_arguments: false,
        parse: DigitsBetween::parse_rule,
    },
    RuleDefinition {
        name: "doesnt_start_with",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Values,
        optional_arguments: false,
        parse: DoesntStartWith::parse_rule,
    },
    RuleDefinition {
        name: "doesnt_end_with",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Values,
        optional_arguments: false,
        parse: DoesntEndWith::parse_rule,
    },
    RuleDefinition {
        name: "ends_with",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Values,
        optional_arguments: false,
        parse: EndsWith::parse_rule,
    },
    RuleDefinition {
        name: "exclude",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Exclude::parse_rule,
    },
    RuleDefinition {
        name: "exclude_if",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::FieldValues,
        optional_arguments: false,
        parse: ExcludeIf::parse_rule,
    },
    RuleDefinition {
        name: "exclude_unless",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::FieldValues,
        optional_arguments: false,
        parse: ExcludeUnless::parse_rule,
    },
    RuleDefinition {
        name: "exclude_with",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::Field,
        optional_arguments: false,
        parse: ExcludeWith::parse_rule,
    },
    RuleDefinition {
        name: "exclude_without",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::Field,
        optional_arguments: false,
        parse: ExcludeWithout::parse_rule,
    },
    RuleDefinition {
        name: "gt",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: Gt::parse_rule,
    },
    RuleDefinition {
        name: "gte",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: Gte::parse_rule,
    },
    RuleDefinition {
        name: "hex_color",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: HexColor::parse_rule,
    },
    RuleDefinition {
        name: "in",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Values,
        optional_arguments: false,
        parse: In::parse_rule,
    },
    RuleDefinition {
        name: "integer",
        aliases: &["int"],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Integer::parse_rule,
    },
    RuleDefinition {
        name: "ip",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Ip::parse_rule,
    },
    RuleDefinition {
        name: "ipv4",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Ipv4::parse_rule,
    },
    RuleDefinition {
        name: "ipv6",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Ipv6::parse_rule,
    },
    RuleDefinition {
        name: "json",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Json::parse_rule,
    },
    RuleDefinition {
        name: "lt",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: Lt::parse_rule,
    },
    RuleDefinition {
        name: "lte",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: Lte::parse_rule,
    },
    RuleDefinition {
        name: "lowercase",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Lowercase::parse_rule,
    },
    RuleDefinition {
        name: "mac_address",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: MacAddress::parse_rule,
    },
    RuleDefinition {
        name: "max",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: Max::parse_rule,
    },
    RuleDefinition {
        name: "max_digits",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: MaxDigits::parse_rule,
    },
    RuleDefinition {
        name: "min",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: Min::parse_rule,
    },
    RuleDefinition {
        name: "min_digits",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: MinDigits::parse_rule,
    },
    RuleDefinition {
        name: "multiple_of",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: MultipleOf::parse_rule,
    },
    RuleDefinition {
        name: "not_in",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Values,
        optional_arguments: false,
        parse: NotIn::parse_rule,
    },
    RuleDefinition {
        name: "not_regex",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Pattern,
        optional_arguments: false,
        parse: NotRegex::parse_rule,
    },
    RuleDefinition {
        name: "nullable",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Nullable::parse_rule,
    },
    RuleDefinition {
        name: "numeric",
        aliases: &["num"],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Numeric::parse_rule,
    },
    RuleDefinition {
        name: "regex",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Pattern,
        optional_arguments: false,
        parse: Regex::parse_rule,
    },
    RuleDefinition {
        name: "required",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Required::parse_rule,
    },
    RuleDefinition {
        name: "required_if",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::FieldValues,
        optional_arguments: false,
        parse: RequiredIf::parse_rule,
    },
    RuleDefinition {
        name: "required_if_accepted",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::Field,
        optional_arguments: false,
        parse: RequiredIfAccepted::parse_rule,
    },
    RuleDefinition {
        name: "required_if_declined",
        aliases: &[],
        implicit: true,
        arguments: RuleArguments::Field,
        optional_arguments: false,
        parse: RequiredIfDeclined::parse_rule,
    },
    RuleDefinition {
        name: "same",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Field,
        optional_arguments: false,
        parse: Same::parse_rule,
    },
    RuleDefinition {
        name: "size",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Number,
        optional_arguments: false,
        parse: Size::parse_rule,
    },
    RuleDefinition {
        name: "starts_with",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Values,
        optional_arguments: false,
        parse: StartsWith::parse_rule,
    },
    RuleDefinition {
        name: "string",
        aliases: &["str"],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: StringRule::parse_rule,
    },
    RuleDefinition {
        name: "timezone",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Timezone::parse_rule,
    },
    RuleDefinition {
        name: "uppercase",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::None,
        optional_arguments: false,
        parse: Uppercase::parse_rule,
    },
    RuleDefinition {
        name: "url",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Values,
        optional_arguments: true,
        parse: Url::parse_rule,
    },
    RuleDefinition {
        name: "uuid",
        aliases: &[],
        implicit: false,
        arguments: RuleArguments::Version,
        optional_arguments: true,
        parse: Uuid::parse_rule,
    },
];

pub fn parse_validation_rule(
    rule: &str,
) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
    let mut rule_parts = rule.splitn(2, ':');
    let rule_name = rule_parts.next().ok_or("invalid rule format".to_string())?;
    let rule_args: Vec<compact_str::CompactString> = rule_parts
        .next()
        .map(|args| {
            if matches!(rule_name, "regex" | "not_regex") {
                vec![compact_str::CompactString::from(args)]
            } else {
                args.split(',')
                    .map(compact_str::CompactString::from)
                    .collect()
            }
        })
        .unwrap_or_default();

    match RULES
        .iter()
        .find(|definition| definition.name == rule_name || definition.aliases.contains(&rule_name))
    {
        Some(definition) => (definition.parse)(&rule_args),
        None => Err(compact_str::format_compact!(
            "unknown or unsupported validation rule: {rule_name}"
        )),
    }
}

// Mirrors PHP is_numeric()
pub(crate) fn is_numeric(value: &str) -> bool {
    let trimmed = value.trim();

    !trimmed.is_empty()
        && trimmed
            .bytes()
            .all(|b| matches!(b, b'0'..=b'9' | b'e' | b'E' | b'+' | b'-' | b'.'))
        && trimmed.parse::<f64>().is_ok()
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2131
pub(crate) fn is_filled(value: &str) -> bool {
    !value.trim().is_empty()
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2780
pub(crate) fn get_size(key: &str, value: &str, validator: &Validator) -> f64 {
    if is_numeric(value) && has_numeric_rule(key, validator) {
        value.trim().parse().unwrap_or(0.0)
    } else {
        value.chars().count() as f64
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Validator.php#L301
pub(crate) fn has_numeric_rule(key: &str, validator: &Validator) -> bool {
    validator.has_rule(key, "numeric") || validator.has_rule(key, "integer")
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2435
pub(crate) fn parse_dependent_parameters(
    rule_name: &str,
    rule: &[compact_str::CompactString],
) -> Result<(compact_str::CompactString, Vec<compact_str::CompactString>), compact_str::CompactString>
{
    if rule.len() < 2 {
        return Err(compact_str::format_compact!(
            "{rule_name} requires a key and at least one value to check"
        ));
    }

    Ok((rule[0].clone(), rule[1..].to_vec()))
}

fn normalize_boolean(value: &str) -> &str {
    match value {
        "true" => "1",
        "false" => "0",
        value => value,
    }
}

// https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Concerns/ValidatesAttributes.php#L2435
// Booleans are normalized to '1'/'0' instead of PHP's loose comparison, and a
// missing key matches the literal 'null'.
pub(crate) fn dependent_value_matches(
    other_key: &str,
    values: &[compact_str::CompactString],
    validator: &Validator,
) -> bool {
    let Some(other) = validator.data.get(other_key).copied() else {
        return values.iter().any(|value| value == "null");
    };

    if validator.has_rule(other_key, "boolean") {
        return values
            .iter()
            .any(|value| normalize_boolean(value) == normalize_boolean(other));
    }

    values.iter().any(|value| value == other)
}

pub(crate) fn parse_preg_pattern(raw: &str) -> Result<regex::Regex, compact_str::CompactString> {
    let mut pattern = raw;
    let mut flags = "";

    if let Some(delimiter) = raw.chars().next()
        && !delimiter.is_alphanumeric()
        && delimiter != '\\'
        && !delimiter.is_whitespace()
    {
        let closing = match delimiter {
            '(' => ')',
            '[' => ']',
            '{' => '}',
            '<' => '>',
            other => other,
        };

        let body = &raw[delimiter.len_utf8()..];
        if let Some(end) = body.rfind(closing) {
            let candidate_flags = &body[end + closing.len_utf8()..];

            if candidate_flags.chars().all(|c| c.is_ascii_alphabetic()) {
                pattern = &body[..end];
                flags = candidate_flags;
            }
        }
    }

    let mut inline_flags = String::new();
    for flag in flags.chars() {
        match flag {
            'i' | 'm' | 's' | 'x' | 'U' => inline_flags.push(flag),
            _ => {}
        }
    }

    let pattern = if inline_flags.is_empty() {
        pattern.to_string()
    } else {
        format!("(?{inline_flags}){pattern}")
    };

    regex::Regex::new(&pattern)
        .map_err(|_| compact_str::CompactString::const_new("invalid regex pattern"))
}
