use super::EmailTemplateManager;
use crate::{
    models::{server::Server, team::Team, user::User},
    prelude::*,
    settings::AppSettings,
};
use serde_json::json;
use std::{collections::BTreeMap, sync::Arc};

pub type EmailTemplatePreviewContext = Arc<dyn Fn(&AppSettings) -> serde_json::Value + Send + Sync>;
pub type EmailTemplatePreviewContexts = BTreeMap<&'static str, EmailTemplatePreviewContext>;

const SAMPLE_TOKEN: &str = "b4c2d7e9f1a3";

pub(super) fn core_preview_contexts() -> EmailTemplatePreviewContexts {
    let contexts: [(&'static str, EmailTemplatePreviewContext); 12] = [
        (
            "account_created",
            Arc::new(|settings| {
                json!({
                    "user": User::preview_sample(settings),
                    "reset_link": format!("{}/auth/reset-password?token={SAMPLE_TOKEN}", settings.app.url),
                })
            }),
        ),
        (
            "password_reset",
            Arc::new(|settings| {
                json!({
                    "user": User::preview_sample(settings),
                    "reset_link": format!("{}/auth/reset-password?token={SAMPLE_TOKEN}", settings.app.url),
                })
            }),
        ),
        (
            "email_verification",
            Arc::new(|settings| {
                let user = User::preview_sample(settings);

                json!({
                    "email": &user.email,
                    "user": &user,
                    "verification_link": format!("{}/auth/verify-email?token={SAMPLE_TOKEN}", settings.app.url),
                })
            }),
        ),
        (
            "two_factor_code",
            Arc::new(|settings| {
                json!({
                    "user": User::preview_sample(settings),
                    "code": "428613",
                })
            }),
        ),
        (
            "session_created",
            Arc::new(|settings| {
                json!({
                    "user": User::preview_sample(settings),
                    "ip": "203.0.113.42",
                    "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0",
                    "sessions_link": format!("{}/account/sessions", settings.app.url),
                })
            }),
        ),
        ("connection_test", Arc::new(|_| json!({}))),
        (
            "added_to_server",
            Arc::new(|settings| {
                let server = Server::preview_sample(settings);

                json!({
                    "user": User::preview_sample(settings),
                    "server_link": format!("{}/server/{:08x}", settings.app.url, server.uuid_short),
                    "server": &server,
                })
            }),
        ),
        (
            "removed_from_server",
            Arc::new(|settings| {
                json!({
                    "user": User::preview_sample(settings),
                    "server": Server::preview_sample(settings),
                })
            }),
        ),
        (
            "invited_to_team",
            Arc::new(|settings| {
                json!({
                    "user": User::preview_sample(settings),
                    "team": Team::preview_sample(settings),
                    "teams_link": format!("{}/account/teams", settings.app.url),
                })
            }),
        ),
        (
            "removed_from_team",
            Arc::new(|settings| {
                json!({
                    "user": User::preview_sample(settings),
                    "team": Team::preview_sample(settings),
                })
            }),
        ),
        (
            "server_installed",
            Arc::new(|settings| {
                let server = Server::preview_sample(settings);

                json!({
                    "user": &server.owner,
                    "server_link": format!("{}/server/{:08x}", settings.app.url, server.uuid_short),
                    "server": &server,
                })
            }),
        ),
        (
            "server_restored",
            Arc::new(|settings| {
                let server = Server::preview_sample(settings);

                json!({
                    "user": &server.owner,
                    "server_link": format!("{}/server/{:08x}", settings.app.url, server.uuid_short),
                    "server": &server,
                })
            }),
        ),
    ];

    contexts.into_iter().collect()
}

impl EmailTemplateManager {
    pub fn get_preview_context(&self, identifier: &str) -> Option<EmailTemplatePreviewContext> {
        self.preview_contexts.read().get(identifier).cloned()
    }
}
