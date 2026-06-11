use crate::settings::SettingsReadGuard;
use lettre::AsyncTransport;
use std::sync::Arc;

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

    pub async fn send_template_foreground(
        &self,
        state: &crate::State,
        identifier: &str,
        destination: compact_str::CompactString,
        context: minijinja::Value,
    ) -> Result<(), anyhow::Error> {
        let template = self.templates.get_template(identifier)?;
        let fetched_template = template.get(state).await?;

        if !fetched_template.enabled {
            tracing::debug!(
                "email template '{}' is disabled, skipping sending email",
                identifier
            );
            return Ok(());
        }

        self.send_foreground(
            destination,
            fetched_template.subject,
            fetched_template.content,
            context,
        )
        .await
    }

    pub async fn send_template(
        &self,
        state: &crate::State,
        identifier: &str,
        destination: compact_str::CompactString,
        context: minijinja::Value,
    ) {
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

        self.send(
            destination,
            fetched_template.subject,
            fetched_template.content,
            context,
        )
        .await
    }

    pub async fn send_foreground(
        &self,
        destination: compact_str::CompactString,
        subject: impl AsRef<str>,
        body: impl AsRef<str>,
        context: minijinja::Value,
    ) -> Result<(), anyhow::Error> {
        let (settings, transport) = self.get_transport().await?;

        let mut environment = minijinja::Environment::new();
        environment.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);
        environment.add_global("settings", minijinja::Value::from_serialize(&*settings));
        environment.add_global(
            "subject",
            minijinja::Value::from_serialize(subject.as_ref()),
        );
        drop(settings);

        let rendered_subject = environment.render_str(subject.as_ref(), context.clone())?;
        let rendered_body = environment.render_str(body.as_ref(), context)?;

        match transport {
            Transport::None => {}
            Transport::Smtp {
                transport,
                from_address,
                from_name,
            } => {
                transport
                    .send(
                        lettre::message::Message::builder()
                            .subject(rendered_subject)
                            .to(lettre::message::Mailbox::new(None, destination.parse()?))
                            .from(lettre::message::Mailbox::new(
                                from_name.map(String::from),
                                from_address.parse()?,
                            ))
                            .header(lettre::message::header::ContentType::TEXT_HTML)
                            .body(rendered_body)?,
                    )
                    .await?;
            }
            Transport::Sendmail {
                transport,
                from_address,
                from_name,
            } => {
                transport
                    .send(
                        lettre::message::Message::builder()
                            .subject(rendered_subject)
                            .to(lettre::message::Mailbox::new(None, destination.parse()?))
                            .from(lettre::message::Mailbox::new(
                                from_name.map(String::from),
                                from_address.parse()?,
                            ))
                            .header(lettre::message::header::ContentType::TEXT_HTML)
                            .body(rendered_body)?,
                    )
                    .await?;
            }
            Transport::Filesystem {
                transport,
                from_address,
                from_name,
            } => {
                transport
                    .send(
                        lettre::message::Message::builder()
                            .subject(rendered_subject)
                            .to(lettre::message::Mailbox::new(None, destination.parse()?))
                            .from(lettre::message::Mailbox::new(
                                from_name.map(String::from),
                                from_address.parse()?,
                            ))
                            .header(lettre::message::header::ContentType::TEXT_HTML)
                            .body(rendered_body)?,
                    )
                    .await?;
            }
        };

        Ok(())
    }

    pub async fn send(
        &self,
        destination: compact_str::CompactString,
        subject: impl AsRef<str>,
        body: impl AsRef<str>,
        context: minijinja::Value,
    ) {
        let (settings, transport) = match self.get_transport().await {
            Ok((settings, transport)) => (settings, transport),
            Err(err) => {
                tracing::error!("failed to get mail transport: {:#?}", err);
                return;
            }
        };

        let mut environment = minijinja::Environment::new();
        environment.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);
        environment.add_global("settings", minijinja::Value::from_serialize(&*settings));
        environment.add_global(
            "subject",
            minijinja::Value::from_serialize(subject.as_ref()),
        );
        drop(settings);

        let rendered_subject = match environment.render_str(subject.as_ref(), &context) {
            Ok(subject) => subject,
            Err(err) => {
                tracing::error!(
                    transport = ?transport,
                    destination = ?destination,
                    "error while rendering email template: {:?}",
                    err
                );

                return;
            }
        };
        let rendered_body = match environment.render_str(body.as_ref(), context) {
            Ok(body) => body,
            Err(err) => {
                tracing::error!(
                    transport = ?transport,
                    destination = ?destination,
                    "error while rendering email template: {:?}",
                    err
                );

                return;
            }
        };

        tracing::debug!(
            transport = ?transport,
            destination = ?destination,
            "sending email"
        );

        tokio::spawn(async move {
            let run = async || -> Result<(), anyhow::Error> {
                match transport {
                    Transport::None => {}
                    Transport::Smtp {
                        transport,
                        from_address,
                        from_name,
                    } => {
                        transport
                            .send(
                                lettre::message::Message::builder()
                                    .subject(rendered_subject)
                                    .to(lettre::message::Mailbox::new(None, destination.parse()?))
                                    .from(lettre::message::Mailbox::new(
                                        from_name.map(String::from),
                                        from_address.parse()?,
                                    ))
                                    .header(lettre::message::header::ContentType::TEXT_HTML)
                                    .body(rendered_body)?,
                            )
                            .await?;
                    }
                    Transport::Sendmail {
                        transport,
                        from_address,
                        from_name,
                    } => {
                        transport
                            .send(
                                lettre::message::Message::builder()
                                    .subject(rendered_subject)
                                    .to(lettre::message::Mailbox::new(None, destination.parse()?))
                                    .from(lettre::message::Mailbox::new(
                                        from_name.map(String::from),
                                        from_address.parse()?,
                                    ))
                                    .header(lettre::message::header::ContentType::TEXT_HTML)
                                    .body(rendered_body)?,
                            )
                            .await?;
                    }
                    Transport::Filesystem {
                        transport,
                        from_address,
                        from_name,
                    } => {
                        transport
                            .send(
                                lettre::message::Message::builder()
                                    .subject(rendered_subject)
                                    .to(lettre::message::Mailbox::new(None, destination.parse()?))
                                    .from(lettre::message::Mailbox::new(
                                        from_name.map(String::from),
                                        from_address.parse()?,
                                    ))
                                    .header(lettre::message::header::ContentType::TEXT_HTML)
                                    .body(rendered_body)?,
                            )
                            .await?;
                    }
                }

                Ok(())
            };

            match run().await {
                Ok(_) => tracing::debug!("email sent successfully"),
                Err(err) => tracing::error!("failed to send email: {:?}", err),
            }
        });
    }
}
