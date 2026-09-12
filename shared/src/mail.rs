use crate::{models::user::User, settings::SettingsReadGuard};
use lettre::AsyncTransport;
use std::{collections::BTreeMap, sync::Arc};

#[derive(Debug)]
enum Transport {
    None,
    Smtp {
        transport: lettre::AsyncSmtpTransport<lettre::Tokio1Executor>,
        from_address: compact_str::CompactString,
        from_name: Option<compact_str::CompactString>,
    },
    Sendmail {
        transport: lettre::AsyncSendmailTransport<lettre::Tokio1Executor>,
        from_address: compact_str::CompactString,
        from_name: Option<compact_str::CompactString>,
    },
    Filesystem {
        transport: lettre::AsyncFileTransport<lettre::Tokio1Executor>,
        from_address: compact_str::CompactString,
        from_name: Option<compact_str::CompactString>,
    },
}

impl Transport {
    async fn deliver(
        self,
        destination: &str,
        subject: String,
        body: String,
    ) -> Result<(), anyhow::Error> {
        let message = move |from_address: &str,
                            from_name: Option<compact_str::CompactString>|
              -> Result<lettre::message::Message, anyhow::Error> {
            Ok(lettre::message::Message::builder()
                .subject(subject)
                .to(lettre::message::Mailbox::new(None, destination.parse()?))
                .from(lettre::message::Mailbox::new(
                    from_name.map(String::from),
                    from_address.parse()?,
                ))
                .header(lettre::message::header::ContentType::TEXT_HTML)
                .body(body)?)
        };

        match self {
            Transport::None => {}
            Transport::Smtp {
                transport,
                from_address,
                from_name,
            } => {
                transport.send(message(&from_address, from_name)?).await?;
            }
            Transport::Sendmail {
                transport,
                from_address,
                from_name,
            } => {
                transport.send(message(&from_address, from_name)?).await?;
            }
            Transport::Filesystem {
                transport,
                from_address,
                from_name,
            } => {
                transport.send(message(&from_address, from_name)?).await?;
            }
        }

        Ok(())
    }
}

pub struct MailRecipient {
    pub address: compact_str::CompactString,
    pub language: Option<compact_str::CompactString>,
}

impl MailRecipient {
    pub fn new(
        address: impl Into<compact_str::CompactString>,
        language: impl Into<compact_str::CompactString>,
    ) -> Self {
        Self {
            address: address.into(),
            language: Some(language.into()),
        }
    }
}

impl From<compact_str::CompactString> for MailRecipient {
    fn from(address: compact_str::CompactString) -> Self {
        Self {
            address,
            language: None,
        }
    }
}

impl From<&User> for MailRecipient {
    fn from(user: &User) -> Self {
        Self {
            address: user.email.clone(),
            language: Some(user.language.clone()),
        }
    }
}

struct RenderedMail {
    subject: String,
    body: String,
}

fn render_variables(
    environment: &mut minijinja::Environment<'_>,
    variables: &BTreeMap<compact_str::CompactString, String>,
    context: &minijinja::Value,
    html: bool,
) -> Result<(), anyhow::Error> {
    environment.add_global(
        "vars",
        minijinja::Value::from_object(BTreeMap::<minijinja::Value, minijinja::Value>::new()),
    );
    let first_pass = render_variables_pass(environment, variables, context, html)?;
    environment.add_global("vars", first_pass);

    let second_pass = render_variables_pass(environment, variables, context, html)?;
    environment.add_global("vars", second_pass);

    Ok(())
}

fn render_variables_pass(
    environment: &minijinja::Environment<'_>,
    variables: &BTreeMap<compact_str::CompactString, String>,
    context: &minijinja::Value,
    html: bool,
) -> Result<minijinja::Value, anyhow::Error> {
    let mut rendered = BTreeMap::new();

    for (name, source) in variables {
        let value = environment
            .render_str(source, context)
            .map_err(|err| anyhow::anyhow!("failed to render email variable '{name}': {err}"))?;

        rendered.insert(
            minijinja::Value::from(name.as_str()),
            if html {
                minijinja::Value::from_safe_string(value)
            } else {
                minijinja::Value::from(value)
            },
        );
    }

    Ok(minijinja::Value::from_object(rendered))
}

fn render(
    settings: &impl serde::Serialize,
    language: &str,
    variables: &BTreeMap<compact_str::CompactString, String>,
    subject: &str,
    body: &str,
    context: &minijinja::Value,
) -> Result<RenderedMail, anyhow::Error> {
    let settings = minijinja::Value::from_serialize(settings);

    let mut text_environment = minijinja::Environment::new();
    text_environment.add_global("settings", settings.clone());
    text_environment.add_global("language", language);
    render_variables(&mut text_environment, variables, context, false)?;

    let subject = text_environment.render_str(subject, context)?;

    let mut html_environment = minijinja::Environment::new();
    html_environment.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);
    html_environment.add_global("settings", settings);
    html_environment.add_global("language", language);
    html_environment.add_global("subject", subject.as_str());
    render_variables(&mut html_environment, variables, context, true)?;

    let body = html_environment.render_str(body, context)?;

    Ok(RenderedMail { subject, body })
}

pub struct Mail {
    settings: Arc<super::settings::Settings>,
    pub templates: Arc<super::extensions::email_templates::EmailTemplateManager>,
}

impl Mail {
    pub fn new(settings: Arc<super::settings::Settings>) -> Self {
        Self {
            settings,
            templates: Arc::new(
                super::extensions::email_templates::EmailTemplateManager::default(),
            ),
        }
    }

    async fn get_transport(&self) -> Result<(SettingsReadGuard<'_>, Transport), anyhow::Error> {
        let settings = self.settings.get().await?;

        let transport = match &settings.mail_mode {
            super::settings::MailMode::None => Transport::None,
            super::settings::MailMode::Smtp {
                host,
                port,
                username,
                password,
                tls_mode,
                skip_cert_validation,
                helo_domain,
                from_address,
                from_name,
            } => {
                let mut transport =
                    lettre::AsyncSmtpTransport::<lettre::Tokio1Executor>::builder_dangerous(
                        host.as_str(),
                    )
                    .port(*port)
                    .tls(match tls_mode {
                        super::settings::TlsMode::None => {
                            lettre::transport::smtp::client::Tls::None
                        }
                        super::settings::TlsMode::StartTls => {
                            lettre::transport::smtp::client::Tls::Required(
                                lettre::transport::smtp::client::TlsParametersBuilder::new(
                                    host.to_string(),
                                )
                                .dangerous_accept_invalid_certs(*skip_cert_validation)
                                .build_rustls()?,
                            )
                        }
                        super::settings::TlsMode::ImplicitTls => {
                            lettre::transport::smtp::client::Tls::Wrapper(
                                lettre::transport::smtp::client::TlsParametersBuilder::new(
                                    host.to_string(),
                                )
                                .dangerous_accept_invalid_certs(*skip_cert_validation)
                                .build_rustls()?,
                            )
                        }
                    });

                if let Some(helo_domain) = helo_domain {
                    transport = transport.hello_name(match helo_domain.parse() {
                        Ok(std::net::IpAddr::V4(ip)) => {
                            lettre::transport::smtp::extension::ClientId::Ipv4(ip)
                        }
                        Ok(std::net::IpAddr::V6(ip)) => {
                            lettre::transport::smtp::extension::ClientId::Ipv6(ip)
                        }
                        Err(_) => lettre::transport::smtp::extension::ClientId::Domain(
                            helo_domain.to_string(),
                        ),
                    });
                }

                if let Some(username) = username {
                    transport = transport.credentials(
                        lettre::transport::smtp::authentication::Credentials::new(
                            username.to_string(),
                            password.clone().unwrap_or_default().into(),
                        ),
                    );
                }

                Transport::Smtp {
                    transport: transport.build(),
                    from_address: from_address.clone(),
                    from_name: from_name.clone(),
                }
            }
            super::settings::MailMode::Sendmail {
                command,
                from_address,
                from_name,
            } => {
                let transport =
                    lettre::AsyncSendmailTransport::<lettre::Tokio1Executor>::new_with_command(
                        command,
                    );

                Transport::Sendmail {
                    transport,
                    from_address: from_address.clone(),
                    from_name: from_name.clone(),
                }
            }
            super::settings::MailMode::Filesystem {
                path,
                from_address,
                from_name,
            } => {
                let transport = lettre::AsyncFileTransport::<lettre::Tokio1Executor>::new(path);

                Transport::Filesystem {
                    transport,
                    from_address: from_address.clone(),
                    from_name: from_name.clone(),
                }
            }
        };

        Ok((settings, transport))
    }

    async fn language(
        &self,
        recipient: &MailRecipient,
    ) -> Result<compact_str::CompactString, anyhow::Error> {
        match &recipient.language {
            Some(language) => Ok(language.clone()),
            None => Ok(self.settings.get().await?.app.language.clone()),
        }
    }

    /// Sending a disabled template is a silent no-op, so flows that depend on the mail arriving
    /// must check this rather than trust the `Ok(())` from a send.
    pub async fn template_deliverable(
        &self,
        state: &crate::State,
        identifier: &str,
    ) -> Result<bool, anyhow::Error> {
        if matches!(
            self.settings.get().await?.mail_mode,
            super::settings::MailMode::None
        ) {
            return Ok(false);
        }

        Ok(self
            .templates
            .get_template(identifier)?
            .get(state)
            .await?
            .enabled)
    }

    pub async fn send_template_foreground(
        &self,
        state: &crate::State,
        identifier: &str,
        recipient: impl Into<MailRecipient>,
        context: minijinja::Value,
    ) -> Result<(), anyhow::Error> {
        let recipient = recipient.into();
        let template = self.templates.get_template(identifier)?;
        let fetched_template = template.get(state).await?;

        if !fetched_template.enabled {
            tracing::debug!(
                "email template '{}' is disabled, skipping sending email",
                identifier
            );
            return Ok(());
        }

        let language = self.language(&recipient).await?;
        let variables = self
            .templates
            .resolve_variables(state, identifier, &language)
            .await?;

        self.send_rendered_foreground(
            recipient,
            &language,
            &variables,
            &fetched_template.subject,
            &fetched_template.content,
            context,
        )
        .await
    }

    pub async fn send_template(
        &self,
        state: &crate::State,
        identifier: &str,
        recipient: impl Into<MailRecipient>,
        context: minijinja::Value,
    ) {
        let recipient = recipient.into();
        let template = match self.templates.get_template(identifier) {
            Ok(template) => template,
            Err(err) => {
                tracing::error!("failed to get email template: {:#?}", err);
                return;
            }
        };
        let fetched_template = match template.get(state).await {
            Ok(template) => template,
            Err(err) => {
                tracing::error!("failed to get email template content: {:#?}", err);
                return;
            }
        };

        if !fetched_template.enabled {
            tracing::debug!(
                "email template '{}' is disabled, skipping sending email",
                identifier
            );
            return;
        }

        let language = match self.language(&recipient).await {
            Ok(language) => language,
            Err(err) => {
                tracing::error!("failed to resolve email language: {:#?}", err);
                return;
            }
        };
        let variables = match self
            .templates
            .resolve_variables(state, identifier, &language)
            .await
        {
            Ok(variables) => variables,
            Err(err) => {
                tracing::error!("failed to resolve email variables: {:#?}", err);
                return;
            }
        };

        self.send_rendered(
            recipient,
            &language,
            &variables,
            &fetched_template.subject,
            &fetched_template.content,
            context,
        )
        .await
    }

    /// Sends a one-off mail that is not backed by a template, so no `vars` are available to it.
    pub async fn send_foreground(
        &self,
        recipient: impl Into<MailRecipient>,
        subject: impl AsRef<str>,
        body: impl AsRef<str>,
        context: minijinja::Value,
    ) -> Result<(), anyhow::Error> {
        let recipient = recipient.into();
        let language = self.language(&recipient).await?;

        self.send_rendered_foreground(
            recipient,
            &language,
            &BTreeMap::new(),
            subject.as_ref(),
            body.as_ref(),
            context,
        )
        .await
    }

    /// Sends a one-off mail that is not backed by a template, so no `vars` are available to it.
    pub async fn send(
        &self,
        recipient: impl Into<MailRecipient>,
        subject: impl AsRef<str>,
        body: impl AsRef<str>,
        context: minijinja::Value,
    ) {
        let recipient = recipient.into();
        let language = match self.language(&recipient).await {
            Ok(language) => language,
            Err(err) => {
                tracing::error!("failed to resolve email language: {:#?}", err);
                return;
            }
        };

        self.send_rendered(
            recipient,
            &language,
            &BTreeMap::new(),
            subject.as_ref(),
            body.as_ref(),
            context,
        )
        .await
    }

    async fn send_rendered_foreground(
        &self,
        recipient: MailRecipient,
        language: &str,
        variables: &BTreeMap<compact_str::CompactString, String>,
        subject: &str,
        body: &str,
        context: minijinja::Value,
    ) -> Result<(), anyhow::Error> {
        let (settings, transport) = self.get_transport().await?;
        let rendered = render(&*settings, language, variables, subject, body, &context)?;
        drop(settings);

        transport
            .deliver(&recipient.address, rendered.subject, rendered.body)
            .await
    }

    async fn send_rendered(
        &self,
        recipient: MailRecipient,
        language: &str,
        variables: &BTreeMap<compact_str::CompactString, String>,
        subject: &str,
        body: &str,
        context: minijinja::Value,
    ) {
        let (settings, transport) = match self.get_transport().await {
            Ok((settings, transport)) => (settings, transport),
            Err(err) => {
                tracing::error!("failed to get mail transport: {:#?}", err);
                return;
            }
        };

        let rendered = match render(&*settings, language, variables, subject, body, &context) {
            Ok(rendered) => rendered,
            Err(err) => {
                tracing::error!(
                    transport = ?transport,
                    destination = ?recipient.address,
                    "error while rendering email template: {:?}",
                    err
                );

                return;
            }
        };
        drop(settings);

        tracing::debug!(
            transport = ?transport,
            destination = ?recipient.address,
            "sending email"
        );

        tokio::spawn(async move {
            match transport
                .deliver(&recipient.address, rendered.subject, rendered.body)
                .await
            {
                Ok(_) => tracing::debug!("email sent successfully"),
                Err(err) => tracing::error!("failed to send email: {:?}", err),
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings() -> serde_json::Value {
        serde_json::json!({ "app": { "name": "Panel & Co", "url": "https://panel.example.com" } })
    }

    fn variables(pairs: &[(&str, &str)]) -> BTreeMap<compact_str::CompactString, String> {
        pairs
            .iter()
            .map(|(name, value)| ((*name).into(), (*value).to_string()))
            .collect()
    }

    #[test]
    fn variable_markup_is_kept_while_interpolations_are_escaped() {
        let context = minijinja::context! {
            user => serde_json::json!({ "username": "<script>alert(1)</script>" }),
            link => "https://panel.example.com/reset?token=a&b=<c>",
        };
        let variables = variables(&[
            ("subject", "Reset for <b>{{ user.username }}</b>"),
            ("greeting", "Hello <strong>{{ user.username }}</strong>,"),
            (
                "intro",
                "Your panel <em>{{ settings.app.name }}</em> ({{ language }})",
            ),
            ("button", "<a href=\"{{ link }}\">Reset</a>"),
            (
                "conditional",
                "{% if user.username %}has user{% else %}no user{% endif %}",
            ),
            ("nested", "before {{ vars.greeting }} after"),
            ("deep", "[{{ vars.nested }}]"),
        ]);

        let rendered = render(
            &settings(),
            "de",
            &variables,
            "{{ settings.app.name }} - {{ vars.subject }}",
            "<title>{{ subject }}</title>\n<p>{{ vars.greeting }}</p>\n<p>{{ vars.intro }}</p>\n<p>{{ vars.button }}</p>\n<p>{{ vars.conditional }}</p>\n<p>{{ vars.nested }}</p>\n<p>{{ vars.deep }}</p>\n<p>{{ vars.missing }}</p>\n<p>{{ user.username }}</p>",
            &context,
        )
        .unwrap();

        assert_eq!(
            rendered.subject,
            "Panel & Co - Reset for <b><script>alert(1)</script></b>"
        );

        let body = rendered.body;
        assert!(body.contains("<title>Panel &amp; Co - Reset for &lt;b&gt;&lt;script&gt;alert(1)&lt;&#x2f;script&gt;&lt;&#x2f;b&gt;</title>"));
        assert!(
            body.contains(
                "<p>Hello <strong>&lt;script&gt;alert(1)&lt;&#x2f;script&gt;</strong>,</p>"
            )
        );
        assert!(body.contains("<p>Your panel <em>Panel &amp; Co</em> (de)</p>"));
        assert!(body.contains("<p><a href=\"https:&#x2f;&#x2f;panel.example.com&#x2f;reset?token=a&amp;b=&lt;c&gt;\">Reset</a></p>"));
        assert!(body.contains("<p>has user</p>"));
        assert!(body.contains(
            "<p>before Hello <strong>&lt;script&gt;alert(1)&lt;&#x2f;script&gt;</strong>, after</p>"
        ));
        assert!(body.contains("<p>[before  after]</p>"));
        assert!(body.contains("<p></p>"));
        assert!(body.contains("<p>&lt;script&gt;alert(1)&lt;&#x2f;script&gt;</p>"));
        assert!(!body.contains("<script>"));
    }

    #[test]
    fn variable_render_errors_name_the_variable() {
        let err = render(
            &settings(),
            "en",
            &variables(&[("broken", "{% if %}")]),
            "s",
            "b",
            &minijinja::context! {},
        )
        .err()
        .expect("broken variable must fail rendering");

        assert!(err.to_string().contains("email variable 'broken'"), "{err}");
    }
}
