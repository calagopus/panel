use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod activity;
mod api_keys;
mod avatar;
mod command_snippets;
mod email;
mod logout;
mod oauth_links;
mod password;
mod security_keys;
mod sessions;
mod ssh_keys;
mod two_factor;

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetUser,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        user: shared::models::user::ApiFullUser,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, user: GetUser) -> ApiResponseResult {
        ApiResponse::new_serialized(Response {
            user: user
                .0
                .into_api_full_object(&state, &state.storage.retrieve_urls().await?)
                .await?,
        })
        .ok()
    }
}

mod patch {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            UpdatableModel,
            user::{GetUser, UpdateUserOptions, UserToastPosition},
            user_activity::GetUserActivityLogger,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(length(chars, min = 3, max = 15), pattern("^[a-zA-Z0-9_]+$"))]
        #[schema(min_length = 3, max_length = 15)]
        #[schema(pattern = "^[a-zA-Z0-9_]+$")]
        username: Option<compact_str::CompactString>,
        #[garde(length(chars, min = 2, max = 255))]
        #[schema(min_length = 2, max_length = 255)]
        name_first: Option<compact_str::CompactString>,
        #[garde(length(chars, min = 2, max = 255))]
        #[schema(min_length = 2, max_length = 255)]
        name_last: Option<compact_str::CompactString>,

        #[garde(
            length(chars, min = 2, max = 15),
            inner(custom(shared::utils::validate_language))
        )]
        #[schema(min_length = 2, max_length = 15)]
        language: Option<compact_str::CompactString>,
        #[garde(skip)]
        toast_position: Option<UserToastPosition>,
        #[garde(skip)]
        start_on_grouped_servers: Option<bool>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(patch, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        mut user: GetUser,
        activity_logger: GetUserActivityLogger,
        shared::Payload(mut data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        if !state.settings.get().await?.app.language_change_enabled {
            data.language = None;
        }

        user.update(
            &state,
            UpdateUserOptions {
                username: data.username,
                name_first: data.name_first,
                name_last: data.name_last,
                language: data.language,
                toast_position: data.toast_position,
                start_on_grouped_servers: data.start_on_grouped_servers,
                ..Default::default()
            },
        )
        .await?;

        activity_logger
            .log(
                "user:account.update",
                serde_json::json!({
                    "username": user.username,
                    "name_first": user.name_first,
                    "name_last": user.name_last,
                    "language": user.language,
                    "toast_position": user.toast_position,
                    "start_on_grouped_servers": user.start_on_grouped_servers,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(patch::route))
        .nest("/logout", logout::router(state))
        .nest("/avatar", avatar::router(state))
        .nest("/email", email::router(state))
        .nest("/password", password::router(state))
        .nest("/two-factor", two_factor::router(state))
        .nest("/security-keys", security_keys::router(state))
        .nest("/oauth-links", oauth_links::router(state))
        .nest("/command-snippets", command_snippets::router(state))
        .nest("/api-keys", api_keys::router(state))
        .nest("/ssh-keys", ssh_keys::router(state))
        .nest("/sessions", sessions::router(state))
        .nest("/activity", activity::router(state))
        .with_state(state.clone())
}
