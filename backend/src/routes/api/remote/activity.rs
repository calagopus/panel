use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{CreatableModel, node::GetNode, server_activity::ServerActivity},
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashSet;
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct PayloadActivity {
        server: uuid::Uuid,
        user: Option<uuid::Uuid>,
        schedule: Option<uuid::Uuid>,
        event: compact_str::CompactString,
        metadata: Option<serde_json::Value>,

        #[schema(value_type = Option<String>)]
        ip: Option<std::net::IpAddr>,
        timestamp: chrono::DateTime<chrono::Utc>,
    }

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        #[schema(inline)]
        data: Vec<PayloadActivity>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = EXPECTATION_FAILED, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        node: GetNode,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        let settings = state.settings.get().await?;
        let server_log_schedule_activity = settings.activity.server_log_schedule_activity;
        drop(settings);

        let server_uuids: Vec<_> = data.data.iter().map(|activity| activity.server).collect();
        let owned_servers: HashSet<_> = sqlx::query!(
            "SELECT servers.uuid FROM servers
            WHERE servers.uuid = ANY($1) AND servers.node_uuid = $2",
            &server_uuids,
            node.uuid
        )
        .fetch_all(state.database.read())
        .await?
        .into_iter()
        .map(|row| row.uuid)
        .collect();

        for activity in data.data {
            if !owned_servers.contains(&activity.server) {
                continue;
            }

            if activity.schedule.is_some() && !server_log_schedule_activity {
                continue;
            }

            let options = shared::models::server_activity::CreateServerActivityOptions {
                server_uuid: activity.server,
                user_uuid: activity.user,
                impersonator_uuid: None,
                api_key_uuid: None,
                schedule_uuid: activity.schedule,
                event: activity.event,
                ip: activity.ip.map(|ip| ip.into()),
                data: activity.metadata.unwrap_or_else(|| serde_json::json!({})),
                created: Some(activity.timestamp.naive_utc()),
            };
            if let Err(err) = ServerActivity::create(&state, options).await {
                tracing::warn!(
                    server = %activity.server,
                    "failed to log remote activity for server: {:#?}",
                    err
                );
            }
        }

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
