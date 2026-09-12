use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::{borrow::Cow, collections::BTreeMap, sync::Arc};
use utoipa::ToSchema;

mod variables;
pub use variables::*;

pub struct EmailTemplate {
    pub identifier: &'static str,
    pub available_variables: Vec<&'static str>,
    pub default_subject: &'static str,
    pub default_content: &'static str,
    pub default_enabled: bool,
}

#[derive(ToSchema, Validate, Serialize, Deserialize)]
pub struct UpdateEmailTemplate {
    #[garde(length(chars, min = 1))]
    #[schema(min_length = 1)]
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub content: Option<Option<String>>,
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub subject: Option<Option<String>>,
    #[garde(skip)]
    pub enabled: Option<bool>,
}

pub struct FetchedEmailTemplate {
    pub identifier: &'static str,
    pub available_variables: Vec<&'static str>,
    pub subject: Cow<'static, str>,
    pub content: Cow<'static, str>,
    pub enabled: bool,
}

impl EmailTemplate {
    pub async fn get(&self, state: &crate::State) -> Result<FetchedEmailTemplate, anyhow::Error> {
        let db_content: Option<(bool, String, String)> = state
            .cache
            .cached(
                &format!("email_templates::{}", self.identifier),
                15,
                || async {
                    let Some(row) = sqlx::query("SELECT enabled, subject, content FROM email_templates WHERE identifier = $1")
                        .bind(self.identifier)
                        .fetch_optional(state.database.read())
                        .await? else {
                            return Ok(None);
                        };

                    Ok::<_, anyhow::Error>(Some((
                        row.try_get("enabled")?,
                        row.try_get("subject")?,
                        row.try_get("content")?,
                    )))
                },
            )
            .await?;

        Ok(match db_content {
            Some((enabled, subject, content)) => FetchedEmailTemplate {
                identifier: self.identifier,
                available_variables: self.available_variables.clone(),
                subject: Cow::Owned(subject),
                content: Cow::Owned(content),
                enabled,
            },
            None => FetchedEmailTemplate {
                identifier: self.identifier,
                available_variables: self.available_variables.clone(),
                subject: Cow::Borrowed(self.default_subject),
                content: Cow::Borrowed(self.default_content),
                enabled: self.default_enabled,
            },
        })
    }

    pub async fn update(
        &self,
        state: &crate::State,
        data: UpdateEmailTemplate,
    ) -> Result<(), anyhow::Error> {
        let (subject_set, subject_val) = match data.subject {
            None => (false, None),
            Some(inner) => (true, inner),
        };
        let (content_set, content_val) = match data.content {
            None => (false, None),
            Some(inner) => (true, inner),
        };

        let insert_subject = subject_val
            .clone()
            .unwrap_or_else(|| self.default_subject.to_string());
        let insert_content = content_val
            .clone()
            .unwrap_or_else(|| self.default_content.to_string());
        let insert_enabled = data.enabled.unwrap_or(self.default_enabled);

        sqlx::query(
            "INSERT INTO email_templates (identifier, subject, content, enabled)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (identifier) DO UPDATE SET
                subject = CASE
                    WHEN $5 THEN COALESCE($6, $7)
                    ELSE email_templates.subject
                END,
                content = CASE
                    WHEN $8 THEN COALESCE($9, $10)
                    ELSE email_templates.content
                END,
                enabled = COALESCE($11, email_templates.enabled)",
        )
        .bind(self.identifier)
        .bind(&insert_subject)
        .bind(&insert_content)
        .bind(insert_enabled)
        .bind(subject_set)
        .bind(subject_val.as_deref())
        .bind(self.default_subject)
        .bind(content_set)
        .bind(content_val.as_deref())
        .bind(self.default_content)
        .bind(data.enabled)
        .execute(state.database.write())
        .await?;

        state
            .cache
            .invalidate(&format!("email_templates::{}", self.identifier))
            .await?;

        Ok(())
    }
}

pub struct ExtensionEmailTemplateBuilder {
    pub templates: Vec<EmailTemplate>,
    pub variables: Vec<EmailVariable>,
}

impl Default for ExtensionEmailTemplateBuilder {
    fn default() -> Self {
        Self {
            templates: vec![
                EmailTemplate {
                    identifier: "account_created",
                    available_variables: vec!["user", "reset_link"],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/account_created.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "password_reset",
                    available_variables: vec!["user", "reset_link"],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/password_reset.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "email_verification",
                    available_variables: vec!["user", "email", "verification_link"],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/email_verification.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "two_factor_code",
                    available_variables: vec!["user", "code"],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/two_factor_code.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "session_created",
                    available_variables: vec!["user", "ip", "user_agent", "sessions_link"],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/session_created.html"),
                    default_enabled: false,
                },
                EmailTemplate {
                    identifier: "connection_test",
                    available_variables: vec![],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/connection_test.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "added_to_server",
                    available_variables: vec!["user", "server", "server_link"],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/added_to_server.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "removed_from_server",
                    available_variables: vec!["server"],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/removed_from_server.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "server_installed",
                    available_variables: vec!["user", "server", "server_link"],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/server_installed.html"),
                    default_enabled: false,
                },
                EmailTemplate {
                    identifier: "server_restored",
                    available_variables: vec!["user", "server", "server_link"],
                    default_subject: "{{ settings.app.name }} - {{ vars.subject }}",
                    default_content: include_str!("../../../mails/server_restored.html"),
                    default_enabled: false,
                },
            ],
            variables: core_variables(),
        }
    }
}

impl ExtensionEmailTemplateBuilder {
    /// Add a new email template to the system, this will not override any existing templates, if you want to override an existing template, use `mutate_template` instead
    pub fn add_template(mut self, template: EmailTemplate) -> Self {
        if self
            .templates
            .iter()
            .all(|t| t.identifier != template.identifier)
        {
            self.templates.push(template);
        }

        self
    }

    /// Mutate an existing template, useful for changing the default content, should not extend the variables, as the caller will not be
    /// aware of the new variables and thus will not be able to use them, if you need to add variables, consider adding a new template instead
    pub fn mutate_template(
        mut self,
        identifier: &'static str,
        mutation: impl FnOnce(&mut EmailTemplate),
    ) -> Self {
        if let Some(template) = self
            .templates
            .iter_mut()
            .find(|t| t.identifier == identifier)
        {
            mutation(template);
        }

        self
    }

    /// Declare a system variable with its English default, available to the given template as `{{ vars.<name> }}`
    /// (or to every template when `template_identifier` is `None`). Existing variables are left untouched.
    pub fn add_template_variable(
        mut self,
        template_identifier: Option<&'static str>,
        name: &'static str,
        default_value: &'static str,
    ) -> Self {
        if let Err(err) = validate_variable_name(&name.into(), &()) {
            tracing::error!("ignoring email variable '{}': {}", name, err);
            return self;
        }

        if self
            .variables
            .iter()
            .all(|v| !v.matches(template_identifier, name))
        {
            self.variables.push(EmailVariable {
                template_identifier: template_identifier.map(Into::into),
                name: name.into(),
                default_value: default_value.to_string(),
                default_translations: BTreeMap::new(),
            });
        }

        self
    }

    /// Declare variables and their translations from an embedded directory of `<language>.json` files,
    /// the same layout the panel uses for its own templates: `en.json` holds
    /// `{ "<template identifier>": { "<name>": "<fragment>" } }`, every other file the translations.
    pub fn add_template_variables(mut self, directory: &include_dir::Dir<'_>) -> Self {
        load_variables(directory, &mut self.variables);

        self
    }

    /// Ship a translated default for a variable declared with `add_template_variable`.
    pub fn add_template_variable_translation(
        mut self,
        template_identifier: Option<&'static str>,
        name: &'static str,
        language: &'static str,
        value: &'static str,
    ) -> Self {
        if let Some(variable) = self
            .variables
            .iter_mut()
            .find(|v| v.matches(template_identifier, name))
        {
            variable
                .default_translations
                .insert(language.into(), value.to_string());
        }

        self
    }

    /// Mutate an existing variable, useful for changing the default wording of a core template without replacing its layout.
    pub fn mutate_template_variable(
        mut self,
        template_identifier: Option<&'static str>,
        name: &'static str,
        mutation: impl FnOnce(&mut EmailVariable),
    ) -> Self {
        if let Some(variable) = self
            .variables
            .iter_mut()
            .find(|v| v.matches(template_identifier, name))
        {
            mutation(variable);
        }

        self
    }

    pub(super) fn finish(mut self) -> (Vec<Arc<EmailTemplate>>, Vec<Arc<EmailVariable>>) {
        for template in &mut self.templates {
            for global in ["settings", "language"] {
                if !template.available_variables.contains(&global) {
                    template.available_variables.push(global);
                }
            }
        }

        (
            self.templates.into_iter().map(Arc::new).collect(),
            self.variables.into_iter().map(Arc::new).collect(),
        )
    }
}

pub struct EmailTemplateManager {
    pub(super) templates: parking_lot::RwLock<Vec<Arc<EmailTemplate>>>,
    pub(super) variables: parking_lot::RwLock<Vec<Arc<EmailVariable>>>,
}

impl Default for EmailTemplateManager {
    fn default() -> Self {
        Self {
            templates: parking_lot::RwLock::new(vec![]),
            variables: parking_lot::RwLock::new(vec![]),
        }
    }
}

impl EmailTemplateManager {
    pub fn get_templates(&self) -> parking_lot::RwLockReadGuard<'_, Vec<Arc<EmailTemplate>>> {
        self.templates.read()
    }

    pub fn get_template(&self, identifier: &str) -> Result<Arc<EmailTemplate>, anyhow::Error> {
        self.templates
            .read()
            .iter()
            .find(|t| t.identifier == identifier)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("template with identifier '{}' not found", identifier))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_context() -> minijinja::Value {
        minijinja::context! {
            user => serde_json::json!({ "username": "tester", "email": "tester@example.com" }),
            server => serde_json::json!({ "name": "Example Server" }),
            email => "tester@example.com",
            reset_link => "https://panel.example.com/auth/reset-password?token=x",
            verification_link => "https://panel.example.com/auth/verify-email?token=x",
            sessions_link => "https://panel.example.com/account/sessions",
            server_link => "https://panel.example.com/server/00000001",
            code => "123456",
            ip => "127.0.0.1",
            user_agent => "test-agent",
        }
    }

    fn strict_environment(
        variables: &BTreeMap<compact_str::CompactString, String>,
    ) -> minijinja::Environment<'static> {
        let mut environment = minijinja::Environment::new();
        environment.set_undefined_behavior(minijinja::UndefinedBehavior::Strict);
        environment.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);
        environment.add_global(
            "settings",
            minijinja::Value::from_serialize(serde_json::json!({
                "app": { "name": "Panel & Co", "url": "https://panel.example.com" }
            })),
        );
        environment.add_global("language", "en");
        environment.add_global("subject", "Subject");
        environment.add_global("vars", minijinja::Value::from_serialize(variables));

        environment
    }

    #[test]
    fn stock_templates_render_against_english_defaults() {
        let builder = ExtensionEmailTemplateBuilder::default();
        let context = fixture_context();

        for template in &builder.templates {
            let variables: BTreeMap<compact_str::CompactString, String> = builder
                .variables
                .iter()
                .filter(|v| v.template_identifier.as_deref() == Some(template.identifier))
                .map(|v| (v.name.clone(), v.default_value.clone()))
                .collect();
            assert!(
                variables.contains_key("subject"),
                "{} has no subject variable",
                template.identifier
            );

            let environment = strict_environment(&variables);
            for (name, value) in &variables {
                environment
                    .render_str(value, &context)
                    .unwrap_or_else(|err| {
                        panic!("{}.{name} failed to render: {err}", template.identifier)
                    });
            }
            environment
                .render_str(template.default_subject, &context)
                .unwrap_or_else(|err| {
                    panic!("{} subject failed to render: {err}", template.identifier)
                });
            environment
                .render_str(template.default_content, &context)
                .unwrap_or_else(|err| {
                    panic!("{} content failed to render: {err}", template.identifier)
                });
        }
    }
}
