use rule_validator::{RULES, RuleArguments, Validator};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = checkRule)]
pub fn check_rule(rule: &str) -> Option<String> {
    rule_validator::validate_rules(&[rule.into()], &())
        .err()
        .map(|err| err.to_string())
}

// Takes `[{ envVariable, rules, value }]`, returns `{ excluded: [...], errors: { KEY: message } }`
// or `{ error }` when a rule can't be parsed.
#[wasm_bindgen]
pub fn validate(variables: &str) -> String {
    let variables = match parse_variables(variables) {
        Ok(variables) => variables,
        Err(error) => return serde_json::json!({ "error": error }).to_string(),
    };

    let data = variables
        .iter()
        .map(|(key, rules, value)| (key.as_str(), (rules.as_slice(), value.as_str())))
        .collect();

    let validator = match Validator::new(data) {
        Ok(validator) => validator,
        Err(error) => return serde_json::json!({ "error": error.as_str() }).to_string(),
    };

    let excluded: Vec<&str> = variables
        .iter()
        .map(|(key, _, _)| key.as_str())
        .filter(|key| validator.is_excluded(key))
        .collect();
    let errors: serde_json::Map<String, serde_json::Value> = validator
        .validate_all()
        .into_iter()
        .map(|(key, error)| (key.to_string(), error.as_str().into()))
        .collect();

    serde_json::json!({ "excluded": excluded, "errors": errors }).to_string()
}

#[wasm_bindgen]
pub fn catalog() -> String {
    serde_json::Value::Array(
        RULES
            .iter()
            .map(|definition| {
                let (arguments, flag) = match definition.arguments {
                    RuleArguments::None => ("none", None),
                    RuleArguments::Flag(flag) => ("flag", Some(flag)),
                    RuleArguments::Number => ("number", None),
                    RuleArguments::NumberRange => ("numberRange", None),
                    RuleArguments::Version => ("version", None),
                    RuleArguments::Field => ("field", None),
                    RuleArguments::Fields => ("fields", None),
                    RuleArguments::FieldValues => ("fieldValues", None),
                    RuleArguments::Values => ("values", None),
                    RuleArguments::Pattern => ("pattern", None),
                    RuleArguments::Formats => ("formats", None),
                };

                serde_json::json!({
                    "name": definition.name,
                    "aliases": definition.aliases,
                    "implicit": definition.implicit,
                    "arguments": arguments,
                    "flag": flag,
                    "optionalArguments": definition.optional_arguments,
                })
            })
            .collect(),
    )
    .to_string()
}

type Variables = Vec<(String, Vec<compact_str::CompactString>, String)>;

fn parse_variables(variables: &str) -> Result<Variables, &'static str> {
    let variables: Vec<HashMap<String, serde_json::Value>> =
        serde_json::from_str(variables).map_err(|_| "invalid variables")?;

    variables
        .into_iter()
        .map(|mut variable| {
            let key = match variable.remove("envVariable") {
                Some(serde_json::Value::String(key)) => key,
                _ => return Err("invalid envVariable"),
            };
            let value = match variable.remove("value") {
                Some(serde_json::Value::String(value)) => value,
                _ => return Err("invalid value"),
            };
            let rules = match variable.remove("rules") {
                Some(serde_json::Value::Array(rules)) => rules
                    .into_iter()
                    .map(|rule| match rule {
                        serde_json::Value::String(rule) => Ok(rule.into()),
                        _ => Err("invalid rule"),
                    })
                    .collect::<Result<_, _>>()?,
                _ => return Err("invalid rules"),
            };

            Ok((key, rules, value))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rule_validator::{RULES, RuleArguments};
    use serde_json::{Value, json};

    fn validate_json(variables: Value) -> Value {
        serde_json::from_str(&validate(&variables.to_string())).unwrap()
    }

    fn error_of(variables: &str) -> Option<String> {
        let output: Value = serde_json::from_str(&validate(variables)).unwrap();
        output["error"].as_str().map(str::to_string)
    }

    fn token_vars(github: &str) -> Value {
        json!([
            { "envVariable": "GITHUB", "rules": [], "value": github },
            {
                "envVariable": "TOKEN",
                "rules": ["exclude_unless:GITHUB,1", "required"],
                "value": "",
            },
        ])
    }

    // check_rule
    #[test]
    fn check_rule_accepts_valid_and_rejects_invalid() {
        for rule in [
            "required",
            "between:1,10",
            "regex:/^a,b$/",
            "exclude_unless:A,1",
        ] {
            assert_eq!(check_rule(rule), None, "{rule}");
        }
        for rule in ["definitely_not_a_rule", "required_if:A", "exclude_with"] {
            assert!(check_rule(rule).is_some(), "{rule}");
        }
    }

    // validate (wasm)
    #[test]
    fn validate_empty_input() {
        assert_eq!(
            validate_json(json!([])),
            json!({ "excluded": [], "errors": {} })
        );
    }

    #[test]
    fn validate_excluded_key_has_no_errors() {
        assert_eq!(
            validate_json(token_vars("0")),
            json!({ "excluded": ["TOKEN"], "errors": {} })
        );

        let output = validate_json(token_vars("1"));
        assert_eq!(output["excluded"], json!([]));
        assert!(output["errors"]["TOKEN"].is_string());
        assert_eq!(output["errors"].as_object().unwrap().len(), 1);
    }

    #[test]
    fn validate_lists_excluded_in_input_order() {
        let output = validate_json(json!([
            { "envVariable": "Z", "rules": ["exclude"], "value": "" },
            { "envVariable": "M", "rules": [], "value": "" },
            { "envVariable": "A", "rules": ["exclude"], "value": "" },
        ]));

        assert_eq!(output["excluded"], json!(["Z", "A"]));
    }

    #[test]
    fn validate_reports_first_error_per_key_and_ignores_extra_fields() {
        let output = validate_json(json!([
            { "envVariable": "A", "rules": ["integer"], "value": "abc", "extra": 1 },
            { "envVariable": "B", "rules": ["required"], "value": "" },
            { "envVariable": "C", "rules": ["integer"], "value": "5" },
        ]));

        let errors = output["errors"].as_object().unwrap();
        assert_eq!(errors.len(), 2);
        assert!(errors["A"].is_string());
        assert!(errors["B"].is_string());
        assert_eq!(output["excluded"], json!([]));
    }

    #[test]
    fn validate_rejects_malformed_input() {
        let cases = [
            ("not json", "invalid variables"),
            ("{}", "invalid variables"),
            ("[1]", "invalid variables"),
            (r#"[{ "rules": [], "value": "" }]"#, "invalid envVariable"),
            (
                r#"[{ "envVariable": 1, "rules": [], "value": "" }]"#,
                "invalid envVariable",
            ),
            (r#"[{ "envVariable": "A", "rules": [] }]"#, "invalid value"),
            (
                r#"[{ "envVariable": "A", "rules": [], "value": 1 }]"#,
                "invalid value",
            ),
            (r#"[{ "envVariable": "A", "value": "" }]"#, "invalid rules"),
            (
                r#"[{ "envVariable": "A", "rules": "required", "value": "" }]"#,
                "invalid rules",
            ),
            (
                r#"[{ "envVariable": "A", "rules": [1], "value": "" }]"#,
                "invalid rule",
            ),
        ];

        for (input, expected) in cases {
            assert_eq!(error_of(input).as_deref(), Some(expected), "{input}");
        }
    }

    #[test]
    fn validate_rejects_unparsable_rule() {
        assert!(
            error_of(
                r#"[{ "envVariable": "A", "rules": ["definitely_not_a_rule"], "value": "" }]"#
            )
            .is_some()
        );
    }

    // catalog
    #[test]
    fn catalog_mirrors_rules() {
        let catalog: Value = serde_json::from_str(&catalog()).unwrap();
        let catalog = catalog.as_array().unwrap();
        assert_eq!(catalog.len(), RULES.len());

        for (entry, definition) in catalog.iter().zip(RULES) {
            let object = entry.as_object().unwrap();
            let mut keys: Vec<&str> = object.keys().map(String::as_str).collect();
            keys.sort_unstable();
            assert_eq!(
                keys,
                [
                    "aliases",
                    "arguments",
                    "flag",
                    "implicit",
                    "name",
                    "optionalArguments"
                ]
            );

            assert_eq!(entry["name"], definition.name);
            assert_eq!(entry["implicit"], definition.implicit);
            assert_eq!(entry["optionalArguments"], definition.optional_arguments);
            assert_eq!(entry["aliases"], json!(definition.aliases));

            let (arguments, flag) = match definition.arguments {
                RuleArguments::None => ("none", None),
                RuleArguments::Flag(flag) => ("flag", Some(flag)),
                RuleArguments::Number => ("number", None),
                RuleArguments::NumberRange => ("numberRange", None),
                RuleArguments::Version => ("version", None),
                RuleArguments::Field => ("field", None),
                RuleArguments::Fields => ("fields", None),
                RuleArguments::FieldValues => ("fieldValues", None),
                RuleArguments::Values => ("values", None),
                RuleArguments::Pattern => ("pattern", None),
                RuleArguments::Formats => ("formats", None),
            };
            assert_eq!(entry["arguments"], arguments, "{}", definition.name);
            assert_eq!(entry["flag"], json!(flag), "{}", definition.name);
        }
    }
}
