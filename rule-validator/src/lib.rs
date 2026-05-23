//! Laravel-style validation rules for game-server startup environment
//! variables ("egg" variables). Rule names follow Laravel 13.x conventions;
//! inputs from Pterodactyl (Laravel 10.x) and Pelican (Laravel 13.x) panels
//! are both supported. See <https://laravel.com/docs/12.x/validation> for the
//! upstream rule reference.
//!
//! Two entry points: [`validate_rules`] checks that a slice of rule strings
//! parses without error (used as a `garde` custom validator on egg-variable
//! definitions), while [`Validator::new`] + [`Validator::validate`] runs the
//! full rule set against actual data.

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

    pub fn validate(&self) -> Result<(), String> {
        for (key, rules) in &self.rules {
            for rule in rules {
                match rule.validate(key, self) {
                    Ok(abort_early) => {
                        if abort_early {
                            break;
                        }
                    }
                    Err(err) => return Err(format!("{key}: {err}")),
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

    fn validate(
        &self,
        key: &str,
        validator: &Validator,
    ) -> Result<bool, compact_str::CompactString>;
}

pub trait ParseValidationRule: Send + Sync {
    fn parse_rule(
        rules: &[compact_str::CompactString],
    ) -> Result<Box<dyn ValidateRule>, compact_str::CompactString>;
}
