use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use shared::{
        models::server::GetServer,
        response::{ApiResponse, ApiResponseResult},
    };

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(wings_api::InstallationScript)),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(server: GetServer) -> ApiResponseResult {
        ApiResponse::new_serialized(wings_api::InstallationScript {
            container_image: server.0.egg.config_script.container,
            entrypoint: server.0.egg.config_script.entrypoint,
            script: server.0.egg.config_script.content.into(),
            environment: Default::default(),
        })
        .ok()
    }
}

mod post {
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::{
            EventEmittingModel,
            server::{GetServer, ServerStatus},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Deserialize)]
    pub struct Payload {
        successful: bool,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        server: GetServer,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        let status = if !data.successful {
            Some(ServerStatus::InstallFailed)
        } else {
            None
        };

        sqlx::query!(
            "UPDATE servers
            SET status = $1
            WHERE servers.uuid = $2",
            status as Option<ServerStatus>,
            server.0.uuid
        )
        .execute(state.database.write())
        .await?;

        let settings = state.settings.get().await?;
        state
            .mail
            .send_template(
                &state,
                "server_installed",
                server.owner.email.clone(),
                minijinja::context! {
                    user => server.owner,
                    server => *server,
                    server_link => format!(
                        "{}/server/{:08x}",
                        settings.app.url,
                        server.uuid_short,
                    )
                },
            )
            .await;
        drop(settings);

        shared::models::server::Server::get_event_emitter().emit(
            state.0,
            shared::models::server::ServerEvent::InstallCompleted {
                server: Box::new(server.0),
                successful: data.successful,
            },
        );

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .with_state(state.clone())
}
