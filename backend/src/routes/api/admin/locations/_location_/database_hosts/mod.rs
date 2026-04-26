use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _database_host_;

mod get {
    use crate::routes::api::admin::locations::_location_::GetLocation;
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch,
            location_database_host::LocationDatabaseHost, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        database_hosts:
            Pagination<shared::models::location_database_host::AdminApiLocationDatabaseHost>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "location" = uuid::Uuid,
            description = "The location ID",
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
        location: GetLocation,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("locations.database-hosts")?;

        let database_hosts = LocationDatabaseHost::by_location_uuid_with_pagination(
            &state.database,
            location.uuid,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        ApiResponse::new_serialized(Response {
            database_hosts: database_hosts
                .try_async_map(|host| host.into_admin_api_object(&state, ()))
                .await?,
        })
        .ok()
    }
}

mod post {
    use crate::routes::api::admin::locations::_location_::GetLocation;
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel,
            admin_activity::GetAdminActivityLogger,
            location_database_host::{CreateLocationDatabaseHostOptions, LocationDatabaseHost},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        database_host_uuid: uuid::Uuid,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "location" = uuid::Uuid,
            description = "The location ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        location: GetLocation,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("locations.database-hosts")?;

        let options = CreateLocationDatabaseHostOptions {
            location_uuid: location.uuid,
            database_host_uuid: data.database_host_uuid,
        };
        match LocationDatabaseHost::create(&state, options).await {
            Ok(_) => {}
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error("database host already exists in this location")
                    .with_status(StatusCode::CONFLICT)
                    .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        }

        activity_logger
            .log(
                "location:database-host.create",
                serde_json::json!({
                    "location_uuid": location.uuid,
                    "database_host_uuid": data.database_host_uuid,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{database_host}", _database_host_::router(state))
        .with_state(state.clone())
}
