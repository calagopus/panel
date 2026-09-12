use super::EmailTemplateManager;
use crate::prelude::*;
use garde::Validate;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::BTreeMap;
use utoipa::ToSchema;

const VARIABLES_DIR: include_dir::Dir<'_> =
    include_dir::include_dir!("$CARGO_MANIFEST_DIR/mails/variables");

pub fn validate_variable_name(
    name: &compact_str::CompactString,
    _context: &(),
) -> Result<(), garde::Error> {
    let mut chars = name.chars();

    let valid = matches!(chars.next(), Some('a'..='z'))
        && chars.all(|c| matches!(c, 'a'..='z' | '0'..='9' | '_'))
        && name.len() <= 64;

    if !valid {
        return Err(garde::Error::new(
            "variable name must start with a lowercase letter and only contain lowercase letters, digits and underscores (max 64 characters)",
        ));
    }

    Ok(())
}

pub fn validate_variable_translations(
    translations: &BTreeMap<compact_str::CompactString, String>,
    _context: &(),
) -> Result<(), garde::Error> {
    for (language, value) in translations {
        crate::utils::validate_language(language, &())?;

        if value.is_empty() || value.len() > 8192 {
            return Err(garde::Error::new(format!(
                "translation for language '{language}' must be between 1 and 8192 characters"
            )));
        }
    }

    Ok(())
}

pub struct EmailVariable {
    pub template_identifier: Option<compact_str::CompactString>,
    pub name: compact_str::CompactString,
    pub default_value: String,
    pub default_translations: BTreeMap<compact_str::CompactString, String>,
}

impl EmailVariable {
    pub(super) fn matches(&self, template_identifier: Option<&str>, name: &str) -> bool {
        self.template_identifier.as_deref() == template_identifier && self.name == name
    }
}

#[derive(ToSchema, Validate, Deserialize)]
pub struct CreateEmailVariable {
    #[garde(custom(validate_variable_name))]
    #[schema(pattern = "^[a-z][a-z0-9_]{0,63}$", max_length = 64)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 8192))]
    #[schema(min_length = 1, max_length = 8192)]
    pub value: String,
    #[garde(custom(validate_variable_translations))]
    #[serde(default)]
    pub value_translations: BTreeMap<compact_str::CompactString, String>,
}

#[derive(ToSchema, Validate, Deserialize)]
pub struct UpdateEmailVariable {
    #[garde(length(chars, min = 1, max = 8192))]
    #[schema(min_length = 1, max_length = 8192)]
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub value: Option<Option<String>>,
    #[garde(inner(custom(validate_variable_translations)))]
    pub value_translations: Option<BTreeMap<compact_str::CompactString, String>>,
}

#[derive(Serialize, Deserialize)]
struct EmailVariableRow {
    name: compact_str::CompactString,
    value: Option<String>,
    value_translations: BTreeMap<compact_str::CompactString, String>,
}

pub struct FetchedEmailVariable {
    pub template_identifier: Option<compact_str::CompactString>,
    pub name: compact_str::CompactString,
    pub default_value: Option<String>,
    pub default_translations: BTreeMap<compact_str::CompactString, String>,
    pub value: Option<String>,
    pub value_translations: BTreeMap<compact_str::CompactString, String>,
}

#[schema_extension_derive::extendible]
#[init_args(FetchedEmailVariable, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "EmailVariable")]
pub struct AdminApiEmailVariable {
    pub template_identifier: Option<compact_str::CompactString>,
    pub name: compact_str::CompactString,
    pub system: bool,
    pub default_value: Option<String>,
    pub default_translations: BTreeMap<compact_str::CompactString, String>,
    pub value: Option<String>,
    pub value_translations: BTreeMap<compact_str::CompactString, String>,
}

impl FetchedEmailVariable {
    pub fn is_system(&self) -> bool {
        self.default_value.is_some()
    }


    pub fn resolve(&self, language: &str) -> &str {
        self.value_translations
            .get(language)
            .map(String::as_str)
            .or(self.value.as_deref())
            .or_else(|| self.default_translations.get(language).map(String::as_str))
            .or(self.default_value.as_deref())
            .unwrap_or_default()
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for FetchedEmailVariable {
    type AdminApiObject = AdminApiEmailVariable;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiEmailVariable::init_hooks(&self, state).await?;
        let system = self.is_system();

        let api_object = finish_extendible!(
            AdminApiEmailVariable {
                template_identifier: self.template_identifier,
                name: self.name,
                system,
                default_value: self.default_value,
                default_translations: self.default_translations,
                value: self.value,
                value_translations: self.value_translations,
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

type VariablesFile =
    IndexMap<compact_str::CompactString, IndexMap<compact_str::CompactString, String>>;

pub(super) fn load_variables(directory: &include_dir::Dir<'_>, variables: &mut Vec<EmailVariable>) {
    let mut files: Vec<_> = directory.files().collect();
    files.sort_by_key(|file| file.path().file_stem() != Some(std::ffi::OsStr::new("en")));

    for file in files {
        let Some(language) = file.path().file_stem().and_then(|s| s.to_str()) else {
            continue;
        };

        let entries: VariablesFile = match serde_json::from_slice(file.contents()) {
            Ok(entries) => entries,
            Err(err) => {
                tracing::error!(
                    "failed to parse email variables file '{}': {:#?}",
                    file.path().display(),
                    err
                );
                continue;
            }
        };

        for (template_identifier, entries) in entries {
            for (name, value) in entries {
                if let Some(variable) = variables
                    .iter_mut()
                    .find(|v| v.matches(Some(&template_identifier), &name))
                {
                    if language != "en" {
                        variable.default_translations.insert(language.into(), value);
                    }
                } else if language == "en" {
                    if let Err(err) = validate_variable_name(&name, &()) {
                        tracing::error!(
                            "ignoring email variable '{}.{}': {}",
                            template_identifier,
                            name,
                            err
                        );
                        continue;
                    }

                    variables.push(EmailVariable {
                        template_identifier: Some(template_identifier.clone()),
                        name,
                        default_value: value,
                        default_translations: BTreeMap::new(),
                    });
                } else {
                    tracing::warn!(
                        "email variable translation '{}.{}' in '{}' has no English definition",
                        template_identifier,
                        name,
                        file.path().display()
                    );
                }
            }
        }
    }
}

pub(super) fn core_variables() -> Vec<EmailVariable> {
    let mut variables = Vec::new();
    load_variables(&VARIABLES_DIR, &mut variables);
    variables
}

impl EmailTemplateManager {
    fn variables_cache_key(template_identifier: Option<&str>) -> String {
        format!(
            "email_variables::{}",
            template_identifier.unwrap_or_default()
        )
    }

    pub async fn get_variables(
        &self,
        state: &crate::State,
        template_identifier: Option<&str>,
    ) -> Result<Vec<FetchedEmailVariable>, anyhow::Error> {
        let rows: Vec<EmailVariableRow> = state
            .cache
            .cached(
                &Self::variables_cache_key(template_identifier),
                15,
                || async {
                    let rows = sqlx::query(
                        "SELECT name, value, value_translations FROM email_variables
                        WHERE template_identifier = $1
                        ORDER BY name",
                    )
                    .bind(template_identifier.unwrap_or_default())
                    .fetch_all(state.database.read())
                    .await?;

                    rows.into_iter()
                        .map(|row| {
                            Ok(EmailVariableRow {
                                name: row.try_get("name")?,
                                value: row.try_get("value")?,
                                value_translations: serde_json::from_value(
                                    row.try_get("value_translations")?,
                                )?,
                            })
                        })
                        .collect::<Result<Vec<_>, anyhow::Error>>()
                },
            )
            .await?;

        let mut rows: BTreeMap<compact_str::CompactString, EmailVariableRow> = rows
            .into_iter()
            .map(|row| (row.name.clone(), row))
            .collect();

        let mut variables: Vec<FetchedEmailVariable> = self
            .variables
            .read()
            .iter()
            .filter(|v| v.template_identifier.as_deref() == template_identifier)
            .map(|definition| {
                let (value, value_translations) = rows
                    .remove(&definition.name)
                    .map(|row| (row.value, row.value_translations))
                    .unwrap_or_default();

                FetchedEmailVariable {
                    template_identifier: definition.template_identifier.clone(),
                    name: definition.name.clone(),
                    default_value: Some(definition.default_value.clone()),
                    default_translations: definition.default_translations.clone(),
                    value,
                    value_translations,
                }
            })
            .collect();

        for (name, row) in rows {
            variables.push(FetchedEmailVariable {
                template_identifier: template_identifier.map(Into::into),
                name,
                default_value: None,
                default_translations: BTreeMap::new(),
                value: row.value,
                value_translations: row.value_translations,
            });
        }

        Ok(variables)
    }

    pub async fn resolve_variables(
        &self,
        state: &crate::State,
        template_identifier: &str,
        language: &str,
    ) -> Result<BTreeMap<compact_str::CompactString, String>, anyhow::Error> {
        let mut resolved = BTreeMap::new();

        for variable in self
            .get_variables(state, None)
            .await?
            .into_iter()
            .chain(self.get_variables(state, Some(template_identifier)).await?)
        {
            let value = variable.resolve(language).to_string();
            resolved.insert(variable.name, value);
        }

        Ok(resolved)
    }

    pub async fn create_variable(
        &self,
        state: &crate::State,
        template_identifier: Option<&str>,
        data: CreateEmailVariable,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            "INSERT INTO email_variables (template_identifier, name, value, value_translations)
            VALUES ($1, $2, $3, $4)",
        )
        .bind(template_identifier.unwrap_or_default())
        .bind(&data.name)
        .bind(&data.value)
        .bind(serde_json::to_value(&data.value_translations)?)
        .execute(state.database.write())
        .await?;

        state
            .cache
            .invalidate(&Self::variables_cache_key(template_identifier))
            .await?;

        Ok(())
    }

    pub async fn update_variable(
        &self,
        state: &crate::State,
        variable: &FetchedEmailVariable,
        data: UpdateEmailVariable,
    ) -> Result<(), anyhow::Error> {
        let (value_set, value) = match data.value {
            None => (false, None),
            Some(inner) => (true, inner),
        };
        let value_translations = data
            .value_translations
            .as_ref()
            .map(serde_json::to_value)
            .transpose()?;

        sqlx::query(
            "INSERT INTO email_variables (template_identifier, name, value, value_translations)
            VALUES ($1, $2, $3, COALESCE($5, '{}'::jsonb))
            ON CONFLICT (template_identifier, name) DO UPDATE SET
                value = CASE
                    WHEN $4 THEN $3
                    ELSE email_variables.value
                END,
                value_translations = COALESCE($5, email_variables.value_translations)",
        )
        .bind(variable.template_identifier.as_deref().unwrap_or_default())
        .bind(&variable.name)
        .bind(value.as_deref())
        .bind(value_set)
        .bind(value_translations)
        .execute(state.database.write())
        .await?;

        if variable.is_system() {
            sqlx::query(
                "DELETE FROM email_variables
                WHERE template_identifier = $1 AND name = $2
                AND value IS NULL AND value_translations = '{}'::jsonb",
            )
            .bind(variable.template_identifier.as_deref().unwrap_or_default())
            .bind(&variable.name)
            .execute(state.database.write())
            .await?;
        }

        state
            .cache
            .invalidate(&Self::variables_cache_key(
                variable.template_identifier.as_deref(),
            ))
            .await?;

        Ok(())
    }

    pub async fn delete_variable(
        &self,
        state: &crate::State,
        variable: &FetchedEmailVariable,
    ) -> Result<(), anyhow::Error> {
        sqlx::query(
            "DELETE FROM email_variables
            WHERE template_identifier = $1 AND name = $2",
        )
        .bind(variable.template_identifier.as_deref().unwrap_or_default())
        .bind(&variable.name)
        .execute(state.database.write())
        .await?;

        state
            .cache
            .invalidate(&Self::variables_cache_key(
                variable.template_identifier.as_deref(),
            ))
            .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{super::ExtensionEmailTemplateBuilder, *};

    fn placeholders(value: &str) -> Vec<&str> {
        let mut found = Vec::new();
        let mut rest = value;

        while let Some(start) = rest.find("{{") {
            let Some(len) = rest[start..].find("}}") else {
                break;
            };
            found.push(rest[start..start + len + 2].trim());
            rest = &rest[start + len + 2..];
        }

        found.sort_unstable();
        found
    }

    fn variables_file(name: &str) -> VariablesFile {
        serde_json::from_slice(
            VARIABLES_DIR
                .get_file(name)
                .unwrap_or_else(|| panic!("{name} missing"))
                .contents(),
        )
        .unwrap_or_else(|err| panic!("{name} is invalid: {err}"))
    }

    #[test]
    fn translated_defaults_match_english_keys_and_placeholders() {
        let base = variables_file("en.json");

        for file in VARIABLES_DIR.files() {
            let name = file.path().file_name().unwrap().to_str().unwrap();
            if name == "en.json" {
                continue;
            }

            let translations = variables_file(name);
            for (template_identifier, entries) in &translations {
                for (variable, value) in entries {
                    let base_value = base
                        .get(template_identifier)
                        .and_then(|e| e.get(variable))
                        .unwrap_or_else(|| {
                            panic!("{name}: unknown variable '{template_identifier}.{variable}'")
                        });
                    assert_eq!(
                        placeholders(value),
                        placeholders(base_value),
                        "{name}: placeholder mismatch in '{template_identifier}.{variable}'"
                    );
                    assert!(
                        !value.is_empty(),
                        "{name}: '{template_identifier}.{variable}' is empty"
                    );
                }
            }
        }
    }

    #[test]
    fn directory_loading_matches_core_and_skips_unknown_translations() {
        let builder = ExtensionEmailTemplateBuilder {
            templates: vec![],
            variables: vec![],
        }
        .add_template_variables(&VARIABLES_DIR);
        let core = ExtensionEmailTemplateBuilder::default();

        assert_eq!(builder.variables.len(), core.variables.len());
        assert!(
            builder
                .variables
                .iter()
                .all(|v| v.default_translations.contains_key("de"))
        );

        let again = builder.add_template_variables(&VARIABLES_DIR);
        assert_eq!(again.variables.len(), core.variables.len());
    }

    #[test]
    fn extension_directory_adds_languages_to_its_own_and_core_variables() {
        const EN: &str = r#"{ "dev.example.welcome": { "subject": "Welcome", "Bad Name": "x" } }"#;
        const DE: &str = r#"{ "dev.example.welcome": { "subject": "Willkommen" }, "password_reset": { "subject": "Passwort neu" } }"#;
        const FR: &str = r#"{ "dev.example.welcome": { "subject": "Bienvenue", "unknown": "?" } }"#;
        const EXTENSION_DIR: include_dir::Dir<'_> = include_dir::Dir::new(
            "mails/variables",
            &[
                include_dir::DirEntry::File(include_dir::File::new(
                    "mails/variables/fr.json",
                    FR.as_bytes(),
                )),
                include_dir::DirEntry::File(include_dir::File::new(
                    "mails/variables/en.json",
                    EN.as_bytes(),
                )),
                include_dir::DirEntry::File(include_dir::File::new(
                    "mails/variables/de.json",
                    DE.as_bytes(),
                )),
            ],
        );

        let builder =
            ExtensionEmailTemplateBuilder::default().add_template_variables(&EXTENSION_DIR);

        let welcome = builder
            .variables
            .iter()
            .find(|v| v.matches(Some("dev.example.welcome"), "subject"))
            .expect("extension variable registered");
        assert_eq!(welcome.default_value, "Welcome");
        assert_eq!(
            welcome.default_translations.get("de").map(String::as_str),
            Some("Willkommen")
        );
        assert_eq!(
            welcome.default_translations.get("fr").map(String::as_str),
            Some("Bienvenue")
        );

        assert!(builder.variables.iter().all(|v| v.name != "Bad Name"));
        assert!(builder.variables.iter().all(|v| v.name != "unknown"));

        let core_subject = builder
            .variables
            .iter()
            .find(|v| v.matches(Some("password_reset"), "subject"))
            .unwrap();
        assert_eq!(
            core_subject
                .default_translations
                .get("de")
                .map(String::as_str),
            Some("Passwort neu")
        );
    }

    #[test]
    fn variable_names_are_validated() {
        for valid in ["subject", "ip_label", "a1", "footer_2"] {
            assert!(
                validate_variable_name(&valid.into(), &()).is_ok(),
                "{valid}"
            );
        }
        for invalid in [
            "",
            "Subject",
            "1abc",
            "with-dash",
            "with space",
            "_leading",
            "über",
        ] {
            assert!(
                validate_variable_name(&invalid.into(), &()).is_err(),
                "{invalid}"
            );
        }
    }

    #[test]
    fn resolution_prefers_operator_values_over_shipped_translations() {
        let variable = FetchedEmailVariable {
            template_identifier: None,
            name: "greeting".into(),
            default_value: Some("Hello".into()),
            default_translations: BTreeMap::from([("de".into(), "Hallo".into())]),
            value: None,
            value_translations: BTreeMap::new(),
        };
        assert_eq!(variable.resolve("de"), "Hallo");
        assert_eq!(variable.resolve("fr"), "Hello");

        let customised = FetchedEmailVariable {
            value: Some("Hi there".into()),
            ..variable
        };
        assert_eq!(customised.resolve("de"), "Hi there");

        let translated = FetchedEmailVariable {
            value_translations: BTreeMap::from([("de".into(), "Servus".into())]),
            ..customised
        };
        assert_eq!(translated.resolve("de"), "Servus");
        assert_eq!(translated.resolve("en"), "Hi there");
    }
}
