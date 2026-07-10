use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use compact_str::ToCompactString;
    use serde::Serialize;
    use shared::{
        GetState,
        jwt::BasePayload,
        models::{
            server::GetServer,
            user::{GetAuthMethod, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        token: String,
        #[schema(format = "uri")]
        url: String,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "server" = uuid::Uuid,
            description = "The server ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ))]
    pub async fn route(
        state: GetState,
        auth: GetAuthMethod,
        user: GetUser,
        server: GetServer,
    ) -> ApiResponseResult {
        #[derive(Serialize)]
        struct WebsocketJwt<'a> {
            #[serde(flatten)]
            base: BasePayload,

            user_uuid: uuid::Uuid,
            user_name: &'a str,
            user_avatar: Option<String>,
            server_uuid: uuid::Uuid,
            permissions: Vec<&'a str>,
            ignored_files: &'a [compact_str::CompactString],
        }

        let node = server.node.fetch_cached(&state.database).await?;
        let storage_url_retriever = state.storage.retrieve_urls().await?;

        let token = node.create_jwt(
            &state.database,
            &state.jwt,
            &WebsocketJwt {
                base: BasePayload {
                    scope: "websocket".into(),
                    issuer: "panel".into(),
                    subject: None,
                    audience: Vec::new(),
                    expiration_time: Some(chrono::Utc::now().timestamp() + 600),
                    not_before: None,
                    issued_at: Some(chrono::Utc::now().timestamp()),
                    jwt_id: user.uuid.to_compact_string(),
                },
                user_uuid: user.uuid,
                user_name: &user.username,
                user_avatar: user
                    .avatar
                    .as_ref()
                    .map(|a| storage_url_retriever.get_url(a)),
                server_uuid: server.uuid,
                permissions: server.wings_permissions(
                    &*state.settings.get().await?,
                    &user,
                    Some(&auth),
                ),
                ignored_files: server.subuser_ignored_files.as_deref().unwrap_or(&[]),
            },
        )?;

        let mut url = node
            .public_url(&state, &format!("/api/servers/{}/ws", server.uuid))
            .await?;
        if url.scheme() == "http" {
            url.set_scheme("ws").unwrap();
        } else if url.scheme() == "https" {
            url.set_scheme("wss").unwrap();
        }

        ApiResponse::new_serialized(Response {
            token,
            url: url.to_string(),
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
