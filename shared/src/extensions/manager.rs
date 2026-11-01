use crate::{
    State,
    extensions::{
        ConstructedExtension, ExtensionPermissionsBuilder, ExtensionRouteBuilder,
        commands::CliCommandGroupBuilder,
    },
    settings::ExtensionPermissions,
};
use futures_util::FutureExt;
use std::{
    borrow::Cow,
    collections::{BTreeMap, HashSet},
    panic::AssertUnwindSafe,
    sync::Arc,
};
use tokio::sync::{RwLock, RwLockReadGuard};
use utoipa_axum::router::OpenApiRouter;

fn panic_message(payload: &(dyn std::any::Any + Send)) -> Cow<'_, str> {
    if let Some(s) = payload.downcast_ref::<&str>() {
        (*s).into()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.as_str().into()
    } else {
        "Unknown panic".into()
    }
}

pub struct ExtensionManager {
    vec: RwLock<Vec<ConstructedExtension>>,
    disabled: parking_lot::RwLock<Vec<compact_str::CompactString>>,
    failed: parking_lot::RwLock<BTreeMap<compact_str::CompactString, String>>,
}

impl ExtensionManager {
    pub fn new(vec: Vec<ConstructedExtension>) -> Self {
        Self {
            vec: RwLock::new(vec),
            disabled: parking_lot::RwLock::new(Vec::new()),
            failed: parking_lot::RwLock::new(BTreeMap::new()),
        }
    }

    /// Sets the extensions whose entrypoints are skipped, this has to happen before `init`
    /// and before extension migrations are collected.
    pub fn set_disabled(&self, disabled: Vec<compact_str::CompactString>) {
        *self.disabled.write() = disabled;
    }

    #[inline]
    pub fn disabled(&self) -> Vec<compact_str::CompactString> {
        self.disabled.read().clone()
    }

    #[inline]
    pub fn is_disabled(&self, package_name: &str) -> bool {
        self.disabled.read().iter().any(|d| d == package_name)
    }

    /// Extensions whose entrypoints were skipped at boot because one of them panicked or
    /// their routes or CLI commands conflict, mapped to the reason.
    #[inline]
    pub fn failed(&self) -> BTreeMap<compact_str::CompactString, String> {
        self.failed.read().clone()
    }

    #[inline]
    pub fn is_failed(&self, package_name: &str) -> bool {
        self.failed.read().contains_key(package_name)
    }

    /// Extensions that are not running, either disabled or failed to start.
    pub fn inactive(&self) -> Vec<compact_str::CompactString> {
        let mut inactive = self.disabled();
        for package_name in self.failed.read().keys() {
            if !inactive.contains(package_name) {
                inactive.push(package_name.clone());
            }
        }

        inactive
    }

    fn fail(&self, package_name: &str, stage: &str, reason: &str) {
        let reason = format!("{stage}: {reason}");
        tracing::error!(
            extension = %package_name,
            "extension failed to start, skipping its entrypoints: {reason}"
        );

        self.failed.write().insert(package_name.into(), reason);
    }

    /// Runs the entrypoints of every enabled extension and merges their routes into `router`,
    /// which already holds the core routes. `mount` turns a single extension's route builder
    /// into a router that can be merged into `router`.
    ///
    /// An extension whose entrypoint panics, or whose routes conflict with the core or an
    /// earlier extension, is marked as failed and everything it registered is rolled back,
    /// instead of panicking the panel.
    pub async fn init(
        &self,
        state: State,
        mut router: OpenApiRouter<State>,
        mount: impl Fn(ExtensionRouteBuilder) -> OpenApiRouter<State>,
    ) -> (
        OpenApiRouter<State>,
        super::background_tasks::BackgroundTaskBuilder,
        super::shutdown_handlers::ShutdownHandlerBuilder,
    ) {
        let mut email_templates_builder =
            super::email_templates::ExtensionEmailTemplateBuilder::default();
        let background_tasks_builder =
            super::background_tasks::BackgroundTaskBuilder::new(state.clone());
        let shutdown_handlers_builder =
            super::shutdown_handlers::ShutdownHandlerBuilder::new(state.clone());
        let index_html_builder = super::index_html::IndexHtmlBuilder::new();
        let mut permissions_builder = ExtensionPermissionsBuilder::new(
            crate::permissions::BASE_USER_PERMISSIONS.clone(),
            crate::permissions::BASE_ADMIN_PERMISSIONS.clone(),
            crate::permissions::BASE_SERVER_PERMISSIONS.clone(),
        );

        let mut settings_map = crate::settings::Settings::fetch_settings_map(&state.database)
            .await
            .unwrap_or_else(|err| {
                tracing::error!("failed to fetch settings for extension settings probe: {err:#}");
                Default::default()
            });

        for ext in self.vec.read().await.iter() {
            if self.is_disabled(ext.package_name) {
                tracing::info!(extension = %ext.package_name, "extension is disabled, skipping its entrypoints");
                continue;
            }
            if self.is_failed(ext.package_name) {
                continue;
            }

            match AssertUnwindSafe(async {
                let deserializer = ext.settings_deserializer(state.clone()).await;
                deserializer
                    .deserialize_boxed(crate::extensions::settings::SettingsDeserializer::new(
                        state.database.clone(),
                        ext.package_name,
                        &mut settings_map,
                    ))
                    .await
                    .map(|_| deserializer)
            })
            .catch_unwind()
            .await
            {
                Ok(Ok(deserializer)) => {
                    crate::settings::SETTINGS_DESER_EXTENSIONS
                        .write()
                        .insert(ext.package_name, deserializer);
                }
                Ok(Err(err)) => self.fail(
                    ext.package_name,
                    "settings_deserializer",
                    &format!("{err:#}"),
                ),
                Err(err) => self.fail(
                    ext.package_name,
                    "settings_deserializer",
                    &panic_message(&*err),
                ),
            }
        }
        state.settings.invalidate_cache().await;

        let mut contributed_permissions = BTreeMap::new();

        for ext in self.vec.write().await.iter_mut() {
            if self.is_disabled(ext.package_name) || self.is_failed(ext.package_name) {
                continue;
            }

            let package_name = ext.package_name;
            let ext = match Arc::get_mut(&mut ext.extension) {
                Some(ext) => ext,
                None => {
                    panic!(
                        "Failed to get mutable reference to extension {package_name}. This should NEVER happen."
                    );
                }
            };

            let task_names = background_tasks_builder.task_names().await;
            let handler_names = shutdown_handlers_builder.handler_names().await;
            let stage = std::cell::Cell::new("initialize");

            let result = AssertUnwindSafe(async {
                ext.initialize(state.clone()).await;

                stage.set("initialize_router");
                let route_builder = ext
                    .initialize_router(state.clone(), ExtensionRouteBuilder::new(state.clone()))
                    .await;
                stage.set("registering routes");
                let router = router.clone().merge(mount(route_builder));

                stage.set("initialize_email_templates");
                let email_templates = ext
                    .initialize_email_templates(state.clone(), email_templates_builder.clone())
                    .await;
                stage.set("initialize_background_tasks");
                ext.initialize_background_tasks(state.clone(), background_tasks_builder.share())
                    .await;
                stage.set("initialize_shutdown_handlers");
                ext.initialize_shutdown_handlers(state.clone(), shutdown_handlers_builder.share())
                    .await;
                stage.set("initialize_index_html");
                ext.initialize_index_html(state.clone(), index_html_builder.share(package_name))
                    .await;
                stage.set("initialize_permissions");
                let permissions = ext
                    .initialize_permissions(state.clone(), permissions_builder.clone())
                    .await;

                (router, email_templates, permissions)
            })
            .catch_unwind()
            .await;

            match result {
                Ok((extension_router, email_templates, permissions)) => {
                    router = extension_router;
                    email_templates_builder = email_templates;
                    contributed_permissions.insert(
                        compact_str::CompactString::from(package_name),
                        permissions.contributions_since(&permissions_builder.snapshot()),
                    );
                    permissions_builder = permissions;
                }
                Err(err) => {
                    background_tasks_builder.rollback(&task_names).await;
                    shutdown_handlers_builder.rollback(&handler_names).await;
                    index_html_builder.rollback(package_name);
                    crate::settings::SETTINGS_DESER_EXTENSIONS
                        .write()
                        .remove(package_name);

                    self.fail(package_name, stage.get(), &panic_message(&*err));
                }
            }
        }

        let (templates, variables) = email_templates_builder.finish();
        *state.mail.templates.templates.write() = templates;
        *state.mail.templates.variables.write() = variables;

        state
            .settings
            .set_index_html_variables(index_html_builder.finish());

        crate::permissions::USER_PERMISSIONS
            .write()
            .replace(permissions_builder.user_permissions);
        crate::permissions::ADMIN_PERMISSIONS
            .write()
            .replace(permissions_builder.admin_permissions);
        crate::permissions::SERVER_PERMISSIONS
            .write()
            .replace(permissions_builder.server_permissions);

        self.apply_permission_snapshots(&state, contributed_permissions)
            .await;

        (router, background_tasks_builder, shutdown_handlers_builder)
    }

    /// Keeps the permissions of installed extensions valid across a disable/enable cycle:
    /// what an enabled extension contributed is remembered, what a disabled one contributed
    /// is fed back as inert so roles, subusers and api keys holding it still validate.
    async fn apply_permission_snapshots(
        &self,
        state: &State,
        contributed: BTreeMap<compact_str::CompactString, ExtensionPermissions>,
    ) {
        let stored = match state.settings.get().await {
            Ok(settings) => settings.extension_permissions.clone(),
            Err(err) => {
                tracing::error!("failed to read stored extension permissions: {:#?}", err);
                return;
            }
        };

        let mut snapshots = BTreeMap::new();
        let mut inert_user = HashSet::new();
        let mut inert_admin = HashSet::new();
        let mut inert_server = HashSet::new();

        for ext in self.vec.read().await.iter() {
            let package_name = compact_str::CompactString::from(ext.package_name);

            let permissions = match contributed.get(&package_name) {
                Some(permissions) => permissions.clone(),
                None => match stored.get(&package_name) {
                    Some(permissions) => {
                        inert_user.extend(permissions.user.iter().map(ToString::to_string));
                        inert_admin.extend(permissions.admin.iter().map(ToString::to_string));
                        inert_server.extend(permissions.server.iter().map(ToString::to_string));

                        permissions.clone()
                    }
                    None => continue,
                },
            };

            snapshots.insert(package_name, permissions);
        }

        tracing::debug!(
            count = inert_user.len() + inert_admin.len() + inert_server.len(),
            "keeping permissions of disabled extensions grantable"
        );

        crate::permissions::USER_PERMISSIONS
            .write()
            .set_inert(inert_user);
        crate::permissions::ADMIN_PERMISSIONS
            .write()
            .set_inert(inert_admin);
        crate::permissions::SERVER_PERMISSIONS
            .write()
            .set_inert(inert_server);

        if snapshots != stored
            && let Err(err) = state.settings.set_extension_permissions(&snapshots).await
        {
            tracing::error!("failed to store extension permissions: {:#?}", err);
        }
    }

    /// Registers the CLI commands of every extension. An extension whose `initialize_cli` panics
    /// or registers an already taken command is marked as failed, which also skips its other
    /// entrypoints in `init`.
    pub async fn init_cli(
        &self,
        env: Option<&Arc<crate::env::Env>>,
        mut builder: CliCommandGroupBuilder,
    ) -> CliCommandGroupBuilder {
        for ext in self.vec.write().await.iter_mut() {
            let package_name = ext.package_name;
            let ext = match Arc::get_mut(&mut ext.extension) {
                Some(ext) => ext,
                None => {
                    panic!(
                        "Failed to get mutable reference to extension {package_name}. This should NEVER happen."
                    );
                }
            };

            let result = AssertUnwindSafe(
                ext.initialize_cli(env, CliCommandGroupBuilder::new(package_name, "")),
            )
            .catch_unwind()
            .await;

            let reason = match result {
                Ok(commands) => match builder.merge(commands) {
                    Ok(()) => continue,
                    Err(reason) => reason,
                },
                Err(err) => panic_message(&*err).into_owned(),
            };

            self.fail(package_name, "initialize_cli", &reason);
        }

        builder
    }

    #[inline]
    pub async fn extensions(&self) -> RwLockReadGuard<'_, Vec<ConstructedExtension>> {
        self.vec.read().await
    }

    #[inline]
    pub fn blocking_extensions(&self) -> RwLockReadGuard<'_, Vec<ConstructedExtension>> {
        self.vec.blocking_read()
    }

    pub async fn call(
        &self,
        name: impl AsRef<str>,
        args: &[super::ExtensionCallValue],
    ) -> Option<super::ExtensionCallValue> {
        for ext in self.extensions().await.iter() {
            if self.is_disabled(ext.package_name) || self.is_failed(ext.package_name) {
                continue;
            }

            if let Some(ret) = ext.process_call(name.as_ref(), args).await {
                return Some(ret);
            }
        }

        None
    }
}
