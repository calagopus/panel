use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::client::servers::_server_::databases::_database_::GetServerDatabase;
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::GetServerActivityLogger,
            server_database::{MUTATE_MAX_ROWS, RowInsert, RowOperation},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(inner(length(chars, min = 1, max = 255)))]
        #[schema(min_length = 1, max_length = 255)]
        schema: Option<compact_str::CompactString>,

        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        table: compact_str::CompactString,

        #[garde(length(min = 1, max = MUTATE_MAX_ROWS), dive)]
        #[schema(min_items = 1, max_items = 100)]
        rows: Vec<RowInsert>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        affected: u64,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
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
            "database" = uuid::Uuid,
            description = "The database ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        mut database: GetServerDatabase,
        activity_logger: GetServerActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_server_permission("databases.edit-rows")?;

        if database.database_host.maintenance_enabled {
            return ApiResponse::error(
                "cannot edit rows while database host is in maintenance mode",
            )
            .with_status(StatusCode::EXPECTATION_FAILED)
            .ok();
        }

        let affected = match database
            .mutate_rows(
                &state.database,
                data.schema.as_deref(),
                &data.table,
                RowOperation::Insert(&data.rows),
            )
            .await
        {
            Ok(affected) => affected,
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "server:database.rows-insert",
                serde_json::json!({
                    "uuid": database.uuid,
                    "name": database.name,
                    "table": data.table,
                    "rows": data.rows.len(),
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { affected }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
