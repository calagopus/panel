use std::collections::HashMap;

mod rules;

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

pub struct Validator<'a> {
    pub rules: HashMap<&'a str, Vec<Box<dyn ValidateRule>>>,
    pub data: HashMap<&'a str, &'a str>,
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

        Ok(Self {
            rules,
            data: data.iter().map(|(k, (_, v))| (*k, *v)).collect(),
        })
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

    // Mirrors Laravel's Validator::isValidatable, position-independently:
    // https://github.com/laravel/framework/blob/6291d28a53dbf5b768df0d0a009fcc636a1e5e65/src/Illuminate/Validation/Validator.php#L813
    //
    // All values here are strings, so the literal "null" (and "") stands in for
    // PHP null when deciding whether `nullable` skips the field.
    pub fn validate(&self) -> Result<(), String> {
        for (key, rules) in &self.rules {
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

                if let Err(err) = rule.validate(key, self) {
                    return Err(format!("{key}: {err}"));
                }
            }
        }

        Ok(())
    }

    pub fn into_data(self) -> HashMap<&'a str, &'a str> {
        self.data
    }
}

pub trait ValidateRule: Send + Sync {
    fn label(&self) -> &'static str;

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
