use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, firewall::FirewallRule},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        supported: Option<bool>,
        allocation_ports: Vec<u16>,
        rules: Vec<FirewallRule>,
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
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        server: GetServer,
    ) -> ApiResponseResult {
        permissions.has_server_permission("firewall.read")?;

        let supported = server
            .node
            .fetch_cached(&state.database)
            .await?
            .fetch_firewall_support(&state.database)
            .await;

        let (rules, allocation_ports) = tokio::try_join!(
            server.firewall_rules(&state.database),
            server.allocation_ports(&state.database),
        )?;

        ApiResponse::new_serialized(Response {
            supported,
            allocation_ports,
            rules,
        })
        .ok()
    }
}

mod put {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            server::{GetServer, GetServerActivityLogger, firewall::FirewallRule},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(dive)]
        rules: Vec<FirewallRule>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = UNAUTHORIZED, body = ApiError),
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

        permissions.has_server_permission("firewall.update")?;

        let settings = state.settings.get().await?;
        if data.rules.len() > settings.server.max_firewall_rule_count as usize {
            return ApiResponse::error("maximum number of firewall rules reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }
        if data.rules.iter().any(|rule| {
            rule.sources.len() > settings.server.max_firewall_rule_source_count as usize
        }) {
            return ApiResponse::error("maximum number of firewall rule sources reached")
                .with_status(StatusCode::EXPECTATION_FAILED)
                .ok();
        }
        drop(settings);

        server
            .set_firewall_rules(&state.database, &data.rules)
            .await?;

        activity_logger
            .log(
                "server:firewall.update",
                serde_json::json!({
                    "rules": data.rules,
                }),
            )
            .await;

        server.0.batch_sync(&state.database).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(put::route))
        .with_state(state.clone())
}
