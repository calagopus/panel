use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

pub fn validate_team_preset_permissions(
    permissions: &[compact_str::CompactString],
    context: &(),
) -> Result<(), garde::Error> {
    crate::permissions::validate_server_permissions(permissions, context)?;

    if let Some(permission) = permissions
        .iter()
        .find(|permission| permission.starts_with("subusers."))
    {
        return Err(garde::Error::new(compact_str::format_compact!(
            "permission cannot be part of a team preset: {permission}"
        )));
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TeamPreset {
    pub uuid: uuid::Uuid,
    pub team_uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub weight: i32,

    pub permissions: Vec<compact_str::CompactString>,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for TeamPreset {
    const NAME: &'static str = "team_preset";

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
                "team_presets.uuid",
                compact_str::format_compact!("{prefix}uuid"),
            ),
            (
                "team_presets.team_uuid",
                compact_str::format_compact!("{prefix}team_uuid"),
            ),
            (
                "team_presets.name",
                compact_str::format_compact!("{prefix}name"),
            ),
            (
                "team_presets.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "team_presets.weight",
                compact_str::format_compact!("{prefix}weight"),
            ),
            (
                "team_presets.permissions",
                compact_str::format_compact!("{prefix}permissions"),
            ),
            (
                "team_presets.ignored_files",
                compact_str::format_compact!("{prefix}ignored_files"),
            ),
            (
                "team_presets.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ])
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            team_uuid: row.try_get(compact_str::format_compact!("{prefix}team_uuid").as_str())?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            weight: row.try_get(compact_str::format_compact!("{prefix}weight").as_str())?,
            permissions: row
                .try_get(compact_str::format_compact!("{prefix}permissions").as_str())?,
            ignored_files: row
                .try_get(compact_str::format_compact!("{prefix}ignored_files").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl TeamPreset {
    pub async fn by_team_uuid_uuid(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM team_presets
            WHERE team_presets.team_uuid = $1 AND team_presets.uuid = $2
            "#,
            Self::columns_sql(None)
        )))
        .bind(team_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_team_uuid_with_pagination(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM team_presets
                WHERE team_presets.team_uuid = $1 AND {search}
                "#,
                search = super::search_sql(2, &["team_presets.name"], &["team_presets.uuid"]),
            ),
            "team_presets.weight DESC, team_presets.created, team_presets.uuid",
        )
        .bind(team_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn count_by_team_uuid(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM team_presets
            WHERE team_presets.team_uuid = $1
            "#,
        )
        .bind(team_uuid)
        .fetch_one(database.read())
        .await
    }

    /// Accepted members currently holding this preset.
    pub async fn member_user_uuids(
        &self,
        database: &crate::database::Database,
    ) -> Result<Vec<uuid::Uuid>, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT team_members.user_uuid
            FROM team_members
            WHERE team_members.preset_uuid = $1 AND team_members.accepted IS NOT NULL
            "#,
        )
        .bind(self.uuid)
        .fetch_all(database.read())
        .await
    }

    pub async fn count_members(
        &self,
        database: &crate::database::Database,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM team_members
            WHERE team_members.preset_uuid = $1
            "#,
        )
        .bind(self.uuid)
        .fetch_one(database.read())
        .await
    }
}

#[async_trait::async_trait]
impl IntoApiObject for TeamPreset {
    type ApiObject = ApiTeamPreset;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiTeamPreset::init_hooks(&self, state).await?;

        let api_object = finish_extendible!(
            ApiTeamPreset {
                uuid: self.uuid,
                name: self.name,
                description: self.description,
                weight: self.weight,
                permissions: self.permissions,
                ignored_files: self.ignored_files,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateTeamPresetOptions {
    #[garde(skip)]
    pub team_uuid: uuid::Uuid,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
    #[garde(range(min = 0, max = 1_000_000))]
    #[schema(minimum = 0, maximum = 1_000_000)]
    pub weight: i32,
    #[garde(custom(validate_team_preset_permissions))]
    pub permissions: Vec<compact_str::CompactString>,
    #[garde(
        length(max = 1024),
        inner(length(chars, min = 1, max = 255)),
        custom(crate::utils::validate_ignored_files)
    )]
    #[schema(max_items = 1024, min_length = 1, max_length = 255)]
    pub ignored_files: Vec<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl CreatableModel for TeamPreset {
    type CreateOptions<'a> = CreateTeamPresetOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<TeamPreset>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("team_presets");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("team_uuid", options.team_uuid)
            .set("name", &options.name)
            .set("description", &options.description)
            .set("weight", options.weight)
            .set("permissions", &options.permissions)
            .set("ignored_files", &options.ignored_files);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut team_preset = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut team_preset, &options, state, transaction).await?;

        Ok(team_preset)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateTeamPresetOptions {
    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: Option<compact_str::CompactString>,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub description: Option<Option<compact_str::CompactString>>,
    #[garde(range(min = 0, max = 1_000_000))]
    #[schema(minimum = 0, maximum = 1_000_000)]
    pub weight: Option<i32>,
    #[garde(inner(custom(validate_team_preset_permissions)))]
    pub permissions: Option<Vec<compact_str::CompactString>>,
    #[garde(inner(
        length(max = 1024),
        inner(length(chars, min = 1, max = 255)),
        custom(crate::utils::validate_ignored_files)
    ))]
    #[schema(max_items = 1024, min_length = 1, max_length = 255)]
    pub ignored_files: Option<Vec<compact_str::CompactString>>,
}

#[async_trait::async_trait]
impl UpdatableModel for TeamPreset {
    type UpdateOptions = UpdateTeamPresetOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<TeamPreset>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        let access_changed = options
            .permissions
            .as_ref()
            .is_some_and(|permissions| *permissions != self.permissions)
            || options
                .ignored_files
                .as_ref()
                .is_some_and(|ignored_files| *ignored_files != self.ignored_files);

        let mut transaction = state.database.write().begin().await?;

        if let Err(err) = self
            .update_with_transaction(state, options, &mut transaction)
            .await
        {
            transaction.rollback().await?;
            return Err(err);
        }

        transaction.commit().await?;

        if access_changed {
            super::team::Team::invalidate_members(
                &state.database,
                self.team_uuid,
                self.member_user_uuids(&state.database).await?,
            )
            .await;
        }

        Ok(())
    }

    async fn update_with_transaction(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = UpdateQueryBuilder::new("team_presets");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .set("weight", options.weight)
            .set("permissions", options.permissions.as_ref())
            .set("ignored_files", options.ignored_files.as_ref())
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }
        if let Some(weight) = options.weight {
            self.weight = weight;
        }
        if let Some(permissions) = options.permissions {
            self.permissions = permissions;
        }
        if let Some(ignored_files) = options.ignored_files {
            self.ignored_files = ignored_files;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[derive(Clone, Default)]
pub struct DeleteTeamPresetOptions {
    pub replacement_preset_uuid: Option<uuid::Uuid>,
}

#[async_trait::async_trait]
impl DeletableModel for TeamPreset {
    type DeleteOptions = DeleteTeamPresetOptions;

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<TeamPreset>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let user_uuids = self.member_user_uuids(&state.database).await?;

        let mut transaction = state.database.write().begin().await?;

        if let Err(err) = self
            .delete_with_transaction(state, options, &mut transaction)
            .await
        {
            transaction.rollback().await?;
            return Err(err);
        }

        transaction.commit().await?;

        super::team::Team::invalidate_members(&state.database, self.team_uuid, user_uuids).await;

        Ok(())
    }

    async fn delete_with_transaction(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), anyhow::Error> {
        self.run_delete_handlers(&options, state, transaction)
            .await?;

        if let Some(replacement_preset_uuid) = options.replacement_preset_uuid {
            sqlx::query(
                r#"
                UPDATE team_members
                SET preset_uuid = $2
                WHERE team_members.preset_uuid = $1
                "#,
            )
            .bind(self.uuid)
            .bind(replacement_preset_uuid)
            .execute(&mut **transaction)
            .await?;

            sqlx::query(
                r#"
                UPDATE oauth_provider_mappings
                SET mapping = jsonb_set(mapping, '{preset_uuid}', to_jsonb($2::uuid))
                WHERE oauth_provider_mappings.mapping->>'type' = 'team_member'
                    AND (oauth_provider_mappings.mapping->>'preset_uuid')::uuid = $1
                "#,
            )
            .bind(self.uuid)
            .bind(replacement_preset_uuid)
            .execute(&mut **transaction)
            .await?;
        }

        sqlx::query(
            r#"
            DELETE FROM team_presets
            WHERE team_presets.uuid = $1
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
pub struct DuplicateTeamPresetOptions {
    #[garde(length(chars, min = 1, max = 255))]
    pub name: compact_str::CompactString,
}

#[async_trait::async_trait]
impl DuplicableModel for TeamPreset {
    type DuplicateOptions<'a> = DuplicateTeamPresetOptions;
    type DuplicateResult = Self;

    fn get_duplicate_handlers() -> &'static LazyLock<DuplicateHandlerList<Self>> {
        static DUPLICATE_LISTENERS: LazyLock<DuplicateHandlerList<TeamPreset>> =
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

        let mut query_builder = InsertQueryBuilder::new("team_presets");

        query_builder
            .set("team_uuid", self.team_uuid)
            .set("name", &options.name)
            .set("description", &self.description)
            .set("weight", self.weight)
            .set("permissions", &self.permissions)
            .set("ignored_files", &self.ignored_files);

        let row = query_builder
            .returning(&Self::columns_sql(None))
            .fetch_one(&mut **transaction)
            .await?;
        let mut team_preset = Self::map(None, &row)?;

        self.run_after_duplicate_handlers(&mut team_preset, &options, state, transaction)
            .await?;

        Ok(team_preset)
    }
}

#[schema_extension_derive::extendible]
#[init_args(TeamPreset, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "TeamPreset")]
pub struct ApiTeamPreset {
    pub uuid: uuid::Uuid,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub weight: i32,

    pub permissions: Vec<compact_str::CompactString>,
    pub ignored_files: Vec<compact_str::CompactString>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn permissions(permissions: &[&str]) -> Vec<compact_str::CompactString> {
        crate::permissions::SERVER_PERMISSIONS
            .write()
            .replace(crate::permissions::BASE_SERVER_PERMISSIONS.clone());

        permissions.iter().map(|p| (*p).into()).collect()
    }

    // validate_team_preset_permissions
    #[test]
    fn known_server_permissions_are_accepted() {
        assert!(validate_team_preset_permissions(&permissions(&[]), &()).is_ok());
        assert!(
            validate_team_preset_permissions(&permissions(&["control.start", "files.read"]), &())
                .is_ok()
        );
    }

    #[test]
    fn unknown_permissions_are_rejected() {
        assert!(
            validate_team_preset_permissions(
                &permissions(&["files.read", "files.nonexistent"]),
                &()
            )
            .is_err()
        );
    }

    #[test]
    fn subuser_permissions_are_rejected() {
        let subuser_keys: Vec<String> = crate::permissions::base_server_permission_keys()
            .into_iter()
            .filter(|key| key.starts_with("subusers."))
            .collect();

        assert!(subuser_keys.iter().any(|key| key == "subusers.create"));
        for key in subuser_keys {
            assert!(validate_team_preset_permissions(&permissions(&[&key]), &()).is_err());
        }
        assert!(
            validate_team_preset_permissions(&permissions(&["files.read", "subusers.read"]), &())
                .is_err()
        );
    }
}
