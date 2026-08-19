use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod put {
    use axum::{body::Bytes, http::StatusCode};
    use image::{ImageReader, codecs::webp::WebPEncoder, imageops::FilterType};
    use rand::distr::SampleString;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        avatar: String,
    }

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), request_body = String)]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
        image: Bytes,
    ) -> ApiResponseResult {
        permissions.has_user_permission("account.avatar")?;

        if user.frozen {
            return ApiResponse::error("account is frozen")
                .with_status(StatusCode::CONFLICT)
                .ok();
        }

        if image.is_empty() {
            return ApiResponse::error("image: payload cannot be empty")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let mut image = match ImageReader::new(std::io::Cursor::new(image)).with_guessed_format() {
            Ok(reader) => reader,
            Err(_) => {
                return ApiResponse::error("image: unable to decode")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        let Some(format) = image.format() else {
            return ApiResponse::error("image: unrecognized image format")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        };

        if !matches!(
            format,
            image::ImageFormat::Png
                | image::ImageFormat::Jpeg
                | image::ImageFormat::WebP
                | image::ImageFormat::Gif
        ) {
            return ApiResponse::error("image: only PNG, JPEG, WebP, and GIF formats are allowed")
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let mut limits = image::Limits::default();
        limits.max_alloc = Some(64 * 1024 * 1024);
        limits.max_image_width = Some(4096);
        limits.max_image_height = Some(4096);
        image.limits(limits);

        let image = match tokio::task::spawn_blocking(move || image.decode()).await? {
            Ok(image) => image,
            Err(_) => {
                return ApiResponse::error("image: unable to decode")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        if !(64..=4096).contains(&image.width()) || !(64..=4096).contains(&image.height()) {
            return ApiResponse::error("image: invalid resolution, dimensions must not be smaller than 64px and must not exceed 4096px")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
        }

        let data = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, image::ImageError> {
            let image = image.resize_exact(512, 512, FilterType::Triangle);
            let mut data: Vec<u8> = Vec::new();
            let encoder = WebPEncoder::new_lossless(&mut data);
            let color = image.color();
            encoder.encode(image.as_bytes(), 512, 512, color.into())?;

            Ok(data)
        })
        .await??;

        let identifier_random = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 8);
        let avatar_path = format!("avatars/{}/{}.webp", user.uuid, identifier_random);

        tokio::try_join!(
            state
                .storage
                .store(&avatar_path, data.as_slice(), "image/webp"),
            state.storage.remove(user.avatar.as_deref()),
        )?;

        sqlx::query!(
            "UPDATE users
            SET avatar = $2
            WHERE users.uuid = $1",
            user.uuid,
            avatar_path
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log("account:update-avatar", serde_json::json!({}))
            .await;

        ApiResponse::new_serialized(Response {
            avatar: state.storage.retrieve_urls().await?.get_url(&avatar_path),
        })
        .ok()
    }
}

mod delete {
    use axum::http::StatusCode;
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            user::{GetPermissionManager, GetUser},
            user_activity::GetUserActivityLogger,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(delete, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        user: GetUser,
        activity_logger: GetUserActivityLogger,
    ) -> ApiResponseResult {
        permissions.has_user_permission("account.avatar")?;

        let avatar = match &user.avatar {
            Some(avatar) => avatar,
            None => {
                return ApiResponse::error("no avatar to delete")
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        state.storage.remove(Some(avatar)).await?;

        sqlx::query!(
            "UPDATE users
            SET avatar = NULL
            WHERE users.uuid = $1",
            user.uuid
        )
        .execute(state.database.write())
        .await?;

        activity_logger
            .log("account:delete-avatar", serde_json::json!({}))
            .await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(put::route))
        .routes(routes!(delete::route))
        .with_state(state.clone())
}
