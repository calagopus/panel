use std::collections::{HashMap, HashSet};

mod rules;

pub use rules::{RULES, RuleArguments, RuleDefinition};

pub fn validate_rules(
    rules: &[compact_str::CompactString],
    _context: &(),
) -> Result<(), garde::Error> {
    for rule in rules {
        if let Err(err) = rules::parse_validation_rule(rule) {
            return Err(garde::Error::new(err));
        }
    }

    Ok(())
}

type KeptRules<'r> = Vec<(compact_str::CompactString, Option<&'r str>)>;

pub fn resolve_hidden_references<'a>(
    data: HashMap<&'a str, (&'a [compact_str::CompactString], &'a str)>,
    visible: &HashSet<&str>,
) -> Result<HashMap<&'a str, Option<Vec<compact_str::CompactString>>>, compact_str::CompactString> {
    let raw_rules: Vec<(&'a str, &'a [compact_str::CompactString])> = data
        .iter()
        .filter(|(key, _)| visible.contains(*key))
        .map(|(key, (rules, _))| (*key, *rules))
        .collect();
    let validator = Validator::new(data)?;

    let mut resolved: HashMap<&'a str, Option<KeptRules>> = HashMap::new();
    for (key, rules) in raw_rules {
        let mut kept = Vec::new();
        let mut dropped = false;

        for (raw, rule) in rules.iter().zip(&validator.rules[key]) {
            match rule.exclusion(&validator) {
                Some(Exclusion {
                    reference: Some(reference),
                    excluded,
                }) if !visible.contains(reference) => {
                    if excluded || validator.is_excluded(reference) {
                        dropped = true;
                        break;
                    }
                }
                Some(Exclusion { reference, .. }) => kept.push((raw.clone(), reference)),
                None => kept.push((raw.clone(), None)),
            }
        }

        resolved.insert(key, (!dropped).then_some(kept));
    }

    loop {
        let dropped: HashSet<&str> = resolved
            .iter()
            .filter(|(_, rules)| rules.is_none())
            .map(|(key, _)| *key)
            .collect();
        let mut changed = false;

        for rules in resolved.values_mut() {
            if rules.as_ref().is_some_and(|rules| {
                rules
                    .iter()
                    .any(|(_, reference)| reference.is_some_and(|r| dropped.contains(r)))
            }) {
                *rules = None;
                changed = true;
            }
        }

        if !changed {
            break;
        }
    }

    Ok(resolved
        .into_iter()
        .map(|(key, rules)| {
            (
                key,
                rules.map(|rules| rules.into_iter().map(|(raw, _)| raw).collect()),
            )
        })
        .collect())
}

pub struct Validator<'a> {
    pub rules: HashMap<&'a str, Vec<Box<dyn ValidateRule>>>,
    pub data: HashMap<&'a str, &'a str>,
    excluded: HashSet<&'a str>,
}

impl<'a> Validator<'a> {
    pub fn new(
        data: HashMap<&'a str, (&'a [compact_str::CompactString], &'a str)>,
    ) -> Result<Self, compact_str::CompactString> {
        let mut rules: HashMap<&'a str, Vec<Box<dyn ValidateRule>>> = HashMap::new();
        for (key, (key_rules, _)) in &data {
            let mut rule_objects: Vec<Box<dyn ValidateRule>> = Vec::new();
            rule_objects.reserve_exact(key_rules.len());
            for rule in key_rules.iter() {
                match rules::parse_validation_rule(rule) {
                    Ok(parsed_rule) => rule_objects.push(parsed_rule),
                    Err(err) => {
                        return Err(compact_str::format_compact!("invalid rule '{rule}': {err}"));
                    }
                }
            }

            rules.insert(key, rule_objects);
        }

        let mut validator = Self {
            rules,
            data: data.iter().map(|(k, (_, v))| (*k, *v)).collect(),
            excluded: HashSet::new(),
        };

        validator.excluded = validator.compute_excluded();
        let excluded = &validator.excluded;
        validator.data.retain(|key, _| !excluded.contains(key));

        Ok(validator)
    }

    // Exclusion is resolved up front and transitively (a key is excluded when a key
    // its exclude rules reference is excluded), instead of Laravel's positional,
    // attribute-order dependent removal. Excluded keys are then dropped from the data,
    // mirroring Validator::removeAttribute:
    // https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Validator.php#L470
    fn compute_excluded(&self) -> HashSet<&'a str> {
        let exclusions: Vec<(&'a str, Vec<Exclusion>)> = self
            .rules
            .iter()
            .map(|(key, rules)| {
                (
                    *key,
                    rules
                        .iter()
                        .filter_map(|rule| rule.exclusion(self))
                        .collect(),
                )
            })
            .collect();

        let mut excluded = HashSet::new();
        loop {
            let mut changed = false;

            for (key, key_exclusions) in &exclusions {
                if excluded.contains(key) {
                    continue;
                }

                if key_exclusions.iter().any(|exclusion| {
                    exclusion.excluded
                        || exclusion
                            .reference
                            .is_some_and(|reference| excluded.contains(reference))
                }) {
                    excluded.insert(*key);
                    changed = true;
                }
            }

            if !changed {
                return excluded;
            }
        }
    }

    pub fn is_excluded(&self, key: &str) -> bool {
        self.excluded.contains(key)
    }

    pub fn has_rule(&self, key: &str, label: &str) -> bool {
        let rules = match self.rules.get(key) {
            Some(rules) => rules,
            None => return false,
        };

        for rule in rules {
            if rule.label() == label {
                return true;
            }
        }

        false
    }

    pub fn validate(&self) -> Result<(), String> {
        for (key, rules) in &self.rules {
            if let Err(err) = self.validate_key(key, rules) {
                return Err(format!("{key}: {err}"));
            }
        }

        Ok(())
    }

    // First error of every failing key, sorted by key.
    pub fn validate_all(&self) -> Vec<(&'a str, compact_str::CompactString)> {
        let mut errors: Vec<_> = self
            .rules
            .iter()
            .filter_map(|(key, rules)| self.validate_key(key, rules).err().map(|err| (*key, err)))
            .collect();
        errors.sort_unstable_by_key(|(key, _)| *key);

        errors
    }

    // Mirrors Laravel's Validator::isValidatable, position-independently:
    // https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Validator.php#L813
    //
    // All values here are strings, so the literal "null" (and "") stands in for
    // PHP null when deciding whether `nullable` skips the field.
    fn validate_key(
        &self,
        key: &str,
        rules: &[Box<dyn ValidateRule>],
    ) -> Result<(), compact_str::CompactString> {
        if self.excluded.contains(key) {
            return Ok(());
        }

        let value = self.data.get(key).copied().unwrap_or("");
        let is_null = value.is_empty() || value == "null";
        let nullable = self.has_rule(key, "nullable");

        for rule in rules {
            if !rule.is_implicit() {
                // presentOrRuleIsImplicit: blank fields only run implicit rules
                // https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Validator.php#L833
                if value.trim().is_empty() {
                    continue;
                }

                // isNotNullIfMarkedAsNullable: nullable skips non-implicit rules on null
                // https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Validator.php#L880
                if nullable && is_null {
                    continue;
                }
            }

            rule.validate(key, self)?;
        }

        Ok(())
    }

    pub fn into_data(self) -> HashMap<&'a str, &'a str> {
        self.data
    }
}

pub struct Exclusion<'r> {
    pub reference: Option<&'r str>,
    pub excluded: bool,
}

pub trait ValidateRule: Send + Sync {
    fn label(&self) -> &'static str;

    fn exclusion(&self, _data: &Validator) -> Option<Exclusion<'_>> {
        None
    }

    // Whether the rule runs even when the field is blank, mirroring $implicitRules:
    // https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Validator.php#L207
    fn is_implicit(&self) -> bool {
        false
    }

    fn validate(&self, key: &str, validator: &Validator) -> Result<(), compact_str::CompactString>;
}

pub trait ParseValidationRule: Send + Sync {
    fn parse_rule(
        rules: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use compact_str::CompactString;
    use std::collections::HashSet;

    type Vars<'a> = [(&'a str, &'a [&'a str], &'a str)];

    fn owned_rules<'a>(vars: &Vars<'a>) -> Vec<(&'a str, Vec<CompactString>, &'a str)> {
        vars.iter()
            .map(|(key, rules, value)| {
                (
                    *key,
                    rules.iter().map(|r| CompactString::from(*r)).collect(),
                    *value,
                )
            })
            .collect()
    }

    fn with_validator<T>(
        vars: &Vars,
        f: impl FnOnce(&Validator<'_>) -> T,
    ) -> Result<T, CompactString> {
        let owned = owned_rules(vars);
        let data = owned
            .iter()
            .map(|(key, rules, value)| (*key, (rules.as_slice(), *value)))
            .collect();

        Validator::new(data).map(|validator| f(&validator))
    }

    fn check(vars: &Vars) -> Result<(), String> {
        with_validator(vars, |v| v.validate()).expect("rules should parse")
    }

    fn excluded(vars: &Vars, key: &str) -> bool {
        with_validator(vars, |v| v.is_excluded(key)).expect("rules should parse")
    }

    fn parses(vars: &Vars) -> bool {
        with_validator(vars, |_| ()).is_ok()
    }

    fn fails_on(result: Result<(), String>, key: &str) -> bool {
        result.is_err_and(|e| e.starts_with(&format!("{key}: ")))
    }

    fn resolve(
        vars: &Vars,
        visible: &[&str],
    ) -> Result<HashMap<String, Option<Vec<String>>>, CompactString> {
        let owned = owned_rules(vars);
        let data = owned
            .iter()
            .map(|(key, rules, value)| (*key, (rules.as_slice(), *value)))
            .collect();
        let visible: HashSet<&str> = visible.iter().copied().collect();

        resolve_hidden_references(data, &visible).map(|resolved| {
            resolved
                .into_iter()
                .map(|(key, rules)| {
                    (
                        key.to_string(),
                        rules.map(|r| r.iter().map(|r| r.to_string()).collect()),
                    )
                })
                .collect()
        })
    }

    fn strings(rules: &[&str]) -> Option<Vec<String>> {
        Some(rules.iter().map(|r| r.to_string()).collect())
    }

    // validate_rules
    #[test]
    fn validate_rules_accepts_valid_list() {
        let rules: Vec<CompactString> = [
            "required",
            "int",
            "between:1,10",
            "date_format:H:i",
            "regex:/^a,b$/",
            "required_if:A,1",
            "exclude",
            "exclude_if:A,1",
            "exclude_unless:A,1,2",
            "exclude_with:A",
            "exclude_without:A",
        ]
        .into_iter()
        .map(CompactString::from)
        .collect();

        assert!(validate_rules(&rules, &()).is_ok());
    }

    #[test]
    fn validate_rules_rejects_bad_rules() {
        for rule in [
            "definitely_not_a_rule",
            "required_if:A",
            "exclude_if:A",
            "exclude_unless:A",
            "exclude_with",
            "exclude_with:A,B",
            "exclude_without",
            "exclude_without:A,B",
        ] {
            assert!(
                validate_rules(&[CompactString::from(rule)], &()).is_err(),
                "{rule} should be rejected"
            );
        }
    }

    // Validator
    #[test]
    fn new_rejects_unparsable_rules() {
        assert!(!parses(&[("A", &["definitely_not_a_rule"], "")]));
        assert!(!parses(&[("A", &["required_if:B"], "")]));
        assert!(!parses(&[("A", &["exclude_if:B"], "")]));
        assert!(!parses(&[("A", &["exclude_unless:B"], "")]));
        assert!(!parses(&[("A", &["exclude_with"], "")]));
        assert!(!parses(&[("A", &["exclude_with:B,C"], "")]));
        assert!(!parses(&[("A", &["exclude_without:B,C"], "")]));
    }

    #[test]
    fn blank_value_skips_non_implicit_rules() {
        assert!(check(&[("A", &["min:5", "integer"], "")]).is_ok());
        assert!(check(&[("A", &["min:5", "integer"], "   ")]).is_ok());
        assert!(fails_on(check(&[("A", &["required"], "   ")]), "A"));
    }

    #[test]
    fn nullable_is_position_independent() {
        assert!(check(&[("A", &["nullable", "integer"], "null")]).is_ok());
        assert!(check(&[("A", &["integer", "nullable"], "null")]).is_ok());
        assert!(check(&[("A", &["integer", "min:3", "nullable"], "")]).is_ok());
        assert!(fails_on(
            check(&[("A", &["integer", "nullable"], "abc")]),
            "A"
        ));
    }

    #[test]
    fn null_literal_is_a_plain_string_without_nullable() {
        assert!(fails_on(check(&[("A", &["integer"], "null")]), "A"));
        assert!(check(&[("A", &["required"], "null")]).is_ok());
    }

    #[test]
    fn required_if_matches_any_listed_value_exactly() {
        let rules: &[&str] = &["required_if:A,x,y"];

        assert!(fails_on(check(&[("A", &[], "y"), ("B", rules, "")]), "B"));
        assert!(fails_on(check(&[("A", &[], "x"), ("B", rules, "")]), "B"));
        assert!(check(&[("A", &[], "Y"), ("B", rules, "")]).is_ok());
        assert!(check(&[("A", &[], "z"), ("B", rules, "")]).is_ok());
        assert!(check(&[("B", rules, "")]).is_ok());
        assert!(check(&[("A", &[], "x"), ("B", rules, "set")]).is_ok());
    }

    #[test]
    fn required_if_accepted_and_declined() {
        for value in ["yes", "on", "1", "true"] {
            assert!(fails_on(
                check(&[("A", &[], value), ("B", &["required_if_accepted:A"], "")]),
                "B"
            ));
            assert!(check(&[("A", &[], value), ("B", &["required_if_declined:A"], "")]).is_ok());
        }
        for value in ["no", "off", "0", "false"] {
            assert!(fails_on(
                check(&[("A", &[], value), ("B", &["required_if_declined:A"], "")]),
                "B"
            ));
            assert!(check(&[("A", &[], value), ("B", &["required_if_accepted:A"], "")]).is_ok());
        }
    }

    #[test]
    fn size_rules_count_chars_without_numeric_rule() {
        assert!(check(&[("A", &["max:5"], "100")]).is_ok());
        assert!(fails_on(check(&[("A", &["max:5"], "123456")]), "A"));
        assert!(check(&[("A", &["between:2,4"], "10")]).is_ok());
        assert!(check(&[("A", &["size:3"], "ééé")]).is_ok());
        assert!(fails_on(check(&[("A", &["max:2"], "ééé")]), "A"));
    }

    #[test]
    fn size_rules_compare_numerically_with_numeric_rule() {
        for numeric in ["integer", "int", "numeric", "num"] {
            assert!(
                fails_on(check(&[("A", &[numeric, "max:5"], "100")]), "A"),
                "{numeric}"
            );
            assert!(
                fails_on(check(&[("A", &["between:2,4", numeric], "10")]), "A"),
                "{numeric}"
            );
            assert!(
                check(&[("A", &[numeric, "min:50"], "100")]).is_ok(),
                "{numeric}"
            );
        }
    }

    #[test]
    fn boolean_accepts_only_strict_values() {
        for value in ["0", "1", "true", "false"] {
            assert!(check(&[("A", &["boolean"], value)]).is_ok(), "{value}");
        }
        for value in ["yes", "on", "2"] {
            assert!(
                fails_on(check(&[("A", &["boolean"], value)]), "A"),
                "{value}"
            );
        }
    }

    #[test]
    fn regex_keeps_commas_and_handles_delimiters() {
        assert!(check(&[("A", &["regex:/^a,b$/"], "a,b")]).is_ok());
        assert!(fails_on(check(&[("A", &["regex:/^a,b$/"], "a")]), "A"));
        assert!(check(&[("A", &["regex:/^abc$/i"], "ABC")]).is_ok());
        assert!(fails_on(check(&[("A", &["regex:/^abc$/"], "ABC")]), "A"));
        assert!(check(&[("A", &[r"regex:^\d+$"], "123")]).is_ok());
        assert!(fails_on(check(&[("A", &[r"regex:^\d+$"], "12a")]), "A"));
        assert!(fails_on(
            check(&[("A", &["not_regex:/^a,b$/"], "a,b")]),
            "A"
        ));
        assert!(check(&[("A", &["not_regex:/^a,b$/"], "x")]).is_ok());
    }

    #[test]
    fn in_and_not_in() {
        assert!(check(&[("A", &["in:a,b"], "b")]).is_ok());
        assert!(fails_on(check(&[("A", &["in:a,b"], "c")]), "A"));
        assert!(fails_on(check(&[("A", &["not_in:a,b"], "a")]), "A"));
        assert!(check(&[("A", &["not_in:a,b"], "c")]).is_ok());
    }

    #[test]
    fn date_format_with_colon_in_argument() {
        assert!(check(&[("A", &["date_format:H:i"], "13:45")]).is_ok());
        assert!(fails_on(check(&[("A", &["date_format:H:i"], "nope")]), "A"));
    }

    #[test]
    fn exclude_always_excludes() {
        let vars: &Vars = &[("A", &["exclude", "required", "integer"], "")];

        assert!(excluded(vars, "A"));
        assert!(check(vars).is_ok());
        assert!(check(&[("A", &["integer", "exclude"], "abc")]).is_ok());
    }

    #[test]
    fn exclude_if_matches_any_listed_value() {
        let rules: &[&str] = &["required", "exclude_if:B,x,y"];

        assert!(excluded(&[("A", rules, ""), ("B", &[], "y")], "A"));
        assert!(check(&[("A", rules, ""), ("B", &[], "y")]).is_ok());
        assert!(!excluded(&[("A", rules, ""), ("B", &[], "z")], "A"));
        assert!(fails_on(check(&[("A", rules, ""), ("B", &[], "z")]), "A"));
        assert!(!excluded(&[("A", rules, "")], "A"));
        assert!(!excluded(
            &[("A", &["exclude_if:B,1"], ""), ("B", &[], "true")],
            "A"
        ));
    }

    #[test]
    fn exclude_unless_matches_none_of_values() {
        let rules: &[&str] = &["exclude_unless:B,x,y"];

        assert!(excluded(&[("A", rules, ""), ("B", &[], "z")], "A"));
        assert!(!excluded(&[("A", rules, ""), ("B", &[], "x")], "A"));
        assert!(excluded(&[("A", rules, "")], "A"));
        assert!(!excluded(&[("A", &["exclude_unless:B,x,null"], "")], "A"));
    }

    #[test]
    fn exclude_value_matching_uses_boolean_equivalence() {
        assert!(!excluded(
            &[
                ("A", &["exclude_unless:B,true"], ""),
                ("B", &["boolean"], "1")
            ],
            "A"
        ));
        assert!(excluded(
            &[("A", &["exclude_unless:B,true"], ""), ("B", &[], "1")],
            "A"
        ));
        assert!(excluded(
            &[("A", &["exclude_if:B,false"], ""), ("B", &["boolean"], "0")],
            "A"
        ));
        assert!(excluded(
            &[("A", &["exclude_if:B,1"], ""), ("B", &["boolean"], "true")],
            "A"
        ));
        assert!(!excluded(
            &[("A", &["exclude_if:B,1"], ""), ("B", &["boolean"], "false")],
            "A"
        ));
    }

    #[test]
    fn exclude_with_and_without() {
        assert!(excluded(
            &[("A", &["exclude_with:B"], ""), ("B", &[], "")],
            "A"
        ));
        assert!(excluded(
            &[("A", &["exclude_with:B"], ""), ("B", &[], "v")],
            "A"
        ));
        assert!(!excluded(&[("A", &["exclude_with:B"], "")], "A"));

        assert!(excluded(&[("A", &["exclude_without:B"], "")], "A"));
        assert!(excluded(
            &[("A", &["exclude_without:B"], ""), ("B", &[], "  ")],
            "A"
        ));
        assert!(!excluded(
            &[("A", &["exclude_without:B"], ""), ("B", &[], "v")],
            "A"
        ));
    }

    #[test]
    fn exclude_rules_run_before_other_rules_regardless_of_position() {
        assert!(
            check(&[
                ("A", &["required", "min:3", "exclude_if:B,1"], ""),
                ("B", &[], "1")
            ])
            .is_ok()
        );
        assert!(check(&[("A", &["integer", "exclude_with:B"], "abc"), ("B", &[], "")]).is_ok());
    }

    #[test]
    fn exclusion_is_transitive() {
        let vars: &Vars = &[
            ("A", &["exclude"], ""),
            ("B", &["exclude_if:A,zzz", "required"], ""),
            ("C", &["exclude_if:B,zzz", "required"], ""),
        ];

        assert!(excluded(vars, "B"));
        assert!(excluded(vars, "C"));
        assert!(check(vars).is_ok());
    }

    #[test]
    fn exclusion_cycles_terminate() {
        let neither: &Vars = &[
            ("A", &["exclude_if:B,x"], "a"),
            ("B", &["exclude_if:A,y"], "b"),
        ];
        assert!(!excluded(neither, "A"));
        assert!(!excluded(neither, "B"));

        let a_fires: &Vars = &[
            ("A", &["exclude_if:B,x"], "a"),
            ("B", &["exclude_if:A,y"], "x"),
        ];
        assert!(excluded(a_fires, "A"));
        assert!(excluded(a_fires, "B"));
    }

    #[test]
    fn excluded_key_runs_no_rules() {
        let token: &[&str] = &["exclude_unless:GITHUB,1", "required", "min:40"];

        assert!(check(&[("GITHUB", &[], "0"), ("TOKEN", token, "")]).is_ok());
        assert!(check(&[("GITHUB", &[], "0"), ("TOKEN", token, "short")]).is_ok());
        assert!(fails_on(
            check(&[("GITHUB", &[], "1"), ("TOKEN", token, "")]),
            "TOKEN"
        ));
        assert!(fails_on(
            check(&[("GITHUB", &["boolean"], "true"), ("TOKEN", token, "short")]),
            "TOKEN"
        ));
    }

    #[test]
    fn excluded_key_is_absent_for_other_keys() {
        assert!(check(&[("A", &["exclude"], "1"), ("B", &["required_if:A,1"], "")]).is_ok());
        assert!(
            check(&[
                ("A", &["exclude"], "yes"),
                ("B", &["required_if_accepted:A"], "")
            ])
            .is_ok()
        );
        assert!(fails_on(
            check(&[("A", &[], "1"), ("B", &["required_if:A,1"], "")]),
            "B"
        ));
    }

    // resolve_hidden_references
    #[test]
    fn resolve_returns_only_visible_keys() {
        let resolved = resolve(
            &[("V", &["required"], ""), ("H", &["required"], "")],
            &["V"],
        )
        .unwrap();

        assert_eq!(resolved.len(), 1);
        assert_eq!(resolved["V"], strings(&["required"]));
    }

    #[test]
    fn resolve_drops_keys_excluded_by_hidden_references() {
        let resolved = resolve(
            &[
                ("V1", &["exclude_if:H,1", "required"], ""),
                ("V2", &["exclude_unless:MISSING,1"], ""),
                ("V3", &["exclude_if:EXCLUDED,zzz"], ""),
                ("H", &[], "1"),
                ("EXCLUDED", &["exclude"], ""),
            ],
            &["V1", "V2", "V3"],
        )
        .unwrap();

        assert_eq!(resolved["V1"], None);
        assert_eq!(resolved["V2"], None);
        assert_eq!(resolved["V3"], None);
    }

    #[test]
    fn resolve_strips_only_non_firing_hidden_exclusions() {
        let resolved = resolve(
            &[
                (
                    "V",
                    &[
                        "required",
                        "exclude_if:H,1",
                        "exclude",
                        "exclude_if:W,1",
                        "exclude_with:H2",
                        "required_if:H,0",
                        "min:2",
                    ],
                    "",
                ),
                ("W", &[], "1"),
                ("H", &[], "0"),
            ],
            &["V", "W"],
        )
        .unwrap();

        assert_eq!(
            resolved["V"],
            strings(&[
                "required",
                "exclude",
                "exclude_if:W,1",
                "required_if:H,0",
                "min:2"
            ])
        );
        assert_eq!(resolved["W"], strings(&[]));
    }

    #[test]
    fn resolve_propagates_drops_through_visible_references() {
        let resolved = resolve(
            &[
                ("H", &[], "1"),
                ("V1", &["exclude_if:H,1"], ""),
                ("V2", &["exclude_if:V1,zzz"], ""),
                ("V3", &["required", "exclude_if:V2,zzz"], ""),
                ("V4", &["exclude"], ""),
                ("V5", &["exclude_if:V4,zzz"], ""),
            ],
            &["V1", "V2", "V3", "V4", "V5"],
        )
        .unwrap();

        assert_eq!(resolved["V1"], None);
        assert_eq!(resolved["V2"], None);
        assert_eq!(resolved["V3"], None);
        assert_eq!(resolved["V4"], strings(&["exclude"]));
        assert_eq!(resolved["V5"], strings(&["exclude_if:V4,zzz"]));
    }

    #[test]
    fn resolve_rejects_invalid_rules() {
        assert!(resolve(&[("V", &["definitely_not_a_rule"], "")], &["V"]).is_err());
        assert!(resolve(&[("H", &["exclude_with"], "")], &["V"]).is_err());
    }

    fn sample_args(definition: &RuleDefinition) -> Vec<CompactString> {
        let args: &[&str] = match definition.arguments {
            RuleArguments::None => &[],
            RuleArguments::Flag(flag) => &[flag],
            RuleArguments::Number => &["5"],
            RuleArguments::NumberRange => &["1", "5"],
            RuleArguments::Version => &["4"],
            RuleArguments::Field => &["OTHER"],
            RuleArguments::Fields => &["A", "B"],
            RuleArguments::FieldValues => &["OTHER", "x"],
            RuleArguments::Values if definition.name == "url" => &["http", "https"],
            RuleArguments::Values => &["a", "b"],
            RuleArguments::Pattern => &["/^a$/"],
            RuleArguments::Formats => &["Y-m-d"],
        };

        args.iter().map(|a| CompactString::from(*a)).collect()
    }

    fn rule_string(name: &str, args: &[CompactString]) -> CompactString {
        if args.is_empty() {
            CompactString::from(name)
        } else {
            compact_str::format_compact!("{name}:{}", args.join(","))
        }
    }

    // RULES
    #[test]
    fn rules_names_and_aliases_are_unique() {
        let mut seen = HashSet::new();

        for definition in RULES {
            for name in std::iter::once(&definition.name).chain(definition.aliases) {
                assert!(seen.insert(*name), "{name} is declared twice");
            }
        }
    }

    #[test]
    fn rules_parse_sample_arguments_and_match_definition() {
        for definition in RULES {
            let args = sample_args(definition);
            let rule = rule_string(definition.name, &args);

            assert!(
                validate_rules(std::slice::from_ref(&rule), &()).is_ok(),
                "{rule} should parse"
            );

            let parsed = (definition.parse)(&args).unwrap_or_else(|e| panic!("{rule}: {e}"));
            assert_eq!(parsed.is_implicit(), definition.implicit, "{rule}");
            assert_eq!(parsed.label(), definition.name, "{rule}");
        }
    }

    #[test]
    fn rules_argument_requirement_matches_definition() {
        for definition in RULES {
            let parsed = validate_rules(&[CompactString::from(definition.name)], &());

            if definition.optional_arguments || matches!(definition.arguments, RuleArguments::None)
            {
                assert!(parsed.is_ok(), "{} should parse bare", definition.name);
            } else {
                assert!(parsed.is_err(), "{} should need arguments", definition.name);
            }
        }
    }

    #[test]
    fn rules_aliases_parse_and_map_to_canonical() {
        for definition in RULES {
            let args = sample_args(definition);

            for alias in definition.aliases {
                let rule = rule_string(alias, &args);
                assert!(
                    validate_rules(std::slice::from_ref(&rule), &()).is_ok(),
                    "{rule} should parse"
                );
            }
        }

        for (alias, name) in [("int", "integer"), ("num", "numeric"), ("str", "string")] {
            let definition = RULES
                .iter()
                .find(|d| d.aliases.contains(&alias))
                .unwrap_or_else(|| panic!("{alias} is not an alias"));
            assert_eq!(definition.name, name);
        }
    }

    // Validator::validate_all
    fn validate_all(vars: &Vars) -> Vec<(String, String)> {
        with_validator(vars, |v| {
            v.validate_all()
                .into_iter()
                .map(|(key, message)| (key.to_string(), message.to_string()))
                .collect()
        })
        .expect("rules should parse")
    }

    fn message(vars: &Vars, key: &str) -> String {
        validate_all(vars)
            .into_iter()
            .find(|(k, _)| k == key)
            .map(|(_, m)| m)
            .unwrap_or_else(|| panic!("{key} should fail"))
    }

    #[test]
    fn validate_all_empty_when_everything_passes() {
        assert!(validate_all(&[]).is_empty());
        assert!(
            validate_all(&[("A", &["required", "integer"], "5"), ("B", &["min:5"], "")]).is_empty()
        );
    }

    #[test]
    fn validate_all_reports_every_failing_key_sorted() {
        let result = validate_all(&[
            ("C", &["integer"], "abc"),
            ("A", &["required"], ""),
            ("B", &["integer"], "5"),
            ("D", &["max:2"], "abcd"),
        ]);

        let keys: Vec<&str> = result.iter().map(|(k, _)| k.as_str()).collect();
        assert_eq!(keys, ["A", "C", "D"]);
    }

    #[test]
    fn validate_all_reports_first_failing_rule_in_declared_order() {
        let integer = message(&[("A", &["integer"], "ab")], "A");
        let min = message(&[("A", &["min:5"], "ab")], "A");
        assert_ne!(integer, min);

        assert_eq!(message(&[("A", &["integer", "min:5"], "ab")], "A"), integer);
        assert_eq!(message(&[("A", &["min:5", "integer"], "ab")], "A"), min);
    }

    #[test]
    fn validate_all_applies_blank_and_nullable_skips() {
        assert!(validate_all(&[("A", &["min:5", "integer"], "  ")]).is_empty());
        assert!(validate_all(&[("A", &["integer", "nullable"], "null")]).is_empty());
        assert!(validate_all(&[("A", &["integer", "nullable"], "")]).is_empty());
        assert_eq!(
            validate_all(&[("A", &["required", "integer"], "  ")]).len(),
            1
        );
    }

    #[test]
    fn validate_all_omits_excluded_keys() {
        let token: &[&str] = &["exclude_unless:GITHUB,1", "required"];

        assert!(validate_all(&[("GITHUB", &[], "0"), ("TOKEN", token, "")]).is_empty());
        assert!(validate_all(&[("A", &["exclude", "integer"], "abc")]).is_empty());

        let keys: Vec<String> = validate_all(&[("GITHUB", &[], "1"), ("TOKEN", token, "")])
            .into_iter()
            .map(|(k, _)| k)
            .collect();
        assert_eq!(keys, ["TOKEN"]);
    }

    #[test]
    fn validate_all_agrees_with_validate() {
        let cases: &[&Vars] = &[
            &[("A", &["integer"], "1"), ("B", &["required"], "x")],
            &[("A", &["integer"], "abc")],
            &[("B", &["required"], ""), ("A", &["integer"], "x")],
            &[("A", &["exclude"], ""), ("B", &["required_if:A,1"], "")],
            &[("A", &[], "1"), ("B", &["required_if:A,1"], "")],
        ];

        for vars in cases {
            let all = validate_all(vars);

            match check(vars) {
                Ok(()) => assert!(all.is_empty(), "{all:?}"),
                Err(error) => {
                    let (key, msg) = error.split_once(": ").expect("KEY: msg");
                    assert!(
                        all.iter().any(|(k, m)| k == key && m == msg),
                        "{error} not in {all:?}"
                    );
                }
            }
        }
    }
}
