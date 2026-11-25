use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
};
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow, prelude::Type};
use std::{
    collections::{BTreeMap, HashSet},
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Type, PartialEq, Eq, Hash, Clone, Copy)]
#[serde(rename_all = "snake_case")]
#[sqlx(
    type_name = "team_member_management",
    rename_all = "SCREAMING_SNAKE_CASE"
)]
pub enum TeamMemberManagement {
    Members,
    Presets,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TeamMember {
    pub team_uuid: uuid::Uuid,
    pub user: super::user::User,
    pub preset: super::team_preset::TeamPreset,

    pub management: Vec<TeamMemberManagement>,
    pub inviter: Option<Fetchable<super::user::User>>,

    pub accepted: Option<chrono::NaiveDateTime>,
    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl BaseModel for TeamMember {
    const NAME: &'static str = "team_member";

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

        let mut columns = BTreeMap::from([
            (
                "team_members.team_uuid",
                compact_str::format_compact!("{prefix}team_uuid"),
            ),
            (
                "team_members.management",
                compact_str::format_compact!("{prefix}management"),
            ),
            (
                "team_members.inviter_uuid",
                compact_str::format_compact!("{prefix}inviter_uuid"),
            ),
            (
                "team_members.accepted",
                compact_str::format_compact!("{prefix}accepted"),
            ),
            (
                "team_members.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::user::User::base_columns(Some("user_")));
        columns.extend(super::team_preset::TeamPreset::base_columns(Some(
            "preset_",
        )));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            team_uuid: row.try_get(compact_str::format_compact!("{prefix}team_uuid").as_str())?,
            user: super::user::User::map(Some("user_"), row)?,
            preset: super::team_preset::TeamPreset::map(Some("preset_"), row)?,
            management: row.try_get(compact_str::format_compact!("{prefix}management").as_str())?,
            inviter: super::user::User::get_fetchable_from_row(
                row,
                compact_str::format_compact!("{prefix}inviter_uuid"),
            ),
            accepted: row.try_get(compact_str::format_compact!("{prefix}accepted").as_str())?,
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }

    fn cache_invalidation_keys(&self) -> Vec<compact_str::CompactString> {
        vec![Self::permissions_cache_key(self.team_uuid, self.user.uuid)]
    }
}

impl TeamMember {
    const JOINS_SQL: &'static str = r#"
        JOIN users ON users.uuid = team_members.user_uuid
        LEFT JOIN roles ON roles.uuid = users.role_uuid
        JOIN team_presets ON team_presets.uuid = team_members.preset_uuid
    "#;

    pub(super) fn permissions_cache_key(
        team_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
    ) -> compact_str::CompactString {
        compact_str::format_compact!("{}::{team_uuid}::{user_uuid}", Self::NAME)
    }

    pub async fn permissions_by_team_uuid_user_uuid_cached(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
    ) -> Result<
        Option<(
            Vec<compact_str::CompactString>,
            Vec<compact_str::CompactString>,
        )>,
        anyhow::Error,
    > {
        database
            .cache
            .cached(
                &Self::permissions_cache_key(team_uuid, user_uuid),
                super::BY_UUID_CACHE_TTL,
                || Self::permissions_by_team_uuid_user_uuid(database, team_uuid, user_uuid),
            )
            .await
    }

    pub async fn permissions_by_team_uuid_user_uuid(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
    ) -> Result<
        Option<(
            Vec<compact_str::CompactString>,
            Vec<compact_str::CompactString>,
        )>,
        sqlx::Error,
    > {
        let row = sqlx::query(
            r#"
            SELECT team_presets.permissions, team_presets.ignored_files
            FROM team_members
            JOIN team_presets ON team_presets.uuid = team_members.preset_uuid
            WHERE team_members.team_uuid = $1 AND team_members.user_uuid = $2 AND team_members.accepted IS NOT NULL
            "#,
        )
        .bind(team_uuid)
        .bind(user_uuid)
        .fetch_optional(database.read())
        .await?;

        row.map(|row| Ok((row.try_get("permissions")?, row.try_get("ignored_files")?)))
            .transpose()
    }

    pub async fn by_team_uuid_user_uuid(
        database: &crate::database::Database,
        team_uuid: uuid::Uuid,
        user_uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM team_members
            {}
            WHERE team_members.team_uuid = $1 AND team_members.user_uuid = $2
            "#,
            Self::columns_sql(None),
            Self::JOINS_SQL
        )))
        .bind(team_uuid)
        .bind(user_uuid)
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
                FROM team_members
                {joins}
                WHERE team_members.team_uuid = $1 AND {search}
                "#,
                joins = Self::JOINS_SQL,
                search = super::search_sql(2, &["users.username"], &["users.uuid"]),
            ),
            "team_presets.weight DESC, team_members.created, team_members.user_uuid",
        )
        .bind(team_uuid)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn accepted_by_team_uuid_with_pagination(
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
                FROM team_members
                {joins}
                WHERE team_members.team_uuid = $1 AND team_members.accepted IS NOT NULL AND {search}
                "#,
                joins = Self::JOINS_SQL,
                search = super::search_sql(2, &["users.username"], &["users.uuid"]),
            ),
            "team_presets.weight DESC, team_members.created, team_members.user_uuid",
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
            FROM team_members
            WHERE team_members.team_uuid = $1
            "#,
        )
        .bind(team_uuid)
        .fetch_one(database.read())
        .await
    }

    async fn delete_pending_invites(
        &self,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            DELETE FROM team_members
            WHERE team_members.team_uuid = $1 AND team_members.inviter_uuid = $2 AND team_members.accepted IS NULL
            "#,
        )
        .bind(self.team_uuid)
        .bind(self.user.uuid)
        .execute(&mut **transaction)
        .await?;

        Ok(())
    }

    async fn invalidate_access(&self, database: &Arc<crate::database::Database>) {
        if self.accepted.is_none() {
            return;
        }

        super::team::Team::invalidate_members(database, self.team_uuid, vec![self.user.uuid]).await;
    }

    pub async fn accept(&mut self, state: &crate::State) -> Result<(), sqlx::Error> {
        let accepted: chrono::NaiveDateTime = sqlx::query_scalar(
            r#"
            UPDATE team_members
            SET accepted = NOW()
            WHERE team_members.team_uuid = $1 AND team_members.user_uuid = $2
            RETURNING team_members.accepted
            "#,
        )
        .bind(self.team_uuid)
        .bind(self.user.uuid)
        .fetch_one(state.database.write())
        .await?;

        self.accepted = Some(accepted);
        self.invalidate_access(&state.database).await;

        Ok(())
    }
}

#[async_trait::async_trait]
impl IntoApiObject for TeamMember {
    type ApiObject = ApiTeamMember;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiTeamMember::init_hooks(&self, state).await?;

        let inviter = if let Some(inviter) = self.inviter {
            Some(
                inviter
                    .fetch_cached(&state.database)
                    .await?
                    .into_api_object(state, storage_url_retriever)
                    .await?,
            )
        } else {
            None
        };

        let api_object = finish_extendible!(
            ApiTeamMember {
                user: self
                    .user
                    .into_api_object(state, storage_url_retriever)
                    .await?,
                preset: self.preset.into_api_object(state, ()).await?,
                management: self.management,
                inviter,
                accepted: self.accepted.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for TeamMember {
    type AdminApiObject = AdminApiTeamMember;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiTeamMember::init_hooks(&self, state).await?;

        let inviter = if let Some(inviter) = self.inviter {
            Some(
                inviter
                    .fetch_cached(&state.database)
                    .await?
                    .into_admin_api_object(state, storage_url_retriever)
                    .await?,
            )
        } else {
            None
        };

        let api_object = finish_extendible!(
            AdminApiTeamMember {
                user: self
                    .user
                    .into_admin_api_object(state, storage_url_retriever)
                    .await?,
                preset: self.preset.into_api_object(state, ()).await?,
                management: self.management,
                inviter,
                accepted: self.accepted.map(|dt| dt.and_utc()),
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[derive(Validate)]
pub enum TeamMemberInvitee<'a> {
    Email(#[garde(email)] compact_str::CompactString),
    User(#[garde(skip)] &'a super::user::User),
}

#[derive(Validate)]
pub struct CreateTeamMemberOptions<'a> {
    #[garde(skip)]
    pub team: &'a super::team::Team,
    #[garde(skip)]
    pub preset: &'a super::team_preset::TeamPreset,

    #[garde(dive)]
    pub invitee: TeamMemberInvitee<'a>,
    #[garde(skip)]
    pub management: Vec<TeamMemberManagement>,
    #[garde(skip)]
    pub inviter_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub accepted: bool,
}

impl TeamMember {
    async fn create_inner(
        state: &crate::State,
        options: &mut CreateTeamMemberOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(Self, bool), crate::database::DatabaseError> {
        options.validate()?;

        let (user_uuid, user_created) = match &options.invitee {
            TeamMemberInvitee::Email(email) => {
                let (user, user_created) =
                    super::user::User::by_email_or_create_invited(state, email, transaction)
                        .await?;

                (user.uuid, user_created)
            }
            TeamMemberInvitee::User(user) => (user.uuid, false),
        };

        if options.team.owner.uuid == user_uuid {
            return Err(sqlx::Error::InvalidArgument("cannot invite the team owner".into()).into());
        }

        let mut query_builder = InsertQueryBuilder::new("team_members");

        Self::run_create_handlers(options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("team_uuid", options.team.uuid)
            .set("user_uuid", user_uuid)
            .set("preset_uuid", options.preset.uuid)
            .set("management", &options.management)
            .set("inviter_uuid", options.inviter_uuid)
            .set(
                "accepted",
                options.accepted.then(|| chrono::Utc::now().naive_utc()),
            );

        query_builder.execute(&mut **transaction).await?;

        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM team_members
            {}
            WHERE team_members.team_uuid = $1 AND team_members.user_uuid = $2
            "#,
            Self::columns_sql(None),
            Self::JOINS_SQL
        )))
        .bind(options.team.uuid)
        .bind(user_uuid)
        .fetch_one(&mut **transaction)
        .await?;

        let mut result = Self::map(None, &row)?;

        Self::run_after_create_handlers(&mut result, options, state, transaction).await?;

        Ok((result, user_created))
    }

    async fn send_invited_to_team_email(
        &self,
        state: &crate::State,
        team: &super::team::Team,
    ) -> Result<(), crate::database::DatabaseError> {
        let app_url = state.settings.get_as(|s| s.app.url.clone()).await?;

        state
            .mail
            .send_template(
                state,
                "invited_to_team",
                &self.user,
                minijinja::context! {
                    user => minijinja::value::Serde(&self.user),
                    team => minijinja::value::Serde(team),
                    teams_link => format!("{app_url}/account/teams"),
                },
            )
            .await;

        Ok(())
    }
}

#[async_trait::async_trait]
impl CreatableModel for TeamMember {
    type CreateOptions<'a> = CreateTeamMemberOptions<'a>;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<TeamMember>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
    ) -> Result<Self, crate::database::DatabaseError> {
        let mut transaction = state.database.write().begin().await?;

        let (result, user_created) =
            match Self::create_inner(state, &mut options, &mut transaction).await {
                Ok(result) => result,
                Err(err) => {
                    transaction.rollback().await?;
                    return Err(err);
                }
            };

        transaction.commit().await?;

        if user_created {
            super::invalidate_cache_keys(&state.database, &result.user.cache_invalidation_keys())
                .await;

            let token = async {
                let mut transaction = state.database.write().begin().await?;
                let token = result
                    .user
                    .create_account_created_token_with_transaction(state, &mut transaction)
                    .await?;
                transaction.commit().await?;

                Ok::<_, crate::database::DatabaseError>(token)
            }
            .await;

            match token {
                Ok(Some(token)) => {
                    if let Err(err) = result.user.send_account_created_email(state, &token).await {
                        tracing::warn!(user = %result.user.uuid, "failed to send account created email: {:#?}", err);
                    }
                }
                Ok(None) => {}
                Err(err) => {
                    tracing::warn!(user = %result.user.uuid, "failed to create account created token: {:#?}", err);
                }
            }
        }

        if options.accepted {
            result.invalidate_access(&state.database).await;
        } else if let Err(err) = result.send_invited_to_team_email(state, options.team).await {
            tracing::warn!(user = %result.user.uuid, "failed to send invited to team email: {:#?}", err);
        }

        Ok(result)
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        let (result, user_created) = Self::create_inner(state, &mut options, transaction).await?;

        if user_created
            && let Some(token) = result
                .user
                .create_account_created_token_with_transaction(state, transaction)
                .await?
        {
            result
                .user
                .send_account_created_email(state, &token)
                .await?;
        }

        if !options.accepted {
            result
                .send_invited_to_team_email(state, options.team)
                .await?;
        }

        Ok(result)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Default)]
pub struct UpdateTeamMemberOptions {
    #[garde(skip)]
    pub preset_uuid: Option<uuid::Uuid>,
    #[garde(skip)]
    pub management: Option<Vec<TeamMemberManagement>>,
}

#[async_trait::async_trait]
impl UpdatableModel for TeamMember {
    type UpdateOptions = UpdateTeamMemberOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<TeamMember>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

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

        self.invalidate_access(&state.database).await;

        Ok(())
    }

    async fn update_with_transaction(
        &mut self,
        state: &crate::State,
        mut options: Self::UpdateOptions,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<(), crate::database::DatabaseError> {
        options.validate()?;

        let preset = match options.preset_uuid {
            Some(preset_uuid) if preset_uuid != self.preset.uuid => Some(
                super::team_preset::TeamPreset::by_team_uuid_uuid(
                    &state.database,
                    self.team_uuid,
                    preset_uuid,
                )
                .await?
                .ok_or(crate::database::InvalidRelationError("preset"))?,
            ),
            _ => None,
        };

        let mut query_builder = UpdateQueryBuilder::new("team_members");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("preset_uuid", preset.as_ref().map(|preset| preset.uuid))
            .set("management", options.management.as_ref())
            .where_eq("team_uuid", self.team_uuid)
            .where_eq("user_uuid", self.user.uuid);

        query_builder.execute(&mut **transaction).await?;

        let management_changed = options.management.as_ref().is_some_and(|management| {
            management.iter().collect::<HashSet<_>>() != self.management.iter().collect()
        });

        if preset.is_some() || management_changed {
            self.delete_pending_invites(transaction).await?;
        }

        if let Some(preset) = preset {
            self.preset = preset;
        }
        if let Some(management) = options.management {
            self.management = management;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[derive(Clone, Default)]
pub struct DeleteTeamMemberOptions {
    pub notify: bool,
}

#[async_trait::async_trait]
impl DeletableModel for TeamMember {
    type DeleteOptions = DeleteTeamMemberOptions;

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<TeamMember>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let notify = options.notify && self.accepted.is_some();

        let mut transaction = state.database.write().begin().await?;

        if let Err(err) = self
            .delete_with_transaction(state, options, &mut transaction)
            .await
        {
            transaction.rollback().await?;
            return Err(err);
        }

        transaction.commit().await?;

        self.invalidate_access(&state.database).await;

        if notify
            && let Some(team) =
                super::team::Team::by_uuid_optional(&state.database, self.team_uuid).await?
        {
            state
                .mail
                .send_template(
                    state,
                    "removed_from_team",
                    &self.user,
                    minijinja::context! {
                        user => minijinja::value::Serde(&self.user),
                        team => minijinja::value::Serde(&team),
                    },
                )
                .await;
        }

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

        self.delete_pending_invites(transaction).await?;

        sqlx::query(
            r#"
            DELETE FROM team_members
            WHERE team_members.team_uuid = $1 AND team_members.user_uuid = $2
            "#,
        )
        .bind(self.team_uuid)
        .bind(self.user.uuid)
        .execute(&mut **transaction)
        .await?;

        self.run_after_delete_handlers(&options, state, transaction)
            .await?;

        Ok(())
    }
}

#[schema_extension_derive::extendible]
#[init_args(TeamMember, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "TeamMember")]
pub struct ApiTeamMember {
    pub user: super::user::ApiUser,
    pub preset: super::team_preset::ApiTeamPreset,

    pub management: Vec<TeamMemberManagement>,
    pub inviter: Option<super::user::ApiUser>,

    pub accepted: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(TeamMember, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminTeamMember")]
pub struct AdminApiTeamMember {
    pub user: super::user::AdminApiUser,
    pub preset: super::team_preset::ApiTeamPreset,

    pub management: Vec<TeamMemberManagement>,
    pub inviter: Option<super::user::AdminApiUser>,

    pub accepted: Option<chrono::DateTime<chrono::Utc>>,
    pub created: chrono::DateTime<chrono::Utc>,
}
