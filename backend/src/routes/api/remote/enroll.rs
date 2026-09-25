use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use axum::http::StatusCode;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel,
            admin_activity::{AdminActivity, CreateAdminActivityOptions},
            node::NodeEnrollment,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        code: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        uuid: uuid::Uuid,
        token_id: String,
        token: String,
        remote: String,
        allowed_origins: Vec<String>,
        api_port: u16,
        sftp_port: u16,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        ip: shared::GetIp,
        request_host: shared::GetRequestHost,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        let (ratelimit, ip_exempt) = state
            .settings
            .get_as(|s| (s.ratelimits.remote_enroll, s.ratelimits.is_ip_exempt(ip.0)))
            .await?;
        if !ip_exempt {
            state
                .cache
                .ratelimit(
                    "remote/enroll",
                    ratelimit.hits,
                    ratelimit.window_seconds,
                    ip.to_string(),
                )
                .await?;
        }

        let Some(enrollment) = NodeEnrollment::redeem(&state, &data.code).await? else {
            return ApiResponse::error("enrollment code is invalid, expired or already used")
                .with_status(StatusCode::NOT_FOUND)
                .ok();
        };

        let (host_url, mut allowed_origins) = state
            .settings
            .get_as(|s| {
                (
                    s.app.url_for_host(request_host.as_deref()).to_string(),
                    s.app
                        .urls()
                        .filter_map(|url| reqwest::Url::parse(url).ok())
                        .map(|url| url.origin().ascii_serialization())
                        .collect::<Vec<_>>(),
                )
            })
            .await?;
        allowed_origins.sort();
        allowed_origins.dedup();

        let remote = enrollment
            .remote
            .map_or(host_url, |remote| remote.to_string());

        if let Err(err) = AdminActivity::create(
            &state,
            CreateAdminActivityOptions {
                user_uuid: None,
                impersonator_uuid: None,
                api_key_uuid: None,
                event: "node:enroll".into(),
                ip: Some(ip.0.into()),
                data: serde_json::json!({
                    "node_uuid": enrollment.node.uuid,
                }),
                created: None,
            },
        )
        .await
        {
            tracing::warn!(
                node = %enrollment.node.uuid,
                "failed to log node enrollment: {:#?}",
                err
            );
        }

        ApiResponse::new_serialized(Response {
            uuid: enrollment.node.uuid,
            token_id: enrollment.token_id,
            token: enrollment.token,
            remote,
            allowed_origins,
            api_port: enrollment.node.url.port().unwrap_or(8080),
            sftp_port: enrollment.node.sftp_port as u16,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
