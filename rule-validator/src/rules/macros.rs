/// Parse-and-accept rule that has no functional effect.
///
/// Used for Laravel rules that don't apply to scalar env-var validation
/// (e.g. `array`, `list`, `bail`, `sometimes`, `present`, `missing`).
/// The rule parses any args, accepts any value, and never errors.
macro_rules! no_op_rule {
    ($name:ident, $label:literal) => {
        pub struct $name;

        impl $crate::ParseValidationRule for $name {
            fn parse_rule(
                _rule: &[compact_str::CompactString],
            ) -> Result<Box<dyn $crate::ValidateRule>, compact_str::CompactString> {
                Ok(Box::new($name))
            }
        }

        impl $crate::ValidateRule for $name {
            fn label(&self) -> &'static str {
                $label
            }

            fn validate(
                &self,
                _key: &str,
                _data: &$crate::Validator,
            ) -> Result<bool, compact_str::CompactString> {
                Ok(false)
            }
        }
    };
}

/// Hard-rejected rule that returns a clear parse error for Laravel rules we
/// cannot honor on scalar env-var data (file/image/exists/etc.).
macro_rules! unsupported_rule {
    ($name:ident, $label:literal) => {
        pub struct $name;

        impl $crate::ParseValidationRule for $name {
            fn parse_rule(
                _rule: &[compact_str::CompactString],
            ) -> Result<Box<dyn $crate::ValidateRule>, compact_str::CompactString> {
                Err(compact_str::format_compact!(
                    "{}: unsupported in env-variable validator",
                    $label
                ))
            }
        }

        impl $crate::ValidateRule for $name {
            fn label(&self) -> &'static str {
                $label
            }

            fn validate(
                &self,
                _key: &str,
                _data: &$crate::Validator,
            ) -> Result<bool, compact_str::CompactString> {
                Ok(false)
            }
        }
    };
}

