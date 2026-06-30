use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow, prelude::Type};
use std::{
    collections::BTreeMap,
    hash::Hash,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "announcement_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AnnouncementType {
    Info,
    Success,
    Warning,
    Error,
}

pub fn validate_title_translations(
    title_translations: &BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    _context: &(),
) -> Result<(), garde::Error> {
    if title_translations.len() > 512 {
        return Err(garde::Error::new("cannot have more than 512 entries"));
    }

    for (lang, translation) in title_translations {
        if lang.len() < 2 || lang.len() > 15 {
            return Err(garde::Error::new(format!(
                "language code '{}' must be between 2 and 15 characters",
                lang
            )));
        }
        if translation.is_empty() || translation.len() > 255 {
            return Err(garde::Error::new(format!(
                "translation for language '{}' must be between 1 and 255 characters",
                lang
            )));
        }
    }

    Ok(())
}

pub fn validate_content_translations(
    content_translations: &BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    _context: &(),
) -> Result<(), garde::Error> {
    if content_translations.len() > 512 {
        return Err(garde::Error::new("cannot have more than 512 entries"));
    }

    for (lang, translation) in content_translations {
        if lang.len() < 2 || lang.len() > 15 {
            return Err(garde::Error::new(format!(
                "language code '{}' must be between 2 and 15 characters",
                lang
            )));
        }
        if translation.is_empty() || translation.len() > 2048 {
            return Err(garde::Error::new(format!(
                "translation for language '{}' must be between 1 and 2048 characters",
                lang
            )));
        }
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Announcement {
    pub uuid: uuid::Uuid,

    pub r#type: AnnouncementType,
    pub enabled: bool,
    pub enabled_start: Option<chrono::NaiveDateTime>,
    pub enabled_end: Option<chrono::NaiveDateTime>,
    pub dismissible: bool,
    pub dismissible_end: Option<chrono::NaiveDateTime>,

    pub title: compact_str::CompactString,
    pub title_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    pub content: compact_str::CompactString,
    pub content_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,

    pub locations: Vec<uuid::Uuid>,
    pub nodes: Vec<uuid::Uuid>,
    pub backup_configurations: Vec<uuid::Uuid>,
    pub eggs: Vec<uuid::Uuid>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for Announcement {
    const NAME: &'static str = "announcement";

    fn get_extension_list() -> &'static super::ModelExtensionList {
        static EXTENSIONS: LazyLock<super::ModelExtensionList> =
            LazyLock::new(|| parking_lot::RwLock::new(Vec::new()));

        &EXTENSIONS
    }

    fn get_extension_data(&self) -> &super::ModelExtensionData {
        &self.extension_data
    }

    #[inline]
    fn base_columns(prefix: Option<&str>) -> BTreeMap<&'static str, compact_str::CompactString> {
        let prefix = prefix.unwrap_or_default();

        BTreeMap::from([
            (
                "announcements.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "announcements.type",
                compact_str::format_compact!("{prefix}type"),
            ),
            (
                "announcements.enabled",
                compact_str::format_compact!("{prefix}enabled"),
            ),
            (
                "announcements.enabled_start",
                compact_str::format_compact!("{prefix}enabled_start"),
            ),
            (
                "announcements.enabled_end",
                compact_str::format_compact!("{prefix}enabled_end"),
            ),
            (
                "announcements.dismissible",
                compact_str::format_compact!("{prefix}dismissible"),
            ),
            (
                "announcements.dismissible_end",
                compact_str::format_compact!("{prefix}dismissible_end"),
            ),
            (
                "announcements.title",
                compact_str::format_compact!("{prefix}title"),
            ),
            (
                "announcements.title_translations",
                compact_str::format_compact!("{prefix}title_translations"),
            ),
            (
                "announcements.content",
                compact_str::format_compact!("{prefix}content"),
            ),
            (
                "announcements.content_translations",
                compact_str::format_compact!("{prefix}content_translations"),
            ),
            (
                "announcements.locations",
                compact_str::format_compact!("{prefix}locations"),
            ),
            (
                "announcements.nodes",
                compact_str::format_compact!("{prefix}nodes"),
            ),
            (
                "announcements.backup_configurations",
                compact_str::format_compact!("{prefix}backup_configurations"),
            ),
            (
                "announcements.eggs",
                compact_str::format_compact!("{prefix}eggs"),
            ),
            (
                "announcements.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            r#type: row.try_get(compact_str::format_compact!("{prefix}type").as_str())?,
            enabled: row.try_get(compact_str::format_compact!("{prefix}enabled").as_str())?,
            enabled_start: row
                .try_get(compact_str::format_compact!("{prefix}enabled_start").as_str())?,
            enabled_end: row
                .try_get(compact_str::format_compact!("{prefix}enabled_end").as_str())?,
            dismissible: row
                .try_get(compact_str::format_compact!("{prefix}dismissible").as_str())?,
            dismissible_end: row
                .try_get(compact_str::format_compact!("{prefix}dismissible_end").as_str())?,
            title: row.try_get(compact_str::format_compact!("{prefix}title").as_str())?,
            title_translations: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}title_translations").as_str())?,
            )?,
            content: row.try_get(compact_str::format_compact!("{prefix}content").as_str())?,
            content_translations: serde_json::from_value(
                row.try_get(compact_str::format_compact!("{prefix}content_translations").as_str())?,
            )?,
            locations: row.try_get(compact_str::format_compact!("{prefix}locations").as_str())?,
            nodes: row.try_get(compact_str::format_compact!("{prefix}nodes").as_str())?,
            backup_configurations: row
                .try_get(compact_str::format_compact!("{prefix}backup_configurations").as_str())?,
            eggs: row.try_get(compact_str::format_compact!("{prefix}eggs").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl Announcement {
    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        let offset = (page - 1) * per_page;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}, COUNT(*) OVER() AS total_count
            FROM announcements
            WHERE ($1 IS NULL OR announcements.title ILIKE '%' || $1 || '%')
            ORDER BY announcements.created
            LIMIT $2 OFFSET $3
            "#,
            Self::columns_sql(None)
        )))
        .bind(search)
        .bind(per_page)
        .bind(offset)
        .fetch_all(database.read())
        .await?;

        Ok(super::Pagination {
            total: rows
                .first()
                .map_or(Ok(0), |row| row.try_get("total_count"))?,
            per_page,
            page,
            data: rows
                .into_iter()
                .map(|row| Self::map(None, &row))
                .try_collect_vec()?,
        })
    }

    pub async fn all_by_active(
        database: &crate::database::Database,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM announcements
            WHERE announcements.enabled = true
                AND (announcements.enabled_start IS NULL OR announcements.enabled_start <= NOW())
                AND (announcements.enabled_end IS NULL OR announcements.enabled_end >= NOW())
                AND array_length(announcements.locations, 1) IS NULL
                AND array_length(announcements.nodes, 1) IS NULL
                AND array_length(announcements.backup_configurations, 1) IS NULL
                AND array_length(announcements.eggs, 1) IS NULL
            ORDER BY announcements.created
            "#,
            Self::columns_sql(None)
        )))
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn all_by_active_server(
        database: &crate::database::Database,
        server: &super::server::Server,
    ) -> Result<Vec<Self>, crate::database::DatabaseError> {
        let node = server.node.fetch_cached(database).await?;

        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM announcements
            WHERE announcements.enabled = true
                AND (announcements.enabled_start IS NULL OR announcements.enabled_start <= NOW())
                AND (announcements.enabled_end IS NULL OR announcements.enabled_end >= NOW())
                AND (
                    array_length(announcements.locations, 1) IS NOT NULL
                    OR array_length(announcements.nodes, 1) IS NOT NULL
                    OR array_length(announcements.backup_configurations, 1) IS NOT NULL
                    OR array_length(announcements.eggs, 1) IS NOT NULL
                )
                AND (
                    (announcements.locations IS NULL OR $1 = ANY(announcements.locations))
                    OR (announcements.nodes IS NULL OR $2 = ANY(announcements.nodes))
                    OR ($3 IS NOT NULL AND (announcements.backup_configurations IS NULL OR $3 = ANY(announcements.backup_configurations)))
                    OR (announcements.eggs IS NULL OR $4 = ANY(announcements.eggs))
                )
            ORDER BY announcements.created
            "#,
            Self::columns_sql(None)
        )))
        .bind(node.location.uuid)
        .bind(node.uuid)
        .bind(server.backup_configuration.as_ref().map_or_else(
            || {
                node.backup_configuration.as_ref().map_or_else(
                    || node.location.backup_configuration.as_ref().map(|b| b.uuid),
                    |b| Some(b.uuid),
                )
            },
            |b| Some(b.uuid),
        ))
        .bind(server.egg.uuid)
        .fetch_all(database.read())
        .await?;

        rows.into_iter()
            .map(|row| Self::map(None, &row))
            .try_collect_vec()
    }

    pub async fn cleanup_uuid_arrays(
        database: &crate::database::Database,
    ) -> Result<u64, crate::database::DatabaseError> {
        let result = sqlx::query(
            "UPDATE announcements
            SET
                locations = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM unnest(locations) AS u
                        WHERE NOT EXISTS (SELECT 1 FROM locations WHERE uuid = u)
                    )
                    THEN COALESCE(
                        (SELECT array_agg(u) FROM unnest(locations) AS u
                        WHERE EXISTS (SELECT 1 FROM locations WHERE uuid = u)),
                        '{}'::uuid[]
                    )
                    ELSE locations
                END,
                nodes = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM unnest(nodes) AS u
                        WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE uuid = u)
                    )
                    THEN COALESCE(
                        (SELECT array_agg(u) FROM unnest(nodes) AS u
                        WHERE EXISTS (SELECT 1 FROM nodes WHERE uuid = u)),
                        '{}'::uuid[]
                    )
                    ELSE nodes
                END,
                backup_configurations = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM unnest(backup_configurations) AS u
                        WHERE NOT EXISTS (SELECT 1 FROM backup_configurations WHERE uuid = u)
                    )
                    THEN COALESCE(
                        (SELECT array_agg(u) FROM unnest(backup_configurations) AS u
                        WHERE EXISTS (SELECT 1 FROM backup_configurations WHERE uuid = u)),
                        '{}'::uuid[]
                    )
                    ELSE backup_configurations
                END,
                eggs = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM unnest(eggs) AS u
                        WHERE NOT EXISTS (SELECT 1 FROM nest_eggs WHERE uuid = u)
                    )
                    THEN COALESCE(
                        (SELECT array_agg(u) FROM unnest(eggs) AS u
                        WHERE EXISTS (SELECT 1 FROM nest_eggs WHERE uuid = u)),
                        '{}'::uuid[]
                    )
                    ELSE eggs
                END
            WHERE
                EXISTS (SELECT 1 FROM unnest(locations) AS u WHERE NOT EXISTS (SELECT 1 FROM locations WHERE uuid = u))
                OR EXISTS (SELECT 1 FROM unnest(nodes) AS u WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE uuid = u))
                OR EXISTS (SELECT 1 FROM unnest(backup_configurations) AS u WHERE NOT EXISTS (SELECT 1 FROM backup_configurations WHERE uuid = u))
                OR EXISTS (SELECT 1 FROM unnest(eggs) AS u WHERE NOT EXISTS (SELECT 1 FROM nest_eggs WHERE uuid = u))",
        )
        .execute(database.write())
        .await?;

        Ok(result.rows_affected())
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for Announcement {
    type AdminApiObject = AdminApiAnnouncement;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        mut self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiAnnouncement::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiAnnouncement {
                uuid: self.uuid,
                r#type: self.r#type,
                enabled: self.enabled,
                enabled_start: self.enabled_start.map(|dt| dt.and_utc()),
                enabled_end: self.enabled_end.map(|dt| dt.and_utc()),
                dismissible: self.dismissible,
                dismissible_end: self.dismissible_end.map(|dt| dt.and_utc()),
                title: self.title,
                title_translations: self.title_translations,
                content: self.content,
                content_translations: self.content_translations,
                locations: self.locations,
                nodes: self.nodes,
                backup_configurations: self.backup_configurations,
                eggs: self.eggs,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoApiObject for Announcement {
    type ApiObject = ApiAnnouncement;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiAnnouncement::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiAnnouncement {
                uuid: self.uuid,
                r#type: self.r#type,
                dismissible: self.dismissible,
                dismissible_end: self.dismissible_end.map(|dt| dt.and_utc()),
                title: self.title,
                title_translations: self.title_translations,
                content: self.content,
                content_translations: self.content_translations,
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for Announcement {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM announcements
            WHERE announcements.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(database.read())
        .await?;

        Self::map(None, &row)
    }

    async fn by_uuid_with_transaction(
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM announcements
            WHERE announcements.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateAnnouncementOptions {
    #[garde(skip)]
    pub r#type: AnnouncementType,

    #[garde(skip)]
    pub enabled: bool,
    #[garde(skip)]
    pub enabled_start: Option<chrono::DateTime<chrono::Utc>>,
    #[garde(skip)]
    pub enabled_end: Option<chrono::DateTime<chrono::Utc>>,
    #[garde(skip)]
    pub dismissible: bool,
    #[garde(skip)]
    pub dismissible_end: Option<chrono::DateTime<chrono::Utc>>,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub title: compact_str::CompactString,
    #[garde(custom(validate_title_translations))]
    pub title_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 2048))]
    #[schema(min_length = 1, max_length = 2048)]
    pub content: compact_str::CompactString,
    #[garde(custom(validate_content_translations))]
    pub content_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,

    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub locations: Vec<uuid::Uuid>,
    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub nodes: Vec<uuid::Uuid>,
    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub backup_configurations: Vec<uuid::Uuid>,
    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub eggs: Vec<uuid::Uuid>,
}

#[async_trait::async_trait]
impl CreatableModel for Announcement {
    type CreateOptions<'a> = CreateAnnouncementOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<Announcement>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("announcements");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("type", options.r#type)
            .set("enabled", options.enabled)
            .set("enabled_start", options.enabled_start)
            .set("enabled_end", options.enabled_end)
            .set("dismissible", options.dismissible)
            .set("dismissible_end", options.dismissible_end)
            .set("title", &options.title)
            .set(
                "title_translations",
                serde_json::to_value(&options.title_translations)?,
            )
            .set("content", &options.content)
            .set(
                "content_translations",
                serde_json::to_value(&options.content_translations)?,
            )
            .set("locations", &options.locations)
            .set("nodes", &options.nodes)
            .set("backup_configurations", &options.backup_configurations)
            .set("eggs", &options.eggs);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut announcement = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut announcement, &options, state, transaction).await?;

        Ok(announcement)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateAnnouncementOptions {
    #[garde(skip)]
    pub r#type: Option<AnnouncementType>,

    #[garde(skip)]
    pub enabled: Option<bool>,
    #[garde(skip)]
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub enabled_start: Option<Option<chrono::DateTime<chrono::Utc>>>,
    #[garde(skip)]
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub enabled_end: Option<Option<chrono::DateTime<chrono::Utc>>>,
    #[garde(skip)]
    pub dismissible: Option<bool>,
    #[garde(skip)]
    #[serde(default, with = "::serde_with::rust::double_option")]
    pub dismissible_end: Option<Option<chrono::DateTime<chrono::Utc>>>,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub title: Option<compact_str::CompactString>,
    #[garde(inner(custom(validate_title_translations)))]
    pub title_translations:
        Option<BTreeMap<compact_str::CompactString, compact_str::CompactString>>,
    #[garde(length(chars, min = 1, max = 2048))]
    #[schema(min_length = 1, max_length = 2048)]
    pub content: Option<compact_str::CompactString>,
    #[garde(inner(custom(validate_content_translations)))]
    pub content_translations:
        Option<BTreeMap<compact_str::CompactString, compact_str::CompactString>>,

    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub locations: Option<Vec<uuid::Uuid>>,
    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub nodes: Option<Vec<uuid::Uuid>>,
    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub backup_configurations: Option<Vec<uuid::Uuid>>,
    #[garde(length(max = 100))]
    #[schema(max_length = 100)]
    pub eggs: Option<Vec<uuid::Uuid>>,
}

#[async_trait::async_trait]
impl UpdatableModel for Announcement {
    type UpdateOptions = UpdateAnnouncementOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<Announcement>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update_with_transaction(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = UpdateQueryBuilder::new("announcements");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("type", options.r#type)
            .set("enabled", options.enabled)
            .set(
                "enabled_start",
                options
                    .enabled_start
                    .as_ref()
                    .map(|dt| dt.as_ref().map(|dt| dt.naive_utc())),
            )
            .set(
                "enabled_end",
                options
                    .enabled_end
                    .as_ref()
                    .map(|dt| dt.as_ref().map(|dt| dt.naive_utc())),
            )
            .set("dismissible", options.dismissible)
            .set(
                "dismissible_end",
                options
                    .dismissible_end
                    .as_ref()
                    .map(|dt| dt.as_ref().map(|dt| dt.naive_utc())),
            )
            .set("title", options.title.as_ref())
            .set(
                "title_translations",
                options
                    .title_translations
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set("content", options.content.as_ref())
            .set(
                "content_translations",
                options
                    .content_translations
                    .as_ref()
                    .map(serde_json::to_value)
                    .transpose()?,
            )
            .set("locations", options.locations.as_ref())
            .set("nodes", options.nodes.as_ref())
            .set(
                "backup_configurations",
                options.backup_configurations.as_ref(),
            )
            .set("eggs", options.eggs.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(r#type) = options.r#type {
            self.r#type = r#type;
        }
        if let Some(enabled) = options.enabled {
            self.enabled = enabled;
        }
        if let Some(enabled_start) = options.enabled_start {
            self.enabled_start = enabled_start.map(|dt| dt.naive_utc());
        }
        if let Some(enabled_end) = options.enabled_end {
            self.enabled_end = enabled_end.map(|dt| dt.naive_utc());
        }
        if let Some(dismissible) = options.dismissible {
            self.dismissible = dismissible;
        }
        if let Some(dismissible_end) = options.dismissible_end {
            self.dismissible_end = dismissible_end.map(|dt| dt.naive_utc());
        }
        if let Some(title) = options.title {
            self.title = title;
        }
        if let Some(title_translations) = options.title_translations {
            self.title_translations = title_translations;
        }
        if let Some(content) = options.content {
            self.content = content;
        }
        if let Some(content_translations) = options.content_translations {
            self.content_translations = content_translations;
        }
        if let Some(locations) = options.locations {
            self.locations = locations;
        }
        if let Some(nodes) = options.nodes {
            self.nodes = nodes;
        }
        if let Some(backup_configurations) = options.backup_configurations {
            self.backup_configurations = backup_configurations;
        }
        if let Some(eggs) = options.eggs {
            self.eggs = eggs;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for Announcement {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<Announcement>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        self.run_delete_handlers(&options, state, transaction)
            .await?;

        sqlx::query(
            r#"
            DELETE FROM announcements
            WHERE announcements.uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[derive(Validate)]
pub struct DuplicateAnnouncementOptions {}

#[async_trait::async_trait]
impl DuplicableModel for Announcement {
    type DuplicateOptions<'a> = DuplicateAnnouncementOptions;

    fn get_duplicate_handlers() -> &'static LazyLock<DuplicateHandlerList<Self>> {
        static DUPLICATE_LISTENERS: LazyLock<DuplicateHandlerList<Announcement>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DUPLICATE_LISTENERS
    }

    async fn duplicate_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DuplicateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        self.run_duplicate_handlers(&options, state, transaction)
            .await?;

        let mut query_builder = InsertQueryBuilder::new("announcements");

        query_builder
            .set("type", self.r#type)
            .set("enabled", self.enabled)
            .set("enabled_start", self.enabled_start)
            .set("enabled_end", self.enabled_end)
            .set("dismissible", self.dismissible)
            .set("dismissible_end", self.dismissible_end)
            .set("title", &self.title)
            .set(
                "title_translations",
                serde_json::to_value(&self.title_translations)?,
            )
            .set("content", &self.content)
            .set(
                "content_translations",
                serde_json::to_value(&self.content_translations)?,
            )
            .set("locations", &self.locations)
            .set("nodes", &self.nodes)
            .set("backup_configurations", &self.backup_configurations)
            .set("eggs", &self.eggs);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut announcement = Self::map(None, &row)?;

        self.run_after_duplicate_handlers(&mut announcement, &options, state, transaction)
            .await?;

        Ok(announcement)
    }
}

#[schema_extension_derive::extendible]
#[init_args(Announcement, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminAnnouncement")]
pub struct AdminApiAnnouncement {
    pub uuid: uuid::Uuid,

    pub r#type: AnnouncementType,
    pub enabled: bool,
    pub enabled_start: Option<chrono::DateTime<chrono::Utc>>,
    pub enabled_end: Option<chrono::DateTime<chrono::Utc>>,
    pub dismissible: bool,
    pub dismissible_end: Option<chrono::DateTime<chrono::Utc>>,

    pub title: compact_str::CompactString,
    pub title_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    pub content: compact_str::CompactString,
    pub content_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,

    pub locations: Vec<uuid::Uuid>,
    pub nodes: Vec<uuid::Uuid>,
    pub backup_configurations: Vec<uuid::Uuid>,
    pub eggs: Vec<uuid::Uuid>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(Announcement, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "ApiAnnouncement")]
pub struct ApiAnnouncement {
    pub uuid: uuid::Uuid,

    pub r#type: AnnouncementType,
    pub dismissible: bool,
    pub dismissible_end: Option<chrono::DateTime<chrono::Utc>>,

    pub title: compact_str::CompactString,
    pub title_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
    pub content: compact_str::CompactString,
    pub content_translations: BTreeMap<compact_str::CompactString, compact_str::CompactString>,
}
