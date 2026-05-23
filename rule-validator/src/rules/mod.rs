use super::{ParseValidationRule, ValidateRule};

#[macro_use]
mod macros;

pub mod comparison;
pub mod compat;
pub mod conditional;
pub mod date;
pub mod format;
pub mod numeric;
pub mod presence;
pub mod string;
pub mod unsupported;

pub fn parse_validation_rule(
    rule: &str,
) -> Result<Box<dyn ValidateRule>, compact_str::CompactString> {
    let mut rule_parts = rule.splitn(2, ':');
    let rule_name = rule_parts.next().ok_or("invalid rule format")?;
    let raw_args = rule_parts.next().unwrap_or("");

    // regex / not_regex / date_format patterns may legitimately contain `,`
    // (e.g. `regex:/^[0-9,]+$/`), so pass the whole arg string through as a
    // single token rather than splitting it.
    let rule_args: Vec<compact_str::CompactString> = if raw_args.is_empty() {
        Vec::new()
    } else if matches!(rule_name, "regex" | "not_regex" | "date_format") {
        vec![compact_str::CompactString::from(raw_args)]
    } else {
        raw_args
            .split(',')
            .map(compact_str::CompactString::from)
            .collect()
    };

    match rule_name {
        // presence.rs
        "required" => presence::Required::parse_rule(&rule_args),
        "nullable" => presence::Nullable::parse_rule(&rule_args),
        "filled" => presence::Filled::parse_rule(&rule_args),
        "confirmed" => presence::Confirmed::parse_rule(&rule_args),
        "bail" => presence::Bail::parse_rule(&rule_args),
        "sometimes" => presence::Sometimes::parse_rule(&rule_args),
        "present" => presence::Present::parse_rule(&rule_args),
        "present_if" => presence::PresentIf::parse_rule(&rule_args),
        "present_unless" => presence::PresentUnless::parse_rule(&rule_args),
        "present_with" => presence::PresentWith::parse_rule(&rule_args),
        "present_with_all" => presence::PresentWithAll::parse_rule(&rule_args),
        "missing" => presence::Missing::parse_rule(&rule_args),
        "missing_if" => presence::MissingIf::parse_rule(&rule_args),
        "missing_unless" => presence::MissingUnless::parse_rule(&rule_args),
        "missing_with" => presence::MissingWith::parse_rule(&rule_args),
        "missing_with_all" => presence::MissingWithAll::parse_rule(&rule_args),

        // string.rs
        "alpha" => string::Alpha::parse_rule(&rule_args),
        "alpha_dash" => string::AlphaDash::parse_rule(&rule_args),
        "alpha_num" => string::AlphaNum::parse_rule(&rule_args),
        "ascii" => string::Ascii::parse_rule(&rule_args),
        "lowercase" => string::Lowercase::parse_rule(&rule_args),
        "uppercase" => string::Uppercase::parse_rule(&rule_args),
        "email" => string::Email::parse_rule(&rule_args),
        "starts_with" => string::StartsWith::parse_rule(&rule_args),
        "ends_with" => string::EndsWith::parse_rule(&rule_args),
        "doesnt_start_with" => string::DoesntStartWith::parse_rule(&rule_args),
        "doesnt_end_with" => string::DoesntEndWith::parse_rule(&rule_args),
        "string" | "str" => string::StringRule::parse_rule(&rule_args),

        // numeric.rs
        "numeric" | "num" => numeric::Numeric::parse_rule(&rule_args),
        "integer" | "int" => numeric::Integer::parse_rule(&rule_args),
        "decimal" => numeric::Decimal::parse_rule(&rule_args),
        "digits" => numeric::Digits::parse_rule(&rule_args),
        "digits_between" => numeric::DigitsBetween::parse_rule(&rule_args),
        "max_digits" => numeric::MaxDigits::parse_rule(&rule_args),
        "min_digits" => numeric::MinDigits::parse_rule(&rule_args),
        "multiple_of" => numeric::MultipleOf::parse_rule(&rule_args),

        // comparison.rs
        "min" => comparison::Min::parse_rule(&rule_args),
        "max" => comparison::Max::parse_rule(&rule_args),
        "between" => comparison::Between::parse_rule(&rule_args),
        "size" => comparison::Size::parse_rule(&rule_args),
        "gt" => comparison::Gt::parse_rule(&rule_args),
        "gte" => comparison::Gte::parse_rule(&rule_args),
        "lt" => comparison::Lt::parse_rule(&rule_args),
        "lte" => comparison::Lte::parse_rule(&rule_args),
        "same" => comparison::Same::parse_rule(&rule_args),
        "different" => comparison::Different::parse_rule(&rule_args),

        // conditional.rs
        "accepted_if" => conditional::AcceptedIf::parse_rule(&rule_args),
        "declined_if" => conditional::DeclinedIf::parse_rule(&rule_args),
        "required_if" => conditional::RequiredIf::parse_rule(&rule_args),
        "required_unless" => conditional::RequiredUnless::parse_rule(&rule_args),
        "required_if_accepted" => conditional::RequiredIfAccepted::parse_rule(&rule_args),
        "required_if_declined" => conditional::RequiredIfDeclined::parse_rule(&rule_args),
        "required_with" => conditional::RequiredWith::parse_rule(&rule_args),
        "required_with_all" => conditional::RequiredWithAll::parse_rule(&rule_args),
        "required_without" => conditional::RequiredWithout::parse_rule(&rule_args),
        "required_without_all" => conditional::RequiredWithoutAll::parse_rule(&rule_args),
        "prohibited" => conditional::Prohibited::parse_rule(&rule_args),
        "prohibited_if" => conditional::ProhibitedIf::parse_rule(&rule_args),
        "prohibited_unless" => conditional::ProhibitedUnless::parse_rule(&rule_args),
        "prohibits" => conditional::Prohibits::parse_rule(&rule_args),

        // format.rs
        "url" => format::Url::parse_rule(&rule_args),
        "uuid" => format::Uuid::parse_rule(&rule_args),
        "ulid" => format::Ulid::parse_rule(&rule_args),
        "json" => format::Json::parse_rule(&rule_args),
        "regex" => format::Regex::parse_rule(&rule_args),
        "not_regex" => format::NotRegex::parse_rule(&rule_args),
        "ip" => format::Ip::parse_rule(&rule_args),
        "ipv4" => format::Ipv4::parse_rule(&rule_args),
        "ipv6" => format::Ipv6::parse_rule(&rule_args),
        "mac_address" => format::MacAddress::parse_rule(&rule_args),
        "hex_color" => format::HexColor::parse_rule(&rule_args),
        "timezone" => format::Timezone::parse_rule(&rule_args),
        "in" => format::In::parse_rule(&rule_args),
        "not_in" => format::NotIn::parse_rule(&rule_args),
        "boolean" | "bool" => format::Boolean::parse_rule(&rule_args),
        "accepted" => format::Accepted::parse_rule(&rule_args),
        "declined" => format::Declined::parse_rule(&rule_args),

        // date.rs
        "date" => date::Date::parse_rule(&rule_args),
        "date_format" => date::DateFormat::parse_rule(&rule_args),
        "after" => date::After::parse_rule(&rule_args),
        "after_or_equal" => date::AfterOrEqual::parse_rule(&rule_args),
        "before" => date::Before::parse_rule(&rule_args),
        "before_or_equal" => date::BeforeOrEqual::parse_rule(&rule_args),

        // compat.rs — parse-and-accept no-ops
        "array" => compat::Array::parse_rule(&rule_args),
        "list" => compat::List::parse_rule(&rule_args),
        "distinct" => compat::Distinct::parse_rule(&rule_args),
        "in_array" => compat::InArray::parse_rule(&rule_args),
        "in_array_keys" => compat::InArrayKeys::parse_rule(&rule_args),
        "contains" => compat::Contains::parse_rule(&rule_args),
        "doesnt_contain" => compat::DoesntContain::parse_rule(&rule_args),
        "required_array_keys" => compat::RequiredArrayKeys::parse_rule(&rule_args),
        "exclude" => compat::Exclude::parse_rule(&rule_args),
        "exclude_if" => compat::ExcludeIf::parse_rule(&rule_args),
        "exclude_unless" => compat::ExcludeUnless::parse_rule(&rule_args),
        "exclude_with" => compat::ExcludeWith::parse_rule(&rule_args),
        "exclude_without" => compat::ExcludeWithout::parse_rule(&rule_args),
        "prohibited_if_accepted" => compat::ProhibitedIfAccepted::parse_rule(&rule_args),
        "prohibited_if_declined" => compat::ProhibitedIfDeclined::parse_rule(&rule_args),
        "date_equals" => compat::DateEquals::parse_rule(&rule_args),

        // unsupported.rs — hard-reject with a clear error
        "file" => unsupported::File::parse_rule(&rule_args),
        "image" => unsupported::Image::parse_rule(&rule_args),
        "mimes" => unsupported::Mimes::parse_rule(&rule_args),
        "mimetypes" => unsupported::Mimetypes::parse_rule(&rule_args),
        "extensions" => unsupported::Extensions::parse_rule(&rule_args),
        "encoding" => unsupported::Encoding::parse_rule(&rule_args),
        "dimensions" => unsupported::Dimensions::parse_rule(&rule_args),
        "exists" => unsupported::Exists::parse_rule(&rule_args),
        "unique" => unsupported::Unique::parse_rule(&rule_args),
        "current_password" => unsupported::CurrentPassword::parse_rule(&rule_args),
        "password" => unsupported::Password::parse_rule(&rule_args),
        "active_url" => unsupported::ActiveUrl::parse_rule(&rule_args),
        "enum" => unsupported::Enum::parse_rule(&rule_args),

        rule => Err(compact_str::format_compact!(
            "unknown or unsupported validation rule: {rule}"
        )),
    }
}
