#![allow(unused_variables)]

use crate::{State, permissions::PermissionGroup};
use indexmap::IndexMap;
use serde::Serialize;
use std::{ops::Deref, sync::Arc};
use utoipa::ToSchema;
use utoipa_axum::router::OpenApiRouter;

pub mod background_tasks;
pub mod commands;
pub mod distr;
pub mod email_templates;
pub mod manager;
pub mod settings;
pub mod shutdown_handlers;

pub struct ExtensionRouteBuilder {
    state: State,
    pub global: Option<Box<OpenApiRouter<State>>>,
    pub api_admin: Option<Box<OpenApiRouter<State>>>,
    pub api_auth: Option<Box<OpenApiRouter<State>>>,
    pub api_client: Option<Box<OpenApiRouter<State>>>,
    pub api_client_servers_server: Option<Box<OpenApiRouter<State>>>,
    pub api_remote: Option<Box<OpenApiRouter<State>>>,
    pub api_remote_servers_server: Option<Box<OpenApiRouter<State>>>,
}

impl ExtensionRouteBuilder {
    pub fn new(state: State) -> Self {
        Self {
            state,
            global: None,
            api_admin: None,
            api_auth: None,
            api_client: None,
            api_client_servers_server: None,
            api_remote: None,
            api_remote_servers_server: None,
        }
    }

    /// Adds a router for handling requests to `/`.
    pub fn add_global_router(
        mut self,
        router: impl FnOnce(OpenApiRouter<State>) -> OpenApiRouter<State>,
    ) -> Self {
        self.global = Some(Box::new(router(self.global.map_or_else(
            || OpenApiRouter::new().with_state(self.state.clone()),
            |b| *b,
        ))));

        self
    }

    /// Adds a router for handling requests to `/api/admin`.
    /// Authentication middleware is already handled by the parent router.
    pub fn add_admin_api_router(
        mut self,
        router: impl FnOnce(OpenApiRouter<State>) -> OpenApiRouter<State>,
    ) -> Self {
        self.api_admin = Some(Box::new(router(self.api_admin.map_or_else(
            || OpenApiRouter::new().with_state(self.state.clone()),
            |b| *b,
        ))));

        self
    }

    /// Adds a router for handling requests to `/api/auth`.
    pub fn add_auth_api_router(
        mut self,
        router: impl FnOnce(OpenApiRouter<State>) -> OpenApiRouter<State>,
    ) -> Self {
        self.api_auth = Some(Box::new(router(self.api_auth.map_or_else(
            || OpenApiRouter::new().with_state(self.state.clone()),
            |b| *b,
        ))));

        self
    }

    /// Adds a router for handling requests to `/api/client`.
    /// Authentication middleware is already handled by the parent router.
    pub fn add_client_api_router(
        mut self,
        router: impl FnOnce(OpenApiRouter<State>) -> OpenApiRouter<State>,
    ) -> Self {
        self.api_client = Some(Box::new(router(self.api_client.map_or_else(
            || OpenApiRouter::new().with_state(self.state.clone()),
            |b| *b,
        ))));

        self
    }

    /// Adds a router for handling requests to `/api/client/servers/{server}`.
    /// Authentication middleware is already handled by the parent router.
    pub fn add_client_server_api_router(
        mut self,
        router: impl FnOnce(OpenApiRouter<State>) -> OpenApiRouter<State>,
    ) -> Self {
        self.api_client_servers_server = Some(Box::new(router(
            self.api_client_servers_server.map_or_else(
                || OpenApiRouter::new().with_state(self.state.clone()),
                |b| *b,
            ),
        )));

        self
    }

    /// Adds a router for handling requests to `/api/remote`.
    /// Authentication middleware is already handled by the parent router.
    pub fn add_remote_api_router(
        mut self,
        router: impl FnOnce(OpenApiRouter<State>) -> OpenApiRouter<State>,
    ) -> Self {
        self.api_remote = Some(Box::new(router(self.api_remote.map_or_else(
            || OpenApiRouter::new().with_state(self.state.clone()),
            |b| *b,
        ))));

        self
    }

    /// Adds a router for handling requests to `/api/admin`.
    /// Authentication middleware is already handled by the parent router.
    pub fn add_remote_server_api_router(
        mut self,
        router: impl FnOnce(OpenApiRouter<State>) -> OpenApiRouter<State>,
    ) -> Self {
        self.api_remote_servers_server = Some(Box::new(router(
            self.api_remote_servers_server.map_or_else(
                || OpenApiRouter::new().with_state(self.state.clone()),
                |b| *b,
            ),
        )));

        self
    }
}

type RawPermissionMap = IndexMap<&'static str, PermissionGroup>;
pub struct ExtensionPermissionsBuilder {
    pub user_permissions: RawPermissionMap,
    pub admin_permissions: RawPermissionMap,
    pub server_permissions: RawPermissionMap,
}

impl ExtensionPermissionsBuilder {
    pub fn new(
        user_permissions: RawPermissionMap,
        admin_permissions: RawPermissionMap,
        server_permissions: RawPermissionMap,
    ) -> Self {
        Self {
            user_permissions,
            admin_permissions,
            server_permissions,
        }
    }

    /// Adds a permission group to the user permissions.
    pub fn add_user_permission_group(
        mut self,
        group_name: &'static str,
        group: PermissionGroup,
    ) -> Self {
        self.user_permissions.insert(group_name, group);

        self
    }

    /// Mutates a permission group in the user permissions.
    pub fn mutate_user_permission_group(
        mut self,
        group_name: &'static str,
        mutation: impl FnOnce(&mut PermissionGroup),
    ) -> Self {
        if let Some(group) = self.user_permissions.get_mut(group_name) {
            mutation(group);
        }

        self
    }

    /// Adds a permission group to the admin permissions.
    pub fn add_admin_permission_group(
        mut self,
        group_name: &'static str,
        group: PermissionGroup,
    ) -> Self {
        self.admin_permissions.insert(group_name, group);

        self
    }

    /// Mutates a permission group in the admin permissions.
    pub fn mutate_admin_permission_group(
        mut self,
        group_name: &'static str,
        mutation: impl FnOnce(&mut PermissionGroup),
    ) -> Self {
        if let Some(group) = self.admin_permissions.get_mut(group_name) {
            mutation(group);
        }

        self
    }

    /// Adds a permission group to the server permissions.
    pub fn add_server_permission_group(
        mut self,
        group_name: &'static str,
        group: PermissionGroup,
    ) -> Self {
        self.server_permissions.insert(group_name, group);

        self
    }

    /// Mutates a permission group in the server permissions.
    pub fn mutate_server_permission_group(
        mut self,
        group_name: &'static str,
        mutation: impl FnOnce(&mut PermissionGroup),
    ) -> Self {
        if let Some(group) = self.server_permissions.get_mut(group_name) {
            mutation(group);
        }

        self
    }
}

pub struct ExtensionUpdateInfo {
    pub version: semver::Version,
    pub changes: Vec<compact_str::CompactString>,
}

pub type ExtensionCallValue = Box<dyn std::any::Any + Send + Sync>;

#[async_trait::async_trait]
pub trait Extension: Send + Sync {
    /// Your extension entrypoint, this runs as soon as the database is migrated and before the webserver starts
    async fn initialize(&mut self, state: State) {}

    /// Your extension cli entrypoint, this runs after the env has been parsed
    async fn initialize_cli(
        &mut self,
        env: Option<&Arc<crate::env::Env>>,
        builder: commands::CliCommandGroupBuilder,
    ) -> commands::CliCommandGroupBuilder {
        builder
    }

    /// Your extension routes entrypoint, this runs as soon as the database is migrated and before the webserver starts
    async fn initialize_router(
        &mut self,
        state: State,
        builder: ExtensionRouteBuilder,
    ) -> ExtensionRouteBuilder {
        builder
    }

    /// Your extension email templates entrypoint, this runs as soon as the database is migrated and before the webserver starts
    async fn initialize_email_templates(
        &mut self,
        state: State,
        builder: email_templates::ExtensionEmailTemplateBuilder,
    ) -> email_templates::ExtensionEmailTemplateBuilder {
        builder
    }

    /// Your extension background tasks entrypoint, this runs as soon as the database is migrated and before the webserver starts
    async fn initialize_background_tasks(
        &mut self,
        state: State,
        builder: background_tasks::BackgroundTaskBuilder,
    ) -> background_tasks::BackgroundTaskBuilder {
        builder
    }

    /// Your extension shutdown handler entrypoint, this runs as soon as the database is migrated and before the webserver starts
    async fn initialize_shutdown_handlers(
        &mut self,
        state: State,
        builder: shutdown_handlers::ShutdownHandlerBuilder,
    ) -> shutdown_handlers::ShutdownHandlerBuilder {
        builder
    }

    /// Your extension permissions entrypoint, this runs as soon as the database is migrated and before the webserver starts
    async fn initialize_permissions(
        &mut self,
        state: State,
        builder: ExtensionPermissionsBuilder,
    ) -> ExtensionPermissionsBuilder {
        builder
    }

    /// Your extension settings deserializer, this is used to deserialize your extension settings from the database
    /// Whatever value you return in the `deserialize_boxed` method must match the trait `ExtensionSettings`, which requires
    /// `SettingsSerializeExt` to be implemented for it. If you have no clue what this means. copy code from the docs.
    async fn settings_deserializer(&self, state: State) -> settings::ExtensionSettingsDeserializer {
        Arc::new(settings::EmptySettings)
    }

    /// Your extension update checker, this is used to check for updates to your extension. It runs every 12 hours and on startup.
    /// You can return an `ExtensionUpdateInfo` struct with the new version and a list of changes, this changes list *should* be all
    /// changes from the current version to the new version. An empty changes list will simply not show any changelog, but will still show that an update is available.
    async fn check_for_updates(
        &self,
        state: State,
        current_version: &semver::Version,
    ) -> Result<Option<ExtensionUpdateInfo>, anyhow::Error> {
        Ok(None)
    }

    /// Your extension call processor, this can be called by other extensions to interact with yours,
    /// if the call does not apply to your extension, simply return `None` to continue the matching process.
    ///
    /// Optimally (if applies) make sure your calls are globally unique, for example by prepending them with your package name
    async fn process_call(
        &self,
        name: &str,
        args: &[ExtensionCallValue],
    ) -> Option<ExtensionCallValue> {
        None
    }

    /// Your extension call processor, this can be called by other extensions to interact with yours,
    /// if the call does not apply to your extension, simply return `None` to continue the matching process.
    ///
    /// The only difference to `process_call` is that this takes an owned vec, its automatically implemented in terms of `process_call`.
    ///
    /// Optimally (if applies) make sure your calls are globally unique, for example by prepending them with your package name
    async fn process_call_owned(
        &self,
        name: &str,
        args: Vec<ExtensionCallValue>,
    ) -> Option<ExtensionCallValue> {
        self.process_call(name, &args).await
    }
}

#[derive(ToSchema, Serialize, Clone)]
pub struct ConstructedExtension {
    pub metadata_toml: distr::MetadataToml,
    pub package_name: &'static str,
    pub description: &'static str,
    pub authors: &'static [&'static str],
    #[schema(value_type = String)]
    pub version: semver::Version,

    #[serde(skip)]
    #[schema(ignore)]
    pub extension: Arc<dyn Extension>,
}

impl Deref for ConstructedExtension {
    type Target = Arc<dyn Extension>;

    fn deref(&self) -> &Self::Target {
        &self.extension
    }
}

#[derive(ToSchema, Serialize, Clone)]
pub struct PendingExtension {
    pub metadata_toml: distr::MetadataToml,
    pub package_name: compact_str::CompactString,
    pub description: compact_str::CompactString,
    pub authors: Vec<compact_str::CompactString>,
    #[schema(value_type = String)]
    pub version: semver::Version,
}
