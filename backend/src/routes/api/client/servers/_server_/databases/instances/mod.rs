use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _instance_;
mod templates;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject, Pagination, server::GetServer,
            server_database_instance::ServerDatabaseInstance, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Params {
        #[garde(range(min = 1))]
        #[serde(default = "Pagination::default_page")]
        page: i64,
        #[garde(range(min = 1, max = 100))]
        #[serde(default = "Pagination::default_per_page")]
        per_page: i64,
        #[garde(length(chars, min = 1, max = 100))]
        #[serde(
            default,
            deserialize_with = "shared::deserialize::deserialize_string_option"
        )]
        search: Option<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        instances: Pagination<shared::models::server_database_instance::ApiServerDatabaseInstance>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        Query(params): Query<Params>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("database-instances.read")?;

        let instances = ServerDatabaseInstance::by_server_uuid_with_pagination(
            &state.database,
            server.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            instances: instances
                .try_async_map(|database_instance| database_instance.into_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            ByUuid, CreatableModel, IntoApiObject,
            database_agent_host::DatabaseAgentHost,
            database_agent_template::DatabaseAgentTemplate,
            server::{GetServer, GetServerActivityLogger},
            server_database_instance::{
                CreateServerDatabaseInstanceOptions, ServerDatabaseInstance,
            },
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        template_uuid: uuid::Uuid,

        #[garde(length(chars, min = 1, max = 31))]
        #[schema(min_length = 1, max_length = 31)]
        name: compact_str::CompactString,

        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        image: Option<compact_str::CompactString>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        instance: shared::models::server_database_instance::ApiServerDatabaseInstance,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("database-instances.create")?;

        let template =
            match DatabaseAgentTemplate::by_uuid_optional(&state.database, data.template_uuid)
                .await?
            {
                Some(template) if template.deployment_enabled => template,
                _ => {
                    return ApiResponse::error("database agent template not found")
                        .with_status(StatusCode::NOT_FOUND)
                        .ok();
                }
            };

        let image = match &data.image {
            Some(key) => match template.docker_images.get(key.as_str()) {
                Some(image) => image.clone(),
                None => {
                    return ApiResponse::error("invalid docker image")
                        .with_status(StatusCode::BAD_REQUEST)
                        .ok();
                }
            },
            None => match template.docker_images.values().next() {
                Some(image) => image.clone(),
                None => {
                    return ApiResponse::error("template has no docker images")
                        .with_status(StatusCode::EXPECTATION_FAILED)
                        .ok();
                }
            },
        };

        let deployment_lock = state
            .cache
            .lock("database_agent_hosts::deployment", Some(30), Some(5))
            .await?;

        let used = shared::models::server_database::ServerDatabase::count_by_server_uuid(
            &state.database,
            server.uuid,
        )
        .await?
            + ServerDatabaseInstance::count_by_server_uuid(&state.database, server.uuid).await?;
        if used >= server.database_limit as i64 {
            return ApiResponse::error("maximum number of databases reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        let hosts = DatabaseAgentHost::by_location_uuid_most_eligible(
            &state.database,
            server
                .node
                .fetch_cached(&state.database)
                .await?
                .location
                .uuid,
            template.r#type,
            template.memory,
            template.disk,
        )
        .await?;

        let mut created = None;
        for host in hosts {
            let client = match host.api_client(&state.database).await {
                Ok(client) => client,
                Err(err) => {
                    tracing::warn!(
                        host = %host.uuid,
                        "failed to construct database agent client: {:?}",
                        err
                    );
                    continue;
                }
            };

            match client
                .post_instances(&db_agent_api::instances::post::RequestBody {
                    database_type: template.r#type,
                    suspended: false,
                    memory: template.memory,
                    swap: template.swap,
                    disk: template.disk,
                    io_weight: template.io_weight.map(i64::from),
                    cpu: template.cpu as i64,
                    image: image.clone(),
                    image_uid: template.image_uid as u32,
                    image_gid: template.image_gid as u32,
                    volumes: template.volumes.clone(),
                    socket_path: template.socket_path.clone(),
                    timezone: server.timezone.clone(),
                    env: template.env.clone(),
                    cmd: template.cmd.clone(),
                })
                .await
            {
                Ok(response) => {
                    created = Some((host, client, response.instance));
                    break;
                }
                Err(err) => {
                    tracing::warn!(
                        host = %host.uuid,
                        "failed to create database on database agent host: {:?}",
                        err
                    );
                }
            }
        }

        let Some((database_agent_host, client, agent_instance)) = created else {
            return ApiResponse::error("no eligible database agent host found")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        };

        let options = CreateServerDatabaseInstanceOptions {
            uuid: agent_instance.uuid,
            server: &server,
            database_agent_host: &database_agent_host,
            database_agent_template: &template,
            name: data.name,
        };

        let mut transaction = state.database.write().begin().await?;

        let database_instance = match ServerDatabaseInstance::create_with_transaction(
            &state,
            options,
            &mut transaction,
        )
        .await
        {
            Ok(database_instance) => {
                transaction.commit().await?;
                database_instance
            }
            Err(err) => {
                transaction.rollback().await.ok();

                if let Err(err) = client.delete_instances_instance(agent_instance.uuid).await {
                    tracing::error!(
                        host = %database_agent_host.uuid,
                        instance = %agent_instance.uuid,
                        "failed to clean up agent database after panel insert failure: {:?}",
                        err
                    );
                }

                if err.is_unique_violation() {
                    return ApiResponse::error("database instance with name already exists")
                        .with_status(StatusCode::CONFLICT)
                        .ok();
                }

                return ApiResponse::from(err).ok();
            }
        };

        drop(deployment_lock);

        activity_logger
            .log(
                "server:database-instance.create",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "template_uuid": template.uuid,
                    "name": database_instance.name,
                    "type": database_instance.r#type,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            instance: database_instance.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/templates", templates::router(state))
        .nest("/{database_instance}", _instance_::router(state))
        .with_state(state.clone())
}
