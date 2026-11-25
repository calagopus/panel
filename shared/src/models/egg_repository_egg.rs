use crate::prelude::*;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::{BTreeMap, HashMap},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, Clone)]
pub struct EggRepositoryEgg {
    pub uuid: uuid::Uuid,
    pub path: String,
    pub egg_repository: Fetchable<super::egg_repository::EggRepository>,

    pub readme: Option<compact_str::CompactString>,
    pub banner: Option<String>,
    pub exported_egg: super::nest_egg::ExportedNestEgg,
    pub hash: Option<compact_str::CompactString>,

    pub updated: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for EggRepositoryEgg {
    const NAME: &'static str = "egg_repository_egg";

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
                "egg_repository_eggs.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "egg_repository_eggs.path",
                compact_str::format_compact!("{prefix}path"),
            ),
            (
                "egg_repository_eggs.egg_repository_uuid",
                compact_str::format_compact!("{prefix}egg_repository_uuid"),
            ),
            (
                "egg_repository_eggs.readme",
                compact_str::format_compact!("{prefix}readme"),
            ),
            (
                "egg_repository_eggs.banner",
                compact_str::format_compact!("{prefix}banner"),
            ),
            (
                "egg_repository_eggs.exported_egg",
                compact_str::format_compact!("{prefix}exported_egg"),
            ),
            (
                "egg_repository_eggs.hash",
                compact_str::format_compact!("{prefix}hash"),
            ),
            (
                "egg_repository_eggs.updated",
                compact_str::format_compact!("{prefix}updated"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            path: row.try_get(compact_str::format_compact!("{prefix}path").as_str())?,
            egg_repository: super::egg_repository::EggRepository::get_fetchable(
                row.try_get(compact_str::format_compact!("{prefix}egg_repository_uuid").as_str())?,
            ),
            readme: row.try_get(compact_str::format_compact!("{prefix}readme").as_str())?,
            banner: row.try_get(compact_str::format_compact!("{prefix}banner").as_str())?,
            exported_egg: row
                .try_get::<sqlx::types::Json<_>, _>(
                    compact_str::format_compact!("{prefix}exported_egg").as_str(),
                )?
                .0,
            hash: row.try_get(compact_str::format_compact!("{prefix}hash").as_str())?,
            updated: row.try_get(compact_str::format_compact!("{prefix}updated").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }

    fn cache_invalidation_keys(&self) -> Vec<compact_str::CompactString> {
        vec![compact_str::format_compact!(
            "{}::{}",
            Self::NAME,
            self.uuid
        )]
    }
}

impl EggRepositoryEgg {
    pub async fn create(
        database: &crate::database::Database,
        egg_repository_uuid: uuid::Uuid,
        path: impl AsRef<str>,
        readme: Option<&str>,
        banner: Option<&str>,
        exported_egg: &super::nest_egg::ExportedNestEgg,
        updated: chrono::NaiveDateTime,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            INSERT INTO egg_repository_eggs (egg_repository_uuid, path, readme, banner, exported_egg, hash, updated)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (egg_repository_uuid, path) DO UPDATE SET
                readme = EXCLUDED.readme,
                banner = EXCLUDED.banner,
                exported_egg = EXCLUDED.exported_egg,
                hash = EXCLUDED.hash,
                updated = EXCLUDED.updated
            RETURNING {}
            "#,
            Self::columns_sql(None)
        )))
        .bind(egg_repository_uuid)
        .bind(path.as_ref())
        .bind(readme)
        .bind(banner)
        .bind(OrderedJson(exported_egg))
        .bind(exported_egg.content_hash())
        .bind(updated)
        .fetch_one(database.write())
        .await?;

        Self::map(None, &row)
    }

    pub async fn by_egg_repository_uuid_uuid(
        database: &crate::database::Database,
        egg_repository_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM egg_repository_eggs
            WHERE egg_repository_eggs.egg_repository_uuid = $1 AND egg_repository_eggs.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(egg_repository_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        match row {
            Some(row) => Ok(Some(Self::map(None, &row)?)),
            None => Ok(None),
        }
    }

    pub async fn by_egg_repository_uuid_with_pagination(
        database: &crate::database::Database,
        egg_repository_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM egg_repository_eggs
                WHERE egg_repository_eggs.egg_repository_uuid = $1 AND {search}
                "#,
                search = super::search_sql(
                    2,
                    &[
                        "egg_repository_eggs.path",
                        "egg_repository_eggs.exported_egg->>'name'"
                    ],
                    &["egg_repository_eggs.uuid"]
                ),
            ),
            "egg_repository_eggs.exported_egg->>'name'",
        )
        .bind(egg_repository_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn all_with_pagination(
        database: &crate::database::Database,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM egg_repository_eggs
                WHERE {search}
                "#,
                search = super::search_sql(
                    1,
                    &[
                        "egg_repository_eggs.path",
                        "egg_repository_eggs.exported_egg->>'name'"
                    ],
                    &["egg_repository_eggs.uuid"]
                ),
            ),
            "egg_repository_eggs.exported_egg->>'name', egg_repository_eggs.path",
        )
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn installed_eggs_by_uuids(
        database: &crate::database::Database,
        uuids: &[uuid::Uuid],
    ) -> Result<
        HashMap<uuid::Uuid, Vec<EggRepositoryEggInstalledEgg>>,
        crate::database::DatabaseError,
    > {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT
                nest_eggs.uuid, nest_eggs.name, nest_eggs.egg_repository_egg_uuid,
                nest_eggs.egg_repository_egg_hash, {}
            FROM nest_eggs
            JOIN nests ON nests.uuid = nest_eggs.nest_uuid
            WHERE nest_eggs.egg_repository_egg_uuid = ANY($1)
            ORDER BY nest_eggs.created, nest_eggs.uuid
            "#,
            super::nest::Nest::columns_sql(Some("nest_"))
        )))
        .bind(uuids)
        .fetch_all(database.read())
        .await?;

        let mut installed: HashMap<uuid::Uuid, Vec<EggRepositoryEggInstalledEgg>> = HashMap::new();
        for row in rows {
            installed
                .entry(row.try_get("egg_repository_egg_uuid")?)
                .or_default()
                .push(EggRepositoryEggInstalledEgg {
                    uuid: row.try_get("uuid")?,
                    name: row.try_get("name")?,
                    egg_repository_egg_hash: row.try_get("egg_repository_egg_hash")?,
                    nest: super::nest::Nest::map(Some("nest_"), &row)?,
                });
        }

        Ok(installed)
    }

    pub async fn banners_by_egg_repository_uuid(
        database: &crate::database::Database,
        egg_repository_uuid: uuid::Uuid,
    ) -> Result<Vec<String>, crate::database::DatabaseError> {
        let rows = sqlx::query(
            r#"
            SELECT DISTINCT egg_repository_eggs.banner
            FROM egg_repository_eggs
            WHERE egg_repository_eggs.egg_repository_uuid = $1 AND egg_repository_eggs.banner IS NOT NULL
            "#,
        )
        .bind(egg_repository_uuid)
        .fetch_all(database.write())
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| row.try_get("banner"))
            .try_collect_vec()?)
    }

    pub async fn delete_unused(
        database: &crate::database::Database,
        egg_repository_uuid: uuid::Uuid,
        paths: &[compact_str::CompactString],
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            DELETE FROM egg_repository_eggs
            WHERE egg_repository_eggs.egg_repository_uuid = $1 AND egg_repository_eggs.path != ALL($2)
            "#,
        )
        .bind(egg_repository_uuid)
        .bind(paths)
        .execute(database.write())
        .await?;

        Ok(())
    }

    pub async fn into_admin_egg_api_object(
        self,
        state: &crate::State,
        _args: (),
    ) -> Result<AdminApiEggEggRepositoryEgg, crate::database::DatabaseError> {
        Ok(AdminApiEggEggRepositoryEgg {
            uuid: self.uuid,
            path: self.path,
            egg_repository: self
                .egg_repository
                .fetch_cached(&state.database)
                .await?
                .into_admin_api_object(state, ())
                .await?,
            readme: self.readme,
            banner: match self.banner {
                Some(banner) => Some(state.storage.retrieve_urls().await?.get_url(banner)),
                None => None,
            },
            hash: self
                .hash
                .unwrap_or_else(|| self.exported_egg.content_hash()),
            exported_egg: self.exported_egg,
            updated: self.updated.and_utc(),
        })
    }
}

pub struct EggRepositoryEggInstalledEgg {
    pub uuid: uuid::Uuid,
    pub name: compact_str::CompactString,
    pub egg_repository_egg_hash: Option<compact_str::CompactString>,
    pub nest: super::nest::Nest,
}

impl EggRepositoryEggInstalledEgg {
    pub async fn into_admin_api_object(
        self,
        state: &crate::State,
    ) -> Result<AdminApiEggRepositoryEggInstalledEgg, crate::database::DatabaseError> {
        Ok(AdminApiEggRepositoryEggInstalledEgg {
            uuid: self.uuid,
            name: self.name,
            egg_repository_egg_hash: self.egg_repository_egg_hash,
            nest: self.nest.into_admin_api_object(state, ()).await?,
        })
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for EggRepositoryEgg {
    type AdminApiObject = AdminApiEggRepositoryEgg;
    type ExtraArgs<'a> = ();

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiEggRepositoryEgg::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            AdminApiEggRepositoryEgg {
                uuid: self.uuid,
                path: self.path,
                readme: self.readme,
                banner: match self.banner {
                    Some(banner) => Some(state.storage.retrieve_urls().await?.get_url(banner)),
                    None => None,
                },
                hash: self
                    .hash
                    .unwrap_or_else(|| self.exported_egg.content_hash()),
                exported_egg: self.exported_egg,
                updated: self.updated.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for EggRepositoryEgg {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM egg_repository_eggs
            WHERE egg_repository_eggs.uuid = $1
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
            FROM egg_repository_eggs
            WHERE egg_repository_eggs.uuid = $1
            "#,
            Self::columns_sql(None)
        )))
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[async_trait::async_trait]
impl DeletableModel for EggRepositoryEgg {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<EggRepositoryEgg>> =
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
            DELETE FROM egg_repository_eggs
            WHERE egg_repository_eggs.uuid = $1
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

#[schema_extension_derive::extendible]
#[init_args(EggRepositoryEgg, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "EggRepositoryEgg")]
pub struct AdminApiEggRepositoryEgg {
    pub uuid: uuid::Uuid,
    pub path: String,

    pub readme: Option<compact_str::CompactString>,
    pub banner: Option<String>,
    pub exported_egg: super::nest_egg::ExportedNestEgg,
    pub hash: compact_str::CompactString,

    pub updated: chrono::DateTime<chrono::Utc>,
}

#[derive(ToSchema, Serialize)]
#[schema(title = "EggRepositoryEggInstalledEgg")]
pub struct AdminApiEggRepositoryEggInstalledEgg {
    pub uuid: uuid::Uuid,
    pub name: compact_str::CompactString,
    pub egg_repository_egg_hash: Option<compact_str::CompactString>,
    pub nest: super::nest::AdminApiNest,
}

#[derive(ToSchema, Serialize)]
#[schema(title = "EggEggRepositoryEgg")]
pub struct AdminApiEggEggRepositoryEgg {
    pub uuid: uuid::Uuid,
    pub path: String,
    pub egg_repository: super::egg_repository::AdminApiEggRepository,

    pub readme: Option<compact_str::CompactString>,
    pub banner: Option<String>,
    pub exported_egg: super::nest_egg::ExportedNestEgg,
    pub hash: compact_str::CompactString,

    pub updated: chrono::DateTime<chrono::Utc>,
}
