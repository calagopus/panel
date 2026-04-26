use crate::{
    State,
    extensions::{
        ConstructedExtension, ExtensionPermissionsBuilder, ExtensionRouteBuilder,
        commands::CliCommandGroupBuilder,
    },
};
use std::sync::Arc;
use tokio::sync::{RwLock, RwLockReadGuard};

pub struct ExtensionManager {
    vec: RwLock<Vec<ConstructedExtension>>,
}

impl ExtensionManager {
    pub fn new(vec: Vec<ConstructedExtension>) -> Self {
        Self {
            vec: RwLock::new(vec),
        }
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
            let deserializer = ext.settings_deserializer(state.clone()).await;
            crate::settings::SETTINGS_DESER_EXTENSIONS
                .write()
                .unwrap()
                .insert(ext.package_name, deserializer);
        }
        state.settings.invalidate_cache().await;

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

            ext.initialize(state.clone()).await;

            route_builder = ext.initialize_router(state.clone(), route_builder).await;
            background_tasks_builder = ext
                .initialize_background_tasks(state.clone(), background_tasks_builder)
                .await;
            shutdown_handlers_builder = ext
                .initialize_shutdown_handlers(state.clone(), shutdown_handlers_builder)
                .await;
            permissions_builder = ext
                .initialize_permissions(state.clone(), permissions_builder)
                .await;
        }

        crate::permissions::USER_PERMISSIONS
            .write()
            .unwrap()
            .replace(permissions_builder.user_permissions);
        crate::permissions::ADMIN_PERMISSIONS
            .write()
            .unwrap()
            .replace(permissions_builder.admin_permissions);
        crate::permissions::SERVER_PERMISSIONS
            .write()
            .unwrap()
            .replace(permissions_builder.server_permissions);

        (
            route_builder,
            background_tasks_builder,
            shutdown_handlers_builder,
        )
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
            if let Some(ret) = ext.process_call(name.as_ref(), args).await {
                return Some(ret);
            }
        }

        None
    }
}
