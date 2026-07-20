use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::databases::instances::_instance_::GetServerDatabaseInstance;
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoApiObject,
            server::{GetServer, GetServerActivityLogger},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        instance: shared::models::server_database_instance::ApiServerDatabaseInstance,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = UNAUTHORIZED, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
        (
            "database_instance" = uuid::Uuid,
            description = "The database instance ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
        activity_logger: GetServerActivityLogger,
        mut database_instance: GetServerDatabaseInstance,
    ) -> ApiResponseResult {
        permissions.has_server_permission("database-instances.apply-update")?;

        if database_instance.locked {
            return ApiResponse::error("database instance is locked and cannot be updated")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }

        if database_instance.database_agent_host.maintenance_enabled {
            return ApiResponse::error(
                "cannot update database instance while database agent host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let template = match &database_instance.database_agent_template {
            Some(template) => template.fetch_cached(&state.database).await?,
            None => {
                return ApiResponse::error(
                    "cannot apply update: database agent template no longer exists",
                )
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
            }
        };

        if database_instance.r#type.as_str() != template.r#type.as_str() {
            return ApiResponse::error(
                "cannot apply update: database agent template type does not match instance type",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let version = template.version;
        let from_version = database_instance.template_version;

        let Some(spec) = database_instance.resolve_spec(Some(&template)) else {
            return ApiResponse::error("cannot resolve database instance configuration")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        };

        match database_instance
            .database_agent_host
            .api_client(&state.database)
            .await?
            .patch_instances_instance(
                database_instance.uuid,
                &db_agent_api::instances_instance::patch::RequestBody {
                    suspended: None,
                    memory: Some(spec.memory),
                    swap: Some(spec.swap),
                    disk: Some(spec.disk),
                    io_weight: spec.io_weight.map(i64::from),
                    cpu: Some(spec.cpu as i64),
                    image: Some(spec.image),
                    image_uid: spec.image_uid.map(|uid| uid as u32),
                    image_gid: spec.image_gid.map(|gid| gid as u32),
                    volumes: spec.volumes,
                    socket_path: spec.socket_path,
                    timezone: server.timezone.clone(),
                    env: Some(spec.env),
                    cmd: spec.cmd,
                },
            )
            .await
        {
            Ok(_) => {}
            Err(db_agent_api::client::ApiHttpError::Http(StatusCode::EXPECTATION_FAILED, err)) => {
                return ApiResponse::new_serialized(ApiError::new_database_agent_value(err))
                    .with_status(StatusCode::EXPECTATION_FAILED)
                    .ok();
            }
            Err(err) => return Err(err.into()),
        }

        database_instance
            .set_template_version(&state.database, version)
            .await?;

        activity_logger
            .log(
                "server:database-instance.apply-update",
                serde_json::json!({
                    "uuid": database_instance.uuid,
                    "name": database_instance.name,
                    "template_uuid": template.uuid,
                    "from_version": from_version,
                    "to_version": version,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            instance: database_instance.0.into_api_object(&state, ()).await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
