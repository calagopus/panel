use crate::{
    models::{InsertQueryBuilder, UpdateQueryBuilder},
    prelude::*,
    response::ApiResponse,
};
use axum::http::StatusCode;
use garde::Validate;
use serde::{Deserialize, Serialize};
use sqlx::{Row, postgres::PgRow};
use std::{
    collections::BTreeMap,
    sync::{Arc, LazyLock},
};
use utoipa::ToSchema;

pub type GetTeam = crate::extract::ConsumingExtension<Team>;
pub type GetTeamActor = axum::extract::Extension<TeamActor>;

#[derive(Clone)]
pub enum TeamActor {
    Owner,
    Member(Box<TeamMembership>),
}

impl TeamActor {
    #[inline]
    fn deny(message: &str) -> ApiResponse {
        ApiResponse::error(message).with_status(StatusCode::FORBIDDEN)
    }

    #[inline]
    pub fn is_owner(&self) -> bool {
        matches!(self, Self::Owner)
    }

    #[inline]
    fn holds(&self, management: super::team_member::TeamMemberManagement) -> bool {
        match self {
            Self::Owner => true,
            Self::Member(membership) => membership.management.contains(&management),
        }
    }

    pub fn can_manage_team(&self) -> Result<(), ApiResponse> {
        if self.is_owner() {
            return Ok(());
        }

        Err(Self::deny("only the team owner can perform this action"))
    }

    pub fn can_manage_members(&self) -> Result<(), ApiResponse> {
        if self.holds(super::team_member::TeamMemberManagement::Members) {
            return Ok(());
        }

        Err(Self::deny("you cannot manage the members of this team"))
    }

    pub fn can_manage_presets(&self) -> Result<(), ApiResponse> {
        if self.holds(super::team_member::TeamMemberManagement::Presets) {
            return Ok(());
        }

        Err(Self::deny("you cannot manage the presets of this team"))
    }

    /// Whether the caller manages any part of the team, which is what lets them see its
    /// presets and activity.
    pub fn can_manage(&self) -> Result<(), ApiResponse> {
        match self {
            Self::Member(membership) if membership.management.is_empty() => {
                Err(Self::deny("you do not manage this team"))
            }
            _ => Ok(()),
        }
    }

    /// Whether a member holding `preset` ranks strictly below the caller.
    pub fn outranks(&self, preset: &super::team_preset::TeamPreset) -> Result<(), ApiResponse> {
        match self {
            Self::Owner => Ok(()),
            Self::Member(membership) if preset.weight < membership.preset.weight => Ok(()),
            Self::Member(_) => Err(Self::deny(
                "you cannot manage members or presets that are not below your own",
            )),
        }
    }

    /// Whether the caller may hand out a preset of this shape, be it by assigning an existing
    /// one or by writing it.
    pub fn can_grant(
        &self,
        weight: i32,
        permissions: &[compact_str::CompactString],
        ignored_files: &[compact_str::CompactString],
    ) -> Result<(), ApiResponse> {
        let Self::Member(membership) = self else {
            return Ok(());
        };

        if weight >= membership.preset.weight {
            return Err(ApiResponse::error("weight: not below your own preset")
                .with_status(StatusCode::BAD_REQUEST));
        }

        if permissions
            .iter()
            .any(|permission| !membership.preset.permissions.contains(permission))
        {
            return Err(
                ApiResponse::error("permissions: more permissions than self")
                    .with_status(StatusCode::BAD_REQUEST),
            );
        }

        if !ignored_files.ends_with(&membership.preset.ignored_files) {
            return Err(
                ApiResponse::error("ignored_files: less restrictive than self")
                    .with_status(StatusCode::BAD_REQUEST),
            );
        }

        Ok(())
    }

    pub fn can_assign(&self, preset: &super::team_preset::TeamPreset) -> Result<(), ApiResponse> {
        self.can_grant(preset.weight, &preset.permissions, &preset.ignored_files)
    }

    /// Whether the caller may turn the `current` management of a member into `granted`. Only
    /// what changes has to be held by the caller, so an entry out of their reach can neither be
    /// handed out nor taken away.
    pub fn can_grant_management(
        &self,
        current: &[super::team_member::TeamMemberManagement],
        granted: &[super::team_member::TeamMemberManagement],
    ) -> Result<(), ApiResponse> {
        let changed = granted
            .iter()
            .filter(|management| !current.contains(management))
            .chain(
                current
                    .iter()
                    .filter(|management| !granted.contains(management)),
            );

        for management in changed {
            if !self.holds(*management) {
                return Err(ApiResponse::error("management: not held by self")
                    .with_status(StatusCode::BAD_REQUEST));
            }
        }

        Ok(())
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TeamMembership {
    pub preset: super::team_preset::TeamPreset,
    pub management: Vec<super::team_member::TeamMemberManagement>,
    pub accepted: Option<chrono::NaiveDateTime>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Team {
    pub uuid: uuid::Uuid,
    pub owner: super::user::User,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub membership: Option<TeamMembership>,

    pub created: chrono::NaiveDateTime,

    extension_data: super::ModelExtensionData,
}

impl PreviewSample for Team {
    fn preview_sample(settings: &crate::settings::AppSettings) -> Self {
        let mut owner = super::user::User::preview_sample(settings);
        owner.username = "sam".into();
        owner.email = "sam@example.com".into();
        owner.name_first = Some("Sam".into());
        owner.name_last = Some("Taylor".into());

        Self {
            uuid: uuid::Uuid::nil(),
            owner,
            name: "Example Team".into(),
            description: None,
            membership: None,
            created: chrono::Utc::now().naive_utc(),
            extension_data: Vec::new(),
        }
    }
}

impl BaseModel for Team {
    const NAME: &'static str = "team";

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
            ("teams.uuid", compact_str::format_compact!("{prefix}uuid")),
            ("teams.name", compact_str::format_compact!("{prefix}name")),
            (
                "teams.description",
                compact_str::format_compact!("{prefix}description"),
            ),
            (
                "team_members.management",
                compact_str::format_compact!("{prefix}membership_management"),
            ),
            (
                "team_members.accepted",
                compact_str::format_compact!("{prefix}membership_accepted"),
            ),
            (
                "teams.created",
                compact_str::format_compact!("{prefix}created"),
            ),
        ]);

        columns.extend(super::user::User::base_columns(Some("owner_")));
        columns.extend(super::team_preset::TeamPreset::base_columns(Some(
            "membership_preset_",
        )));

        columns
    }

    #[inline]
    fn map(prefix: Option<&str>, row: &PgRow) -> Result<Self, crate::database::DatabaseError> {
        let prefix = prefix.unwrap_or_default();

        Ok(Self {
            uuid: row.try_get(compact_str::format_compact!("{prefix}uuid").as_str())?,
            owner: super::user::User::map(Some("owner_"), row)?,
            name: row.try_get(compact_str::format_compact!("{prefix}name").as_str())?,
            description: row
                .try_get(compact_str::format_compact!("{prefix}description").as_str())?,
            membership: match row
                .try_get::<Option<Vec<super::team_member::TeamMemberManagement>>, _>(
                    compact_str::format_compact!("{prefix}membership_management").as_str(),
                )? {
                Some(management) => Some(TeamMembership {
                    preset: super::team_preset::TeamPreset::map(Some("membership_preset_"), row)?,
                    management,
                    accepted: row.try_get(
                        compact_str::format_compact!("{prefix}membership_accepted").as_str(),
                    )?,
                }),
                None => None,
            },
            created: row.try_get(compact_str::format_compact!("{prefix}created").as_str())?,
            extension_data: Self::map_extensions(prefix, row)?,
        })
    }
}

impl Team {
    /// The joins every team query shares, `$1` being the user the membership is resolved for.
    const JOINS_SQL: &'static str = r#"
        JOIN users ON users.uuid = teams.owner_uuid
        LEFT JOIN roles ON roles.uuid = users.role_uuid
        LEFT JOIN team_members ON team_members.team_uuid = teams.uuid AND team_members.user_uuid = $1
        LEFT JOIN team_presets ON team_presets.uuid = team_members.preset_uuid
    "#;

    /// A team the user owns or was invited to, whether or not they accepted yet.
    pub async fn by_user_uuid_uuid(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        uuid: uuid::Uuid,
    ) -> Result<Option<Self>, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM teams
            {}
            WHERE teams.uuid = $2 AND (teams.owner_uuid = $1 OR team_members.user_uuid = $1)
            "#,
            Self::columns_sql(None),
            Self::JOINS_SQL
        )))
        .bind(user_uuid)
        .bind(uuid)
        .fetch_optional(database.read())
        .await?;

        row.try_map(|row| Self::map(None, &row))
    }

    pub async fn by_user_uuid_with_pagination(
        database: &crate::database::Database,
        user_uuid: uuid::Uuid,
        page: i64,
        per_page: i64,
        search: Option<&str>,
    ) -> Result<super::Pagination<Self>, crate::database::DatabaseError> {
        super::PaginatedQueryBuilder::new(
            Self::columns_sql(None),
            format!(
                r#"
                FROM teams
                {joins}
                WHERE (teams.owner_uuid = $1 OR team_members.user_uuid = $1) AND {search}
                "#,
                joins = Self::JOINS_SQL,
                search = super::search_sql(2, &["teams.name"], &["teams.uuid"]),
            ),
            "teams.created, teams.uuid",
        )
        .bind(user_uuid)
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
                FROM teams
                {joins}
                WHERE {search}
                "#,
                joins = Self::JOINS_SQL,
                search = super::search_sql(
                    2,
                    &["teams.name", "users.username", "users.email"],
                    &["teams.uuid"]
                ),
            ),
            "teams.created, teams.uuid",
        )
        .bind(None::<uuid::Uuid>)
        .bind(search)
        .fetch(database, page, per_page)
        .await
    }

    pub async fn count_by_owner_uuid(
        database: &crate::database::Database,
        owner_uuid: uuid::Uuid,
    ) -> Result<i64, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM teams
            WHERE teams.owner_uuid = $1
            "#,
        )
        .bind(owner_uuid)
        .fetch_one(database.read())
        .await
    }

    pub async fn server_uuids(
        &self,
        database: &crate::database::Database,
    ) -> Result<Vec<uuid::Uuid>, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT servers.uuid
            FROM servers
            WHERE servers.team_uuid = $1
            "#,
        )
        .bind(self.uuid)
        .fetch_all(database.read())
        .await
    }

    /// Members that accepted their invite, and with that hold access to the team's servers.
    pub async fn member_user_uuids(
        &self,
        database: &crate::database::Database,
    ) -> Result<Vec<uuid::Uuid>, sqlx::Error> {
        sqlx::query_scalar(
            r#"
            SELECT team_members.user_uuid
            FROM team_members
            WHERE team_members.team_uuid = $1 AND team_members.accepted IS NOT NULL
            "#,
        )
        .bind(self.uuid)
        .fetch_all(database.read())
        .await
    }

    /// What the user the team was fetched for may do in it, or [`None`] while their invite is
    /// still pending.
    pub fn actor(&self, user_uuid: uuid::Uuid) -> Option<TeamActor> {
        if self.owner.uuid == user_uuid {
            return Some(TeamActor::Owner);
        }

        self.membership
            .as_ref()
            .filter(|membership| membership.accepted.is_some())
            .cloned()
            .map(|membership| TeamActor::Member(Box::new(membership)))
    }

    pub async fn invalidate_members(
        database: &Arc<crate::database::Database>,
        team_uuid: uuid::Uuid,
        user_uuids: Vec<uuid::Uuid>,
    ) {
        if user_uuids.is_empty() {
            return;
        }

        let keys = user_uuids
            .iter()
            .map(|user_uuid| {
                super::team_member::TeamMember::permissions_cache_key(team_uuid, *user_uuid)
            })
            .collect::<Vec<_>>();
        super::invalidate_cache_keys(database, &keys).await;

        super::node::Node::invalidate_permissions_everywhere(
            database,
            super::node::PermissionsInvalidation {
                users: user_uuids,
                ..Default::default()
            },
        );
    }

    async fn invalidate_servers(
        database: &Arc<crate::database::Database>,
        server_uuids: Vec<uuid::Uuid>,
    ) {
        if server_uuids.is_empty() {
            return;
        }

        super::server::Server::invalidate_cached_many(database, server_uuids.iter().copied()).await;

        super::node::Node::invalidate_permissions_everywhere(
            database,
            super::node::PermissionsInvalidation {
                servers: Some(wings_api::ServerSelector::Uuids {
                    uuids: server_uuids.into_iter().collect(),
                }),
                ..Default::default()
            },
        );
    }

    /// Moves a server of the team owner into this team, out of any team it was in before.
    pub async fn attach_server(
        &self,
        state: &crate::State,
        server: &super::server::Server,
    ) -> Result<(), crate::database::DatabaseError> {
        let result = sqlx::query(
            r#"
            UPDATE servers
            SET team_uuid = $1
            WHERE servers.uuid = $2 AND servers.owner_uuid = $3
            "#,
        )
        .bind(self.uuid)
        .bind(server.uuid)
        .bind(self.owner.uuid)
        .execute(state.database.write())
        .await?;

        if result.rows_affected() == 0 {
            return Err(sqlx::Error::InvalidArgument(
                "server is not owned by the team owner".into(),
            )
            .into());
        }

        Self::invalidate_servers(&state.database, vec![server.uuid]).await;

        Ok(())
    }

    pub async fn detach_server(
        &self,
        state: &crate::State,
        server: &super::server::Server,
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            UPDATE servers
            SET team_uuid = NULL
            WHERE servers.uuid = $1 AND servers.team_uuid = $2
            "#,
        )
        .bind(server.uuid)
        .bind(self.uuid)
        .execute(state.database.write())
        .await?;

        Self::invalidate_servers(&state.database, vec![server.uuid]).await;

        Ok(())
    }
}

#[async_trait::async_trait]
impl IntoApiObject for TeamMembership {
    type ApiObject = ApiTeamMembership;
    type ExtraArgs<'a> = ();

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        _args: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        Ok(ApiTeamMembership {
            preset: self.preset.into_api_object(state, ()).await?,
            management: self.management,
            accepted: self.accepted.map(|dt| dt.and_utc()),
        })
    }
}

#[async_trait::async_trait]
impl IntoApiObject for Team {
    type ApiObject = ApiTeam;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::ApiObject, crate::database::DatabaseError> {
        let api_object = ApiTeam::init_hooks(&self, state).await?;

        let membership = match self.membership {
            Some(membership) => Some(membership.into_api_object(state, ()).await?),
            None => None,
        };

        let api_object = finish_extendible!(
            ApiTeam {
                uuid: self.uuid,
                owner: self
                    .owner
                    .into_api_object(state, storage_url_retriever)
                    .await?,
                name: self.name,
                description: self.description,
                membership,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl IntoAdminApiObject for Team {
    type AdminApiObject = AdminApiTeam;
    type ExtraArgs<'a> = &'a crate::storage::StorageUrlRetriever<'a>;

    async fn into_admin_api_object<'a>(
        self,
        state: &crate::State,
        storage_url_retriever: Self::ExtraArgs<'a>,
    ) -> Result<Self::AdminApiObject, crate::database::DatabaseError> {
        let api_object = AdminApiTeam::init_hooks(&self, state).await?;

        let membership = match self.membership {
            Some(membership) => Some(membership.into_api_object(state, ()).await?),
            None => None,
        };

        let api_object = finish_extendible!(
            AdminApiTeam {
                uuid: self.uuid,
                owner: self
                    .owner
                    .into_admin_api_object(state, storage_url_retriever)
                    .await?,
                name: self.name,
                description: self.description,
                membership,
                created: self.created.and_utc(),
            },
            api_object,
            state
        )?;

        Ok(api_object)
    }
}

#[async_trait::async_trait]
impl ByUuid for Team {
    async fn by_uuid(
        database: &crate::database::Database,
        uuid: uuid::Uuid,
    ) -> Result<Self, crate::database::DatabaseError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            r#"
            SELECT {}
            FROM teams
            {}
            WHERE teams.uuid = $2
            "#,
            Self::columns_sql(None),
            Self::JOINS_SQL
        )))
        .bind(None::<uuid::Uuid>)
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
            FROM teams
            {}
            WHERE teams.uuid = $2
            "#,
            Self::columns_sql(None),
            Self::JOINS_SQL
        )))
        .bind(None::<uuid::Uuid>)
        .bind(uuid)
        .fetch_one(&mut **transaction)
        .await?;

        Self::map(None, &row)
    }
}

#[derive(ToSchema, Deserialize, Validate)]
pub struct CreateTeamOptions {
    #[garde(skip)]
    pub owner_uuid: uuid::Uuid,

    #[garde(length(chars, min = 1, max = 255))]
    #[schema(min_length = 1, max_length = 255)]
    pub name: compact_str::CompactString,
    #[garde(length(chars, min = 1, max = 1024))]
    #[schema(min_length = 1, max_length = 1024)]
    pub description: Option<compact_str::CompactString>,
}

#[async_trait::async_trait]
impl CreatableModel for Team {
    type CreateOptions<'a> = CreateTeamOptions;
    type CreateResult = Self;

    fn get_create_handlers() -> &'static LazyLock<CreateListenerList<Self>> {
        static CREATE_LISTENERS: LazyLock<CreateListenerList<Team>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &CREATE_LISTENERS
    }

    async fn create_with_transaction(
        state: &crate::State,
        mut options: Self::CreateOptions<'_>,
        transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    ) -> Result<Self, crate::database::DatabaseError> {
        options.validate()?;

        let mut query_builder = InsertQueryBuilder::new("teams");

        Self::run_create_handlers(&mut options, &mut query_builder, state, transaction).await?;

        query_builder
            .set("owner_uuid", options.owner_uuid)
            .set("name", &options.name)
            .set("description", &options.description);

        let row = query_builder
            .returning("uuid")
            .fetch_one(&mut **transaction)
            .await?;
        let uuid: uuid::Uuid = row.try_get("uuid")?;

        let mut team = Self::by_uuid_with_transaction(transaction, uuid).await?;

        Self::run_after_create_handlers(&mut team, &options, state, transaction).await?;

        Ok(team)
    }
}

#[derive(ToSchema, Serialize, Deserialize, Validate, Clone, Default)]
pub struct UpdateTeamOptions {
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
}

#[async_trait::async_trait]
impl UpdatableModel for Team {
    type UpdateOptions = UpdateTeamOptions;

    fn get_update_handlers() -> &'static LazyLock<UpdateHandlerList<Self>> {
        static UPDATE_LISTENERS: LazyLock<UpdateHandlerList<Team>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &UPDATE_LISTENERS
    }

    async fn update(
        &mut self,
        state: &crate::State,
        options: Self::UpdateOptions,
    ) -> Result<(), crate::database::DatabaseError> {
        let renamed = options.name.as_ref().is_some_and(|name| *name != self.name);

        let mut transaction = state.database.write().begin().await?;

        if let Err(err) = self
            .update_with_transaction(state, options, &mut transaction)
            .await
        {
            transaction.rollback().await?;
            return Err(err);
        }

        transaction.commit().await?;

        if renamed {
            super::server::Server::invalidate_cached_many(
                &state.database,
                self.server_uuids(&state.database).await?,
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

        let mut query_builder = UpdateQueryBuilder::new("teams");

        self.run_update_handlers(&mut options, &mut query_builder, state, transaction)
            .await?;

        query_builder
            .set("name", options.name.as_ref())
            .set(
                "description",
                options.description.as_ref().map(|d| d.as_ref()),
            )
            .where_eq("uuid", self.uuid);

        query_builder.execute(&mut **transaction).await?;

        if let Some(name) = options.name {
            self.name = name;
        }
        if let Some(description) = options.description {
            self.description = description;
        }

        self.run_after_update_handlers(state, transaction).await?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl DeletableModel for Team {
    type DeleteOptions = ();

    fn get_delete_handlers() -> &'static LazyLock<DeleteHandlerList<Self>> {
        static DELETE_LISTENERS: LazyLock<DeleteHandlerList<Team>> =
            LazyLock::new(|| Arc::new(ModelHandlerList::default()));

        &DELETE_LISTENERS
    }

    async fn delete(
        &self,
        state: &crate::State,
        options: Self::DeleteOptions,
    ) -> Result<(), anyhow::Error> {
        let server_uuids = self.server_uuids(&state.database).await?;
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

        Self::invalidate_members(&state.database, self.uuid, user_uuids).await;
        Self::invalidate_servers(&state.database, server_uuids).await;

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

        sqlx::query(
            r#"
            UPDATE servers
            SET team_uuid = NULL
            WHERE servers.team_uuid = $1
            "#,
        )
        .bind(self.uuid)
        .execute(&mut **transaction)
        .await?;

        sqlx::query(
            r#"
            DELETE FROM teams
            WHERE teams.uuid = $1
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

#[derive(ToSchema, Serialize)]
#[schema(title = "TeamMembership")]
pub struct ApiTeamMembership {
    pub preset: super::team_preset::ApiTeamPreset,
    pub management: Vec<super::team_member::TeamMemberManagement>,

    pub accepted: Option<chrono::DateTime<chrono::Utc>>,
}

#[schema_extension_derive::extendible]
#[init_args(Team, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "Team")]
pub struct ApiTeam {
    pub uuid: uuid::Uuid,
    pub owner: super::user::ApiUser,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub membership: Option<ApiTeamMembership>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[schema_extension_derive::extendible]
#[init_args(Team, crate::State)]
#[hook_args(crate::State)]
#[derive(ToSchema, Serialize)]
#[schema(title = "AdminTeam")]
pub struct AdminApiTeam {
    pub uuid: uuid::Uuid,
    pub owner: super::user::AdminApiUser,

    pub name: compact_str::CompactString,
    pub description: Option<compact_str::CompactString>,

    pub membership: Option<ApiTeamMembership>,

    pub created: chrono::DateTime<chrono::Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{team_member::TeamMemberManagement, team_preset::TeamPreset};

    fn strings(values: &[&str]) -> Vec<compact_str::CompactString> {
        values.iter().map(|v| (*v).into()).collect()
    }

    fn preset(weight: i32, permissions: &[&str], ignored_files: &[&str]) -> TeamPreset {
        serde_json::from_value(serde_json::json!({
            "uuid": uuid::Uuid::new_v4(),
            "team_uuid": uuid::Uuid::nil(),
            "name": "preset",
            "description": null,
            "weight": weight,
            "permissions": permissions,
            "ignored_files": ignored_files,
            "created": chrono::NaiveDateTime::default(),
            "extension_data": [],
        }))
        .unwrap()
    }

    fn member(
        management: &[TeamMemberManagement],
        weight: i32,
        permissions: &[&str],
        ignored_files: &[&str],
    ) -> TeamActor {
        TeamActor::Member(Box::new(TeamMembership {
            preset: preset(weight, permissions, ignored_files),
            management: management.to_vec(),
            accepted: Some(chrono::NaiveDateTime::default()),
        }))
    }

    fn manager(management: &[TeamMemberManagement]) -> TeamActor {
        member(management, 10, &[], &[])
    }

    // TeamActor
    #[test]
    fn only_the_owner_can_manage_the_team() {
        assert!(TeamActor::Owner.can_manage_team().is_ok());
        assert!(
            manager(&[TeamMemberManagement::Members, TeamMemberManagement::Presets])
                .can_manage_team()
                .is_err()
        );
    }

    #[test]
    fn managing_members_needs_the_members_capability() {
        assert!(TeamActor::Owner.can_manage_members().is_ok());
        assert!(
            manager(&[TeamMemberManagement::Members])
                .can_manage_members()
                .is_ok()
        );
        assert!(
            manager(&[TeamMemberManagement::Presets])
                .can_manage_members()
                .is_err()
        );
        assert!(manager(&[]).can_manage_members().is_err());
    }

    #[test]
    fn managing_presets_needs_the_presets_capability() {
        assert!(TeamActor::Owner.can_manage_presets().is_ok());
        assert!(
            manager(&[TeamMemberManagement::Presets])
                .can_manage_presets()
                .is_ok()
        );
        assert!(
            manager(&[TeamMemberManagement::Members])
                .can_manage_presets()
                .is_err()
        );
        assert!(manager(&[]).can_manage_presets().is_err());
    }

    #[test]
    fn any_management_capability_allows_managing() {
        assert!(TeamActor::Owner.can_manage().is_ok());
        assert!(
            manager(&[TeamMemberManagement::Members])
                .can_manage()
                .is_ok()
        );
        assert!(
            manager(&[TeamMemberManagement::Presets])
                .can_manage()
                .is_ok()
        );
        assert!(manager(&[]).can_manage().is_err());
    }

    #[test]
    fn unchanged_management_needs_no_capabilities() {
        let actor = manager(&[]);

        assert!(actor.can_grant_management(&[], &[]).is_ok());
        assert!(
            actor
                .can_grant_management(
                    &[TeamMemberManagement::Members, TeamMemberManagement::Presets],
                    &[TeamMemberManagement::Members, TeamMemberManagement::Presets],
                )
                .is_ok()
        );
    }

    #[test]
    fn changed_management_entries_must_be_held() {
        let actor = manager(&[TeamMemberManagement::Members]);

        assert!(
            actor
                .can_grant_management(&[], &[TeamMemberManagement::Members])
                .is_ok()
        );
        assert!(
            actor
                .can_grant_management(&[TeamMemberManagement::Members], &[])
                .is_ok()
        );
        assert!(
            actor
                .can_grant_management(&[], &[TeamMemberManagement::Presets])
                .is_err()
        );
        assert!(
            actor
                .can_grant_management(&[TeamMemberManagement::Presets], &[])
                .is_err()
        );
        assert!(
            actor
                .can_grant_management(
                    &[],
                    &[TeamMemberManagement::Members, TeamMemberManagement::Presets],
                )
                .is_err()
        );
        assert!(
            actor
                .can_grant_management(
                    &[TeamMemberManagement::Presets],
                    &[TeamMemberManagement::Members],
                )
                .is_err()
        );
    }

    #[test]
    fn unchanged_unheld_management_does_not_block_held_changes() {
        let actor = manager(&[TeamMemberManagement::Members]);

        assert!(
            actor
                .can_grant_management(
                    &[TeamMemberManagement::Presets],
                    &[TeamMemberManagement::Presets, TeamMemberManagement::Members],
                )
                .is_ok()
        );
        assert!(
            actor
                .can_grant_management(
                    &[TeamMemberManagement::Members, TeamMemberManagement::Presets],
                    &[TeamMemberManagement::Presets],
                )
                .is_ok()
        );
        assert!(
            TeamActor::Owner
                .can_grant_management(
                    &[TeamMemberManagement::Members],
                    &[TeamMemberManagement::Presets],
                )
                .is_ok()
        );
    }

    #[test]
    fn outranking_needs_a_strictly_lower_weight() {
        let actor = manager(&[]);

        assert!(actor.outranks(&preset(9, &[], &[])).is_ok());
        assert!(actor.outranks(&preset(10, &[], &[])).is_err());
        assert!(actor.outranks(&preset(11, &[], &[])).is_err());
        assert!(
            TeamActor::Owner
                .outranks(&preset(i32::MAX, &[], &[]))
                .is_ok()
        );
    }

    #[test]
    fn granting_needs_a_strictly_lower_weight() {
        let actor = manager(&[]);

        assert!(actor.can_grant(9, &[], &[]).is_ok());
        assert!(actor.can_grant(10, &[], &[]).is_err());
        assert!(actor.can_grant(11, &[], &[]).is_err());
    }

    #[test]
    fn granting_is_limited_to_held_permissions() {
        let actor = member(&[], 10, &["control.start", "files.read"], &[]);

        assert!(actor.can_grant(5, &[], &[]).is_ok());
        assert!(
            actor
                .can_grant(5, &strings(&["files.read", "control.start"]), &[])
                .is_ok()
        );
        assert!(
            actor
                .can_grant(5, &strings(&["files.read", "files.delete"]), &[])
                .is_err()
        );
    }

    #[test]
    fn granted_ignored_files_can_only_prepend_to_the_own_list() {
        let actor = member(&[], 10, &[], &["a", "b"]);

        assert!(actor.can_grant(5, &[], &strings(&["a", "b"])).is_ok());
        assert!(actor.can_grant(5, &[], &strings(&["x", "a", "b"])).is_ok());
        assert!(actor.can_grant(5, &[], &strings(&[])).is_err());
        assert!(actor.can_grant(5, &[], &strings(&["b"])).is_err());
        assert!(actor.can_grant(5, &[], &strings(&["b", "a"])).is_err());
        assert!(actor.can_grant(5, &[], &strings(&["a", "b", "x"])).is_err());
    }

    #[test]
    fn an_empty_own_ignore_list_allows_any_ignored_files() {
        let actor = member(&[], 10, &[], &[]);

        assert!(actor.can_grant(5, &[], &[]).is_ok());
        assert!(actor.can_grant(5, &[], &strings(&["x", "y"])).is_ok());
    }

    #[test]
    fn the_owner_can_grant_and_assign_anything() {
        let preset = preset(i32::MAX, &["files.delete"], &["x"]);

        assert!(
            TeamActor::Owner
                .can_grant(preset.weight, &preset.permissions, &preset.ignored_files)
                .is_ok()
        );
        assert!(TeamActor::Owner.can_assign(&preset).is_ok());
    }

    #[test]
    fn assigning_checks_the_presets_weight_permissions_and_ignored_files() {
        let actor = member(&[], 10, &["files.read"], &["a"]);

        assert!(
            actor
                .can_assign(&preset(5, &["files.read"], &["a"]))
                .is_ok()
        );
        assert!(
            actor
                .can_assign(&preset(10, &["files.read"], &["a"]))
                .is_err()
        );
        assert!(
            actor
                .can_assign(&preset(5, &["files.delete"], &["a"]))
                .is_err()
        );
        assert!(actor.can_assign(&preset(5, &["files.read"], &[])).is_err());
    }
}
