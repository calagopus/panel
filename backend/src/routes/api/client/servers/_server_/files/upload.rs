use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        jwt::BasePayload,
        models::{
            server::GetServer,
            user::{GetPermissionManager, GetUser},
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(format = "uri")]
        url: String,
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
        user: GetUser,
        server: GetServer,
    ) -> ApiResponseResult {
        permissions.has_server_permission("files.create")?;

        #[derive(Serialize)]
        struct FileUploadJwt<'a> {
            #[serde(flatten)]
            base: BasePayload,

            server_uuid: uuid::Uuid,
            user_uuid: uuid::Uuid,
            unique_id: uuid::Uuid,

            ignored_files: &'a [compact_str::CompactString],
        }

        let node = server.node.fetch_cached(&state.database).await?;

        let token = node.create_jwt(
            &state.database,
            &state.jwt,
            &FileUploadJwt {
                base: BasePayload {
                    issuer: "panel".into(),
                    subject: None,
                    audience: Vec::new(),
                    expiration_time: Some(chrono::Utc::now().timestamp() + 900),
                    not_before: None,
                    issued_at: Some(chrono::Utc::now().timestamp()),
                    jwt_id: user.uuid.to_string(),
                },
                server_uuid: server.uuid,
                user_uuid: user.uuid,
                unique_id: uuid::Uuid::new_v4(),
                ignored_files: server.subuser_ignored_files.as_deref().unwrap_or(&[]),
            },
        )?;

        let mut url = node.public_url(&state, "/upload/file").await?;
        url.set_query(Some(&format!("token={}", urlencoding::encode(&token))));

        ApiResponse::new_serialized(Response {
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
