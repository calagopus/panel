use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::{borrow::Cow, sync::Arc};
use utoipa::ToSchema;

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
}

impl Default for ExtensionEmailTemplateBuilder {
    fn default() -> Self {
        Self {
            templates: vec![
                EmailTemplate {
                    identifier: "account_created",
                    available_variables: vec!["user", "reset_link"],
                    default_subject: "{{ settings.app.name }} - Account Created",
                    default_content: include_str!("../../mails/account_created.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "password_reset",
                    available_variables: vec!["user", "reset_link"],
                    default_subject: "{{ settings.app.name }} - Password Reset",
                    default_content: include_str!("../../mails/password_reset.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "connection_test",
                    available_variables: vec![],
                    default_subject: "{{ settings.app.name }} - Connection Test",
                    default_content: include_str!("../../mails/connection_test.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "added_to_server",
                    available_variables: vec!["server", "server_link"],
                    default_subject: "{{ settings.app.name }} - Added to Server",
                    default_content: include_str!("../../mails/added_to_server.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "removed_from_server",
                    available_variables: vec!["server"],
                    default_subject: "{{ settings.app.name }} - Removed from Server",
                    default_content: include_str!("../../mails/removed_from_server.html"),
                    default_enabled: true,
                },
                EmailTemplate {
                    identifier: "server_installed",
                    available_variables: vec!["server", "server_link"],
                    default_subject: "{{ settings.app.name }} - Server Installed",
                    default_content: include_str!("../../mails/server_installed.html"),
                    default_enabled: false,
                },
                EmailTemplate {
                    identifier: "server_restored",
                    available_variables: vec!["server", "server_link"],
                    default_subject: "{{ settings.app.name }} - Server Restored",
                    default_content: include_str!("../../mails/server_restored.html"),
                    default_enabled: false,
                },
            ],
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

    pub(super) fn finish(mut self) -> Vec<Arc<EmailTemplate>> {
        for template in &mut self.templates {
            if !template.available_variables.contains(&"settings") {
                template.available_variables.push("settings");
            }
        }

        self.templates.into_iter().map(Arc::new).collect()
    }
}

pub struct EmailTemplateManager {
    pub(super) templates: parking_lot::RwLock<Vec<Arc<EmailTemplate>>>,
}

impl Default for EmailTemplateManager {
    fn default() -> Self {
        Self {
            templates: parking_lot::RwLock::new(vec![]),
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
