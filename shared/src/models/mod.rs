use crate::database::DatabaseError;
use compact_str::CompactStringExt;
use futures_util::{StreamExt, TryStreamExt};
use garde::Validate;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use sqlx::{
    Arguments, Postgres, QueryBuilder, Row,
    encode::IsNull,
    error::BoxDynError,
    postgres::{PgArgumentBuffer, PgArguments, PgRow, PgTypeInfo},
};
use std::{
    collections::{BTreeMap, HashSet},
    marker::PhantomData,
    pin::Pin,
    sync::{Arc, LazyLock},
};
use tokio::sync::RwLock;
use utoipa::ToSchema;

pub mod admin_activity;
pub mod announcement;
pub mod backup_configuration;
pub mod database_host;
pub mod egg_configuration;
pub mod egg_repository;
pub mod egg_repository_egg;
pub mod location;
pub mod location_database_host;
pub mod mount;
pub mod nest;
pub mod nest_egg;
pub mod nest_egg_mount;
pub mod nest_egg_variable;
pub mod node;
pub mod node_allocation;
pub mod node_mount;
pub mod oauth_provider;
pub mod oauth_provider_mapping;
pub mod role;
pub mod server;
pub mod server_activity;
pub mod server_allocation;
pub mod server_backup;
pub mod server_database;
pub mod server_mount;
pub mod server_schedule;
pub mod server_schedule_step;
pub mod server_subuser;
pub mod server_variable;
pub mod user;
pub mod user_activity;
pub mod user_api_key;
pub mod user_command_snippet;
pub mod user_oauth_link;
pub mod user_password_reset;
pub mod user_recovery_code;
pub mod user_security_key;
pub mod user_server_group;
pub mod user_session;
pub mod user_ssh_key;

#[derive(ToSchema, Validate, Deserialize, Serialize)]
pub struct PaginationParams {
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    #[serde(default = "Pagination::default_page")]
    pub page: i64,
    #[garde(range(min = 1, max = 100))]
    #[schema(minimum = 1, maximum = 100)]
    #[serde(default = "Pagination::default_per_page")]
    pub per_page: i64,
}

#[derive(ToSchema, Validate, Deserialize, Serialize)]
pub struct PaginationParamsWithSearch {
    #[garde(range(min = 1))]
    #[schema(minimum = 1)]
    #[serde(default = "Pagination::default_page")]
    pub page: i64,
    #[garde(range(min = 1, max = 100))]
    #[schema(minimum = 1, maximum = 100)]
    #[serde(default = "Pagination::default_per_page")]
    pub per_page: i64,
    #[garde(length(chars, min = 1, max = 128))]
    #[schema(min_length = 1, max_length = 128)]
    #[serde(
        default,
        deserialize_with = "crate::deserialize::deserialize_string_option"
    )]
    pub search: Option<compact_str::CompactString>,
}

#[derive(ToSchema, Deserialize, Serialize)]
pub struct Pagination<T: Serialize = serde_json::Value> {
    pub total: i64,
    pub per_page: i64,
    pub page: i64,

    pub data: Vec<T>,
}

impl Pagination {
    #[inline]
    pub const fn default_page() -> i64 {
        1
    }

    #[inline]
    pub const fn default_per_page() -> i64 {
        25
    }
}

impl<T: Serialize> Pagination<T> {
    pub async fn async_map<R: serde::Serialize, Fut: Future<Output = R>>(
        self,
        mapper: impl Fn(T) -> Fut,
    ) -> Pagination<R> {
        let mut results = Vec::new();
        results.reserve_exact(self.data.len());
        let mut result_stream =
            futures_util::stream::iter(self.data.into_iter().map(mapper)).buffered(25);

        while let Some(result) = result_stream.next().await {
            results.push(result);
        }

        Pagination {
            total: self.total,
            per_page: self.per_page,
            page: self.page,
            data: results,
        }
    }

    pub async fn try_async_map<R: serde::Serialize, E, Fut: Future<Output = Result<R, E>>>(
        self,
        mapper: impl Fn(T) -> Fut,
    ) -> Result<Pagination<R>, E> {
        let mut results = Vec::new();
        results.reserve_exact(self.data.len());
        let mut result_stream =
            futures_util::stream::iter(self.data.into_iter().map(mapper)).buffered(25);

        while let Some(result) = result_stream.try_next().await? {
            results.push(result);
        }

        Ok(Pagination {
            total: self.total,
            per_page: self.per_page,
            page: self.page,
            data: results,
        })
    }
}

pub type ModelExtensionList = parking_lot::RwLock<Vec<Box<dyn ModelExtension + Send + Sync>>>;
pub type ModelExtensionData = Vec<(compact_str::CompactString, Vec<u8>)>;
pub type ModelExtensionMapType = Box<dyn erased_serde::Serialize>;

pub trait ModelExtension {
    fn extension_name(&self) -> &'static str;

    fn extended_columns(&self, prefix: &str) -> BTreeMap<&'static str, compact_str::CompactString>;

    fn map_extended(
        &self,
        prefix: &str,
        row: &PgRow,
    ) -> Result<ModelExtensionMapType, crate::database::DatabaseError>;
}

pub trait SafeModelExtension: ModelExtension {
    type Value: Serialize + DeserializeOwned;

    fn name() -> &'static str;
}

pub trait BaseModel: Serialize + DeserializeOwned {
    const NAME: &'static str;

    fn get_extension_list() -> &'static ModelExtensionList;
    fn get_extension_data(&self) -> &ModelExtensionData;

    /// Registers a model extension. If an extension with the same name is already registered, this function will do nothing.
    fn register_model_extension(extension: impl ModelExtension + Send + Sync + 'static) {
        let mut extensions = Self::get_extension_list().write();

        if extensions
            .iter()
            .any(|e| e.extension_name() == extension.extension_name())
        {
            return;
        }

        extensions.push(Box::new(extension));
    }

    /// Parses a model extension from the model's extension data. If the extension is not found, or if the data cannot be deserialized, an error is returned.
    ///
    /// This can be costly depending on what is stored, so use sparingly.
    fn parse_model_extension<Extension: SafeModelExtension>(
        &self,
    ) -> Result<Extension::Value, crate::database::DatabaseError>
    where
        Extension::Value: Serialize + DeserializeOwned,
    {
        let data = self.get_extension_data();

        for (name, value) in data.iter() {
            if name.as_str() == Extension::name() {
                let deserialized =
                    rmp_serde::from_slice::<Extension::Value>(value).map_err(anyhow::Error::new)?;

                return Ok(deserialized);
            }
        }

        Err(crate::database::DatabaseError::Any(anyhow::anyhow!(
            "model extension not found"
        )))
    }

    fn base_columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString>;
    fn columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString> {
        let extensions = Self::get_extension_list().read();

        let mut columns = Self::base_columns(prefix);

        for extension in extensions.iter() {
            columns.extend(extension.extended_columns(prefix.unwrap_or_default()));
        }

        columns
    }

    #[inline]
    fn columns_sql(prefix: Option<&str>) -> compact_str::CompactString {
        Self::columns(prefix)
            .iter()
            .map(|(key, value)| compact_str::format_compact!("{key} as {value}"))
            .join_compact(", ")
    }

    fn map_extensions(
        prefix: &str,
        row: &PgRow,
    ) -> Result<ModelExtensionData, crate::database::DatabaseError> {
        let mut data = Vec::new();

        let extensions = Self::get_extension_list().read();
        for extension in extensions.iter() {
            let value = extension.map_extended(prefix, row)?;
            let serialized = rmp_serde::to_vec(&value).map_err(anyhow::Error::new)?;

            data.push((
                compact_str::CompactString::const_new(extension.extension_name()),
                serialized,
            ));
        }

        Ok(data)
    }

    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError>;
}

#[async_trait::async_trait]
pub trait EventEmittingModel: BaseModel {
    type Event: Send + Sync + 'static;

    fn get_event_emitter() -> &'static crate::events::EventEmitter<Self::Event>;

    async fn register_event_handler<
        F: Fn(crate::State, Arc<Self::Event>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<(), anyhow::Error>> + Send + 'static,
    >(
        listener: F,
    ) -> crate::events::EventHandlerHandle {
        Self::get_event_emitter()
            .register_event_handler(listener)
            .await
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    fn blocking_register_event_handler<
        F: Fn(crate::State, Arc<Self::Event>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<(), anyhow::Error>> + Send + 'static,
    >(
        listener: F,
    ) -> crate::events::EventHandlerHandle {
        Self::get_event_emitter().blocking_register_event_handler(listener)
    }
}

type CreateHandlerResult<'a> =
    Pin<Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>>;
type CreateHandler<M> = dyn for<'a> Fn(
        &'a mut <M as CreatableModel>::CreateOptions<'_>,
        &'a mut InsertQueryBuilder,
        &'a crate::State,
        &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> CreateHandlerResult<'a>
    + Send
    + Sync;
type CreateAfterHandler<M> = dyn for<'a> Fn(
        &'a mut <M as CreatableModel>::CreateResult,
        &'a <M as CreatableModel>::CreateOptions<'_>,
        &'a crate::State,
        &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> CreateHandlerResult<'a>
    + Send
    + Sync;
pub type CreateListenerList<M> =
    Arc<ModelHandlerList<Box<CreateHandler<M>>, Box<CreateAfterHandler<M>>>>;

#[async_trait::async_trait]
pub trait CreatableModel: BaseModel + Send + Sync + 'static {
    type CreateOptions<'a>: Send + Sync + Validate;
    type CreateResult: Send;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>>;

    async fn register_create_handler<
        F: for<'a> Fn(
                &'a mut Self::CreateOptions<'_>,
                &'a mut InsertQueryBuilder,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> Pin<
                Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>,
            > + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<CreateHandler<Self>>;

        Self::get_create_handlers()
            .register_handler(priority, erased)
            .await;
    }

    async fn register_after_create_handler<
        F: for<'a> Fn(
                &'a mut Self::CreateResult,
                &'a Self::CreateOptions<'_>,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> Pin<
                Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>,
            > + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<CreateAfterHandler<Self>>;

        Self::get_create_handlers()
            .register_after_handler(priority, erased)
            .await;
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    fn blocking_register_create_handler<
        F: for<'a> Fn(
                &'a mut Self::CreateOptions<'_>,
                &'a mut InsertQueryBuilder,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> Pin<
                Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>,
            > + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<CreateHandler<Self>>;

        Self::get_create_handlers().blocking_register_handler(priority, erased);
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    fn blocking_register_after_create_handler<
        F: for<'a> Fn(
                &'a mut Self::CreateResult,
                &'a Self::CreateOptions<'_>,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> Pin<
                Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>,
            > + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<CreateAfterHandler<Self>>;

        Self::get_create_handlers().blocking_register_after_handler(priority, erased);
    }

    async fn run_create_handlers(
        options: &mut Self::CreateOptions<'_>,
        query_builder: &mut InsertQueryBuilder,
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        let listeners = Self::get_create_handlers().before_handlers.read().await;

        for listener in listeners.iter() {
            (*listener.callback)(options, query_builder, state, transaction).await?;
        }

        Ok(())
    }

    async fn run_after_create_handlers(
        result: &mut Self::CreateResult,
        options: &Self::CreateOptions<'_>,
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        let listeners = Self::get_create_handlers().after_handlers.read().await;

        for listener in listeners.iter() {
            (*listener.callback)(result, options, state, transaction).await?;
        }

        Ok(())
    }

    async fn create_with_transaction(
        state: &crate::State,
        options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError>;

    async fn create(
        state: &crate::State,
        options: Self::CreateOptions<'_>,
    ) -> Result<Self::CreateResult, crate::database::DatabaseError> {
        let mut transaction = state.database.write().begin().await?;

        let result = match Self::create_with_transaction(state, options, &mut transaction).await {
            Ok(result) => result,
            Err(err) => {
                transaction.rollback().await?;
                return Err(err);
            }
        };

        transaction.commit().await?;

        Ok(result)
    }
}

type UpdateHandlerResult<'a> =
    Pin<Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>>;
type UpdateHandler<M> = dyn for<'a> Fn(
        &'a mut M,
        &'a mut <M as UpdatableModel>::UpdateOptions,
        &'a mut UpdateQueryBuilder,
        &'a crate::State,
        &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> UpdateHandlerResult<'a>
    + Send
    + Sync;
type UpdateAfterHandler<M> = dyn for<'a> Fn(
        &'a mut M,
        &'a crate::State,
        &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> UpdateHandlerResult<'a>
    + Send
    + Sync;
pub type UpdateHandlerList<M> =
    Arc<ModelHandlerList<Box<UpdateHandler<M>>, Box<UpdateAfterHandler<M>>>>;

#[async_trait::async_trait]
pub trait UpdatableModel: BaseModel + Send + Sync + 'static {
    type UpdateOptions: Send + Sync + Default + ToSchema + DeserializeOwned + Serialize + Validate;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>>;

    async fn register_update_handler<
        F: for<'a> Fn(
                &'a mut Self,
                &'a mut Self::UpdateOptions,
                &'a mut UpdateQueryBuilder,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> Pin<
                Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>,
            > + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<UpdateHandler<Self>>;

        Self::get_update_handlers()
            .register_handler(priority, erased)
            .await;
    }

    async fn register_after_update_handler<
        F: for<'a> Fn(
                &'a mut Self,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> Pin<
                Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>,
            > + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<UpdateAfterHandler<Self>>;

        Self::get_update_handlers()
            .register_after_handler(priority, erased)
            .await;
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    fn blocking_register_update_handler<
        F: for<'a> Fn(
                &'a mut Self,
                &'a mut Self::UpdateOptions,
                &'a mut UpdateQueryBuilder,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> Pin<
                Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>,
            > + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<UpdateHandler<Self>>;

        Self::get_update_handlers().blocking_register_handler(priority, erased);
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    fn blocking_register_after_update_handler<
        F: for<'a> Fn(
                &'a mut Self,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> Pin<
                Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>,
            > + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<UpdateAfterHandler<Self>>;

        Self::get_update_handlers().blocking_register_after_handler(priority, erased);
    }

    async fn run_update_handlers(
        &mut self,
        options: &mut Self::UpdateOptions,
        query_builder: &mut UpdateQueryBuilder,
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        let listeners = Self::get_update_handlers().before_handlers.read().await;

        for listener in listeners.iter() {
            (*listener.callback)(self, options, query_builder, state, transaction).await?;
        }

        Ok(())
    }

    async fn run_after_update_handlers(
        &mut self,
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        let listeners = Self::get_update_handlers().after_handlers.read().await;

        for listener in listeners.iter() {
            (*listener.callback)(self, state, transaction).await?;
        }

        Ok(())
    }

    async fn update_with_transaction(
        &mut self,
        state: &crate::State,
        options: Self::UpdateOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError>;

    async fn update(
        &mut self,
        state: &crate::State,
        options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        let mut transaction = state.database.write().begin().await?;

        if let Err(err) = self
            .update_with_transaction(state, options, &mut transaction)
            .await
        {
            transaction.rollback().await?;
            return Err(err);
        }

        transaction.commit().await?;

        Ok(())
    }
}

type DeleteHandlerResult<'a> = Pin<Box<dyn Future<Output = Result<(), anyhow::Error>> + Send + 'a>>;
type DeleteHandler<M> = dyn for<'a> Fn(
        &'a M,
        &'a <M as DeletableModel>::DeleteOptions,
        &'a crate::State,
        &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> DeleteHandlerResult<'a>
    + Send
    + Sync;
type DeleteAfterHandler<M> = dyn for<'a> Fn(
        &'a M,
        &'a <M as DeletableModel>::DeleteOptions,
        &'a crate::State,
        &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> DeleteHandlerResult<'a>
    + Send
    + Sync;
pub type DeleteHandlerList<M> =
    Arc<ModelHandlerList<Box<DeleteHandler<M>>, Box<DeleteAfterHandler<M>>>>;

#[async_trait::async_trait]
pub trait DeletableModel: BaseModel + Send + Sync + 'static {
    type DeleteOptions: Send + Sync + Default + Clone;

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>>;

    async fn register_delete_handler<
        F: for<'a> Fn(
                &'a Self,
                &'a Self::DeleteOptions,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            )
                -> Pin<Box<dyn Future<Output = Result<(), anyhow::Error>> + Send + 'a>>
            + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<DeleteHandler<Self>>;

        Self::get_delete_handlers()
            .register_handler(priority, erased)
            .await;
    }

    async fn register_after_delete_handler<
        F: for<'a> Fn(
                &'a Self,
                &'a Self::DeleteOptions,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            )
                -> Pin<Box<dyn Future<Output = Result<(), anyhow::Error>> + Send + 'a>>
            + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<DeleteAfterHandler<Self>>;

        Self::get_delete_handlers()
            .register_after_handler(priority, erased)
            .await;
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    fn blocking_register_delete_handler<
        F: for<'a> Fn(
                &'a Self,
                &'a Self::DeleteOptions,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            )
                -> Pin<Box<dyn Future<Output = Result<(), anyhow::Error>> + Send + 'a>>
            + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<DeleteHandler<Self>>;

        Self::get_delete_handlers().blocking_register_handler(priority, erased);
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    fn blocking_register_after_delete_handler<
        F: for<'a> Fn(
                &'a Self,
                &'a Self::DeleteOptions,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            )
                -> Pin<Box<dyn Future<Output = Result<(), anyhow::Error>> + Send + 'a>>
            + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<DeleteAfterHandler<Self>>;

        Self::get_delete_handlers().blocking_register_after_handler(priority, erased);
    }

    async fn run_delete_handlers(
        &self,
        options: &Self::DeleteOptions,
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        let listeners = Self::get_delete_handlers().before_handlers.read().await;

        for listener in listeners.iter() {
            (*listener.callback)(self, options, state, transaction).await?;
        }

        Ok(())
    }

    async fn run_after_delete_handlers(
        &self,
        options: &Self::DeleteOptions,
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        let listeners = Self::get_delete_handlers().after_handlers.read().await;

        for listener in listeners.iter() {
            (*listener.callback)(self, options, state, transaction).await?;
        }

        Ok(())
    }

    async fn delete_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error>;

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let mut transaction = state.database.write().begin().await?;

        if let Err(err) = self
            .delete_with_transaction(state, options, &mut transaction)
            .await
        {
            transaction.rollback().await?;
            return Err(err);
        }

        transaction.commit().await?;

        Ok(())
    }
}

type DuplicateHandlerResult<'a> =
    Pin<Box<dyn Future<Output = Result<(), crate::database::DatabaseError>> + Send + 'a>>;
type DuplicateHandler<M> = dyn for<'a> Fn(
        &'a M,
        &'a <M as DuplicableModel>::DuplicateOptions<'_>,
        &'a crate::State,
        &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> DuplicateHandlerResult<'a>
    + Send
    + Sync;
type DuplicateAfterHandler<M> = dyn for<'a> Fn(
        &'a M,
        &'a mut M,
        &'a <M as DuplicableModel>::DuplicateOptions<'_>,
        &'a crate::State,
        &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> DuplicateHandlerResult<'a>
    + Send
    + Sync;
pub type DuplicateHandlerList<M> =
    Arc<ModelHandlerList<Box<DuplicateHandler<M>>, Box<DuplicateAfterHandler<M>>>>;

#[async_trait::async_trait]
pub trait DuplicableModel: BaseModel + Send + Sync + 'static {
    type DuplicateOptions<'a>: Send + Sync + Validate;

    fn get_duplicate_handlers() -> &'static LazyLock<DuplicateHandlerList<Self>>;

    async fn register_duplicate_handler<
        F: for<'a> Fn(
                &'a Self,
                &'a Self::DuplicateOptions<'_>,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> DuplicateHandlerResult<'a>
            + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<DuplicateHandler<Self>>;

        Self::get_duplicate_handlers()
            .register_handler(priority, erased)
            .await;
    }

    async fn register_after_duplicate_handler<
        F: for<'a> Fn(
                &'a Self,
                &'a mut Self,
                &'a Self::DuplicateOptions<'_>,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> DuplicateHandlerResult<'a>
            + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<DuplicateAfterHandler<Self>>;

        Self::get_duplicate_handlers()
            .register_after_handler(priority, erased)
            .await;
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    fn blocking_register_duplicate_handler<
        F: for<'a> Fn(
                &'a Self,
                &'a Self::DuplicateOptions<'_>,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> DuplicateHandlerResult<'a>
            + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<DuplicateHandler<Self>>;

        Self::get_duplicate_handlers().blocking_register_handler(priority, erased);
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    fn blocking_register_after_duplicate_handler<
        F: for<'a> Fn(
                &'a Self,
                &'a mut Self,
                &'a Self::DuplicateOptions<'_>,
                &'a crate::State,
                &'a mut sqlx::Transaction<'_, sqlx::Postgres>,
            ) -> DuplicateHandlerResult<'a>
            + Send
            + Sync
            + 'static,
    >(
        priority: ListenerPriority,
        callback: F,
    ) {
        let erased = Box::new(callback) as Box<DuplicateAfterHandler<Self>>;

        Self::get_duplicate_handlers().blocking_register_after_handler(priority, erased);
    }

    async fn run_duplicate_handlers(
        &self,
        options: &Self::DuplicateOptions<'_>,
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        let listeners = Self::get_duplicate_handlers().before_handlers.read().await;

        for listener in listeners.iter() {
            (*listener.callback)(self, options, state, transaction).await?;
        }

        Ok(())
    }

    async fn run_after_duplicate_handlers(
        &self,
        duplicated: &mut Self,
        options: &Self::DuplicateOptions<'_>,
        state: &crate::State,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        let listeners = Self::get_duplicate_handlers().after_handlers.read().await;

        for listener in listeners.iter() {
            (*listener.callback)(self, duplicated, options, state, transaction).await?;
        }

        Ok(())
    }

    async fn duplicate_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DuplicateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError>;

    async fn duplicate(
        &self,
        state: &crate::State,
        options: Self::DuplicateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        let mut transaction = state.database.write().begin().await?;

        let duplicated = match self
            .duplicate_with_transaction(state, options, &mut transaction)
            .await
        {
            Ok(duplicated) => duplicated,
            Err(err) => {
                transaction.rollback().await?;
                return Err(err);
            }
        };

        transaction.commit().await?;

        Ok(duplicated)
    }
}

#[async_trait::async_trait]
pub trait ByUuid: BaseModel {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, DatabaseError>;

    async fn by_uuid_with_transaction(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        uuid: uuid::Uuid,
    ) -> Result<Self, DatabaseError>;

    async fn by_uuid_cached(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, anyhow::Error> {
        database
            .cache
            .cached(&format!("{}::{uuid}", Self::NAME), 10, || {
                Self::by_uuid(database, uuid)
            })
            .await
    }

    async fn by_uuid_optional(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, DatabaseError> {
        match Self::by_uuid(database, uuid).await {
            Ok(res) => Ok(Some(res)),
            Err(DatabaseError::Sqlx(sqlx::Error::RowNotFound)) => Ok(None),
            Err(err) => Err(err),
        }
    }

    async fn by_uuid_optional_with_transaction(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, DatabaseError> {
        match Self::by_uuid_with_transaction(transaction, uuid).await {
            Ok(res) => Ok(Some(res)),
            Err(DatabaseError::Sqlx(sqlx::Error::RowNotFound)) => Ok(None),
            Err(err) => Err(err),
        }
    }

    async fn by_uuid_optional_cached(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, anyhow::Error> {
        match Self::by_uuid_cached(database, uuid).await {
            Ok(res) => Ok(Some(res)),
            Err(err) => {
                if let Some(DatabaseError::Sqlx(sqlx::Error::RowNotFound)) =
                    err.downcast_ref::<DatabaseError>()
                {
                    Ok(None)
                } else {
                    Err(err)
                }
            }
        }
    }

    #[inline]
    fn get_fetchable(uuid: uuid::Uuid) -> Fetchable<Self> {
        Fetchable {
            uuid,
            _model: PhantomData,
        }
    }

    #[inline]
    fn get_fetchable_from_row(row: &PgRow, column: impl AsRef<str>) -> Option<Fetchable<Self>> {
        match row.try_get(column.as_ref()) {
            Ok(uuid) => Some(Fetchable {
                uuid,
                _model: PhantomData,
            }),
            Err(_) => None,
        }
    }
}

#[derive(Default, Debug, Clone, Copy, PartialEq, Eq)]
pub enum ListenerPriority {
    Highest,
    High,
    #[default]
    Normal,
    Low,
    Lowest,
}

impl ListenerPriority {
    #[inline]
    fn rank(self) -> u8 {
        match self {
            Self::Highest => 5,
            Self::High => 4,
            Self::Normal => 3,
            Self::Low => 2,
            Self::Lowest => 1,
        }
    }
}

impl PartialOrd for ListenerPriority {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for ListenerPriority {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        let self_rank = self.rank();
        let other_rank = other.rank();

        other_rank.cmp(&self_rank)
    }
}

#[async_trait::async_trait]
impl<F: Send + Sync, AfterF: Send + Sync> crate::events::DisconnectEventHandler
    for ModelHandlerList<F, AfterF>
{
    #[inline]
    async fn disconnect(&self, id: uuid::Uuid) {
        self.before_handlers.write().await.retain(|l| l.uuid != id);
        self.after_handlers.write().await.retain(|l| l.uuid != id);
    }

    #[inline]
    fn blocking_disconnect(&self, id: uuid::Uuid) {
        self.before_handlers
            .blocking_write()
            .retain(|l| l.uuid != id);
        self.after_handlers
            .blocking_write()
            .retain(|l| l.uuid != id);
    }
}

pub struct ModelHandlerList<F: Send + Sync + 'static, AfterF: Send + Sync + 'static> {
    before_handlers: RwLock<Vec<ModelHandler<F>>>,
    after_handlers: RwLock<Vec<ModelHandler<AfterF>>>,
}

impl<F: Send + Sync + 'static, AfterF: Send + Sync + 'static> Default
    for ModelHandlerList<F, AfterF>
{
    fn default() -> Self {
        Self {
            before_handlers: RwLock::new(Vec::new()),
            after_handlers: RwLock::new(Vec::new()),
        }
    }
}

impl<F: Send + Sync + 'static, AfterF: Send + Sync + 'static> ModelHandlerList<F, AfterF> {
    pub async fn register_handler(
        self: &Arc<Self>,
        priority: ListenerPriority,
        callback: F,
    ) -> ModelHandlerHandle {
        let (listener, aborter) = ModelHandler::new(callback, priority, self.clone());

        let mut self_listeners = self.before_handlers.write().await;
        self_listeners.push(listener);
        self_listeners.sort_by_key(|a| a.priority);

        aborter
    }

    pub async fn register_after_handler(
        self: &Arc<Self>,
        priority: ListenerPriority,
        callback: AfterF,
    ) -> ModelHandlerHandle {
        let (listener, aborter) = ModelHandler::new(callback, priority, self.clone());

        let mut self_listeners = self.after_handlers.write().await;
        self_listeners.push(listener);
        self_listeners.sort_by_key(|a| a.priority);

        aborter
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    pub fn blocking_register_handler(
        self: &Arc<Self>,
        priority: ListenerPriority,
        callback: F,
    ) -> ModelHandlerHandle {
        let (listener, aborter) = ModelHandler::new(callback, priority, self.clone());

        let mut self_listeners = self.before_handlers.blocking_write();
        self_listeners.push(listener);
        self_listeners.sort_by_key(|a| a.priority);

        aborter
    }

    /// # Warning
    /// This method will block the current thread if the lock is not available
    pub fn blocking_register_after_handler(
        self: &Arc<Self>,
        priority: ListenerPriority,
        callback: AfterF,
    ) -> ModelHandlerHandle {
        let (listener, aborter) = ModelHandler::new(callback, priority, self.clone());

        let mut self_listeners = self.after_handlers.blocking_write();
        self_listeners.push(listener);
        self_listeners.sort_by_key(|a| a.priority);

        aborter
    }
}

pub struct ModelHandler<F: Send + Sync + 'static> {
    uuid: uuid::Uuid,
    priority: ListenerPriority,

    pub callback: F,
}

impl<F: Send + Sync + 'static> ModelHandler<F> {
    pub(crate) fn new(
        callback: F,
        priority: ListenerPriority,
        list: Arc<dyn crate::events::DisconnectEventHandler + Send + Sync>,
    ) -> (Self, ModelHandlerHandle) {
        let handler = Self {
            uuid: uuid::Uuid::new_v4(),
            priority,
            callback,
        };
        let handle = ModelHandlerHandle {
            list_ref: list,
            id: handler.uuid,
        };
        (handler, handle)
    }
}

pub struct ModelHandlerHandle {
    list_ref: Arc<dyn crate::events::DisconnectEventHandler + Send + Sync>,
    id: uuid::Uuid,
}

impl ModelHandlerHandle {
    pub async fn disconnect(&self) {
        self.list_ref.disconnect(self.id).await;
    }

    /// # Warning
    /// This method will block the current thread if the lists' lock is not available
    pub fn blocking_disconnect(&self) {
        self.list_ref.blocking_disconnect(self.id);
    }
}

#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct Fetchable<M: ByUuid> {
    pub uuid: uuid::Uuid,
    #[serde(skip)]
    _model: PhantomData<M>,
}

impl<M: ByUuid + Send> Fetchable<M> {
    #[inline]
    pub async fn fetch(&self, database: &crate::database::Database) -> Result<M, DatabaseError> {
        M::by_uuid(database, self.uuid).await
    }

    #[inline]
    pub async fn fetch_cached(
        &self,
        database: &crate::database::Database,
    ) -> Result<M, anyhow::Error> {
        M::by_uuid_cached(database, self.uuid).await
    }

    #[inline]
    pub async fn fetch_optional(
        &self,
        database: &crate::database::Database,
    ) -> Result<Option<M>, DatabaseError> {
        M::by_uuid_optional(database, self.uuid).await
    }

    #[inline]
    pub async fn fetch_optional_cached(
        &self,
        database: &crate::database::Database,
    ) -> Result<Option<M>, anyhow::Error> {
        M::by_uuid_optional_cached(database, self.uuid).await
    }
}

pub struct InsertQueryBuilder<'a> {
    table: &'a str,
    columns: Vec<&'a str>,
    expressions: Vec<String>,
    arguments: PgArguments,
    returning_clause: Option<&'a str>,
}

impl<'a> InsertQueryBuilder<'a> {
    pub fn new(table: &'a str) -> Self {
        Self {
            table,
            columns: Vec::new(),
            expressions: Vec::new(),
            arguments: PgArguments::default(),
            returning_clause: None,
        }
    }

    pub fn set<T: 'a + sqlx::Encode<'a, Postgres> + sqlx::Type<Postgres> + Send>(
        &mut self,
        column: &'a str,
        value: T,
    ) -> &mut Self {
        if self.columns.contains(&column) {
            return self;
        }

        if self.arguments.add(value).is_ok() {
            self.columns.push(column);
            let idx = self.arguments.len();
            self.expressions.push(format!("${}", idx));
        }

        self
    }

    pub fn set_expr<T: 'a + sqlx::Encode<'a, Postgres> + sqlx::Type<Postgres> + Send>(
        &mut self,
        column: &'a str,
        expression: &str,
        values: Vec<T>,
    ) -> &mut Self {
        if self.columns.contains(&column) {
            return self;
        }

        let start_len = self.arguments.len();

        for value in values {
            if self.arguments.add(value).is_err() {
                return self;
            }
        }

        let mut expr = expression.to_string();
        let added_count = self.arguments.len() - start_len;

        for i in (1..=added_count).rev() {
            let global_idx = start_len + i;
            expr = expr.replace(&format!("${}", i), &format!("${}", global_idx));
        }

        self.columns.push(column);
        self.expressions.push(expr);

        self
    }

    pub fn returning(mut self, clause: &'a str) -> Self {
        self.returning_clause = Some(clause);
        self
    }

    fn build_sql(&self) -> String {
        let columns_sql = self.columns.join(", ");
        let values_sql = self.expressions.join(", ");

        let mut sql = format!(
            "INSERT INTO {} ({}) VALUES ({})",
            self.table, columns_sql, values_sql
        );

        if let Some(clause) = self.returning_clause {
            sql.push_str(" RETURNING ");
            sql.push_str(clause);
        }

        sql
    }

    pub async fn execute(
        self,
        executor: impl sqlx::Executor<'a, Database = Postgres>,
    ) -> Result<sqlx::postgres::PgQueryResult, sqlx::Error> {
        let sql = self.build_sql();
        sqlx::query_with(sqlx::AssertSqlSafe(sql), self.arguments)
            .execute(executor)
            .await
    }

    pub async fn fetch_one(
        self,
        executor: impl sqlx::Executor<'a, Database = Postgres>,
    ) -> Result<sqlx::postgres::PgRow, sqlx::Error> {
        let sql = self.build_sql();
        sqlx::query_with(sqlx::AssertSqlSafe(sql), self.arguments)
            .fetch_one(executor)
            .await
    }
}

pub struct UpdateQueryBuilder<'a> {
    builder: QueryBuilder<Postgres>,
    updated_fields: HashSet<&'a str>,
    has_set_fields: bool,
    has_where: bool,
}

impl<'a> UpdateQueryBuilder<'a> {
    pub fn new(table: &'a str) -> Self {
        let mut builder = QueryBuilder::new("UPDATE ");
        builder.push(table);
        builder.push(" SET ");

        Self {
            builder,
            updated_fields: HashSet::new(),
            has_set_fields: false,
            has_where: false,
        }
    }

    /// Adds a field to be updated, if `None`, will not add the field
    /// To set a field to null (`None`), you need a `Some(None)`
    pub fn set<T: 'a + sqlx::Encode<'a, Postgres> + sqlx::Type<Postgres> + Send>(
        &mut self,
        column: &'a str,
        value: Option<T>,
    ) -> &mut Self {
        let Some(value) = value else {
            return self;
        };

        if !self.updated_fields.insert(column) {
            return self;
        }

        if self.has_set_fields {
            self.builder.push(", ");
        }

        self.builder.push(column);
        self.builder.push(" = ");
        self.builder.push_bind(value);

        self.has_set_fields = true;
        self
    }

    pub fn where_eq<T: 'a + sqlx::Encode<'a, Postgres> + sqlx::Type<Postgres> + Send>(
        &mut self,
        column: &'a str,
        value: T,
    ) -> &mut Self {
        if self.has_where {
            self.builder.push(" AND ");
        } else {
            self.builder.push(" WHERE ");
            self.has_where = true;
        }

        self.builder.push(column);
        self.builder.push(" = ");
        self.builder.push_bind(value);
        self
    }

    pub async fn execute(
        mut self,
        executor: impl sqlx::Executor<'a, Database = Postgres>,
    ) -> Result<sqlx::any::AnyQueryResult, sqlx::Error> {
        if !self.has_set_fields {
            return Ok(sqlx::any::AnyQueryResult::default());
        }

        let query = self.builder.build();
        query.execute(executor).await.map(|r| r.into())
    }
}

/// SQLx helper type to preserve order of keys when encoding JSON. By default, SQLx encodes JSON using `serde_json::Value`, which does not preserve order of keys. This type allows you to encode any serializable type as JSON while preserving the order of keys.
pub struct OrderedJson<T>(pub T);

impl<T: Serialize> sqlx::Encode<'_, sqlx::Postgres> for OrderedJson<T> {
    fn encode_by_ref(&self, buf: &mut PgArgumentBuffer) -> Result<IsNull, BoxDynError> {
        serde_json::to_writer(&mut **buf, &self.0)?;
        Ok(IsNull::No)
    }
}

impl<T> sqlx::Type<sqlx::Postgres> for OrderedJson<T> {
    fn type_info() -> PgTypeInfo {
        // JSON, not JSONB, to preserve order of keys
        PgTypeInfo::with_oid(sqlx::postgres::types::Oid(114))
    }
}

#[async_trait::async_trait]
pub trait IntoApiObject {
    type ApiObject: Send;
    type ExtraArgs<'a>: Send;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, DatabaseError>;
}

#[async_trait::async_trait]
pub trait IntoAdminApiObject {
    type AdminApiObject: Send;
    type ExtraArgs<'a>: Send;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, DatabaseError>;
}
