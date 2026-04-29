use std::{
    borrow::Cow,
    sync::{Arc, RwLock, RwLockReadGuard},
};

pub struct EmailTemplate {
    pub identifier: &'static str,
    pub available_variables: Vec<&'static str>,
    pub default_content: &'static str,
}

impl EmailTemplate {
    pub async fn get_content(
        &self,
        state: &crate::State,
    ) -> Result<Cow<'static, str>, anyhow::Error> {
        let db_content: Option<String> = state
            .cache
            .cached(
                &format!("email_templates::{}", self.identifier),
                15,
                || async {
                    sqlx::query_scalar("SELECT content FROM email_templates WHERE identifier = $1")
                        .bind(self.identifier)
                        .fetch_optional(state.database.read())
                        .await
                },
            )
            .await?;

        Ok(match db_content {
            Some(content) => Cow::Owned(content),
            None => Cow::Borrowed(self.default_content),
        })
    }

    pub async fn set_content(
        &self,
        state: &crate::State,
        content: &str,
    ) -> Result<(), anyhow::Error> {
        sqlx::query(
            "INSERT INTO email_templates (identifier, content) VALUES ($1, $2)
            ON CONFLICT (identifier) DO UPDATE SET content = EXCLUDED.content",
        )
        .bind(self.identifier)
        .bind(content)
        .execute(state.database.write())
        .await?;

        state
            .cache
            .invalidate(&format!("email_templates::{}", self.identifier))
            .await?;

        Ok(())
    }

    pub async fn reset_content(&self, state: &crate::State) -> Result<(), anyhow::Error> {
        sqlx::query("DELETE FROM email_templates WHERE identifier = $1")
            .bind(self.identifier)
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
                    default_content: include_str!("../../mails/account_created.html"),
                },
                EmailTemplate {
                    identifier: "password_reset",
                    available_variables: vec!["user", "reset_link"],
                    default_content: include_str!("../../mails/password_reset.html"),
                },
                EmailTemplate {
                    identifier: "connection_test",
                    available_variables: vec![],
                    default_content: include_str!("../../mails/connection_test.html"),
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
    pub(super) templates: RwLock<Vec<Arc<EmailTemplate>>>,
}

impl Default for EmailTemplateManager {
    fn default() -> Self {
        Self {
            templates: RwLock::new(vec![]),
        }
    }
}

impl EmailTemplateManager {
    pub fn get_templates(&self) -> RwLockReadGuard<'_, Vec<Arc<EmailTemplate>>> {
        self.templates.read().unwrap()
    }

    pub fn get_template(&self, identifier: &str) -> Result<Arc<EmailTemplate>, anyhow::Error> {
        self.templates
            .read()
            .unwrap()
            .iter()
            .find(|t| t.identifier == identifier)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("template with identifier '{}' not found", identifier))
    }
}
