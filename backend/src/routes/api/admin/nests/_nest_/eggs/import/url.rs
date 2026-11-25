use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::nests::_nest_::GetNest;
    use axum::http::StatusCode;
    use futures_util::StreamExt;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject,
            admin_activity::GetAdminActivityLogger,
            nest_egg::{ExportedNestEgg, NestEgg},
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(
            length(min = 1, max = 25),
            inner(custom(shared::utils::validate_http_url))
        )]
        #[schema(value_type = Vec<String>, format = "uri", min_items = 1, max_items = 25)]
        urls: Vec<reqwest::Url>,
    }

    #[derive(ToSchema, Serialize)]
    struct ResponseFailure {
        #[schema(value_type = String, format = "uri")]
        url: reqwest::Url,
        error: String,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        eggs: Vec<shared::models::nest_egg::AdminApiNestEgg>,
        #[schema(inline)]
        failures: Vec<ResponseFailure>,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
        (status = BAD_REQUEST, body = ApiError),
    ), params(
        (
            "nest" = uuid::Uuid,
            description = "The nest ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        nest: GetNest,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("eggs.create")?;

        let fetch_egg = async |url: reqwest::Url| {
            let exported_egg = ExportedNestEgg::fetch(&state, &url).await;

            (url, exported_egg)
        };

        let mut futures = Vec::new();

        for url in data.urls {
            futures.push(fetch_egg(url));
        }

        let mut results_stream = futures_util::stream::iter(futures).buffered(5);

        let mut eggs = Vec::new();
        let mut failures = Vec::new();

        while let Some((url, exported_egg)) = results_stream.next().await {
            let exported_egg = match exported_egg {
                Ok(exported_egg) => exported_egg,
                Err(err) => {
                    failures.push(ResponseFailure {
                        url,
                        error: err.to_string(),
                    });

                    continue;
                }
            };

            let egg = match NestEgg::import(&state, nest.uuid, None, exported_egg).await {
                Ok(egg) => egg,
                Err(err) if err.is_unique_violation() => {
                    failures.push(ResponseFailure {
                        url,
                        error: "egg with name already exists".to_string(),
                    });

                    continue;
                }
                Err(err) => return ApiResponse::from(err).ok(),
            };

            activity_logger
                .log(
                    "nest:egg.create",
                    serde_json::json!({
                        "uuid": egg.uuid,
                        "nest_uuid": nest.uuid,
                        "url": url.as_str(),

                        "author": egg.author,
                        "name": egg.name,
                        "description": egg.description,

                        "config_files": egg.config_files,
                        "config_startup": egg.config_startup,
                        "config_stop": egg.config_stop,
                        "config_script": egg.config_script,
                        "config_crash_detection": egg.config_crash_detection,

                        "startup_commands": egg.startup_commands,
                        "force_outgoing_ip": egg.force_outgoing_ip,
                        "separate_port": egg.separate_port,

                        "features": egg.features,
                        "docker_images": egg.docker_images,
                        "file_denylist": egg.file_denylist,
                    }),
                )
                .await;

            eggs.push(egg.into_admin_api_object(&state, ()).await?);
        }

        ApiResponse::new_serialized(Response { eggs, failures }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
