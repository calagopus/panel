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
                use_tls,
                from_address,
                from_name,
            } => {
                let mut transport =
                    lettre::AsyncSmtpTransport::<lettre::Tokio1Executor>::builder_dangerous(
                        host.as_str(),
                    )
                    .port(*port)
                    .tls(if *use_tls {
                        lettre::transport::smtp::client::Tls::Required(
                            lettre::transport::smtp::client::TlsParametersBuilder::new(
                                host.to_string(),
                            )
                            .build_native()
                            .unwrap(),
                        )
                    } else {
                        lettre::transport::smtp::client::Tls::None
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

    pub async fn send_foreground(
        &self,
        destination: compact_str::CompactString,
        subject: compact_str::CompactString,
        body: impl AsRef<str>,
        context: minijinja::Value,
    ) -> Result<(), anyhow::Error> {
        let (settings, transport) = self.get_transport().await?;

        let mut environment = minijinja::Environment::new();
        environment.set_auto_escape_callback(|_| minijinja::AutoEscape::Html);
        environment.add_global("settings", minijinja::Value::from_serialize(&*settings));
        drop(settings);

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
                            .subject(subject)
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
                            .subject(subject)
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
                            .subject(subject)
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
        subject: compact_str::CompactString,
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
        drop(settings);

        let rendered_body = match environment.render_str(body.as_ref(), context) {
            Ok(body) => body,
            Err(err) => {
                tracing::error!(
                    transport = ?transport,
                    destination = ?destination,
                    subject = ?subject,
                    "error while rendering email template: {:?}",
                    err
                );

                return;
            }
        };

        tracing::debug!(
            transport = ?transport,
            destination = ?destination,
            subject = ?subject,
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
                                    .subject(subject)
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
                                    .subject(subject)
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
                                    .subject(subject)
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
