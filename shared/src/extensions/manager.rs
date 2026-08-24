use crate::{
    State,
    extensions::{
        ConstructedExtension, ExtensionPermissionsBuilder, ExtensionRouteBuilder,
        commands::CliCommandGroupBuilder,
    },
    settings::ExtensionPermissions,
};
use std::{
    collections::{BTreeMap, HashSet},
    sync::Arc,
};
use tokio::sync::{RwLock, RwLockReadGuard};

pub struct ExtensionManager {
    vec: RwLock<Vec<ConstructedExtension>>,
    disabled: parking_lot::RwLock<Vec<compact_str::CompactString>>,
}

impl ExtensionManager {
    pub fn new(vec: Vec<ConstructedExtension>) -> Self {
        Self {
            vec: RwLock::new(vec),
            disabled: parking_lot::RwLock::new(Vec::new()),
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

    pub async fn init(
        &self,
        state: State,
    ) -> (
        ExtensionRouteBuilder,
        super::background_tasks::BackgroundTaskBuilder,
        super::shutdown_handlers::ShutdownHandlerBuilder,
    ) {
        let mut route_builder = ExtensionRouteBuilder::new(state.clone());
        let mut email_templates_builder =
            super::email_templates::ExtensionEmailTemplateBuilder::default();
        let mut background_tasks_builder =
            super::background_tasks::BackgroundTaskBuilder::new(state.clone());
        let mut shutdown_handlers_builder =
            super::shutdown_handlers::ShutdownHandlerBuilder::new(state.clone());
        let mut permissions_builder = ExtensionPermissionsBuilder::new(
            crate::permissions::BASE_USER_PERMISSIONS.clone(),
            crate::permissions::BASE_ADMIN_PERMISSIONS.clone(),
            crate::permissions::BASE_SERVER_PERMISSIONS.clone(),
        );

        for ext in self.vec.read().await.iter() {
            if self.is_disabled(ext.package_name) {
                tracing::info!(extension = %ext.package_name, "extension is disabled, skipping its entrypoints");
                continue;
            }

            let deserializer = ext.settings_deserializer(state.clone()).await;
            crate::settings::SETTINGS_DESER_EXTENSIONS
                .write()
                .insert(ext.package_name, deserializer);
        }
        state.settings.invalidate_cache().await;

        let mut contributed_permissions = BTreeMap::new();

        for ext in self.vec.write().await.iter_mut() {
            if self.is_disabled(ext.package_name) {
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

            ext.initialize(state.clone()).await;

            route_builder = ext.initialize_router(state.clone(), route_builder).await;
            email_templates_builder = ext
                .initialize_email_templates(state.clone(), email_templates_builder)
                .await;
            background_tasks_builder = ext
                .initialize_background_tasks(state.clone(), background_tasks_builder)
                .await;
            shutdown_handlers_builder = ext
                .initialize_shutdown_handlers(state.clone(), shutdown_handlers_builder)
                .await;

            let before = permissions_builder.snapshot();
            permissions_builder = ext
                .initialize_permissions(state.clone(), permissions_builder)
                .await;

            contributed_permissions.insert(
                compact_str::CompactString::from(package_name),
                permissions_builder.contributions_since(&before),
            );
        }

        *state.mail.templates.templates.write() = email_templates_builder.finish();

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

        (
            route_builder,
            background_tasks_builder,
            shutdown_handlers_builder,
        )
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

    pub async fn init_cli(
        &self,
        env: Option<&Arc<crate::env::Env>>,
        mut builder: CliCommandGroupBuilder,
    ) -> CliCommandGroupBuilder {
        for ext in self.vec.write().await.iter_mut() {
            let ext = match Arc::get_mut(&mut ext.extension) {
                Some(ext) => ext,
                None => {
                    panic!(
                        "Failed to get mutable reference to extension {}. This should NEVER happen.",
                        ext.package_name
                    );
                }
            };

            builder = ext.initialize_cli(env, builder).await;
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
            if self.is_disabled(ext.package_name) {
                continue;
            }

            if let Some(ret) = ext.process_call(name.as_ref(), args).await {
                return Some(ret);
            }
        }

        None
    }
}
