use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use serde::Serialize;
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response<'a> {
        #[schema(inline)]
        settings: &'a shared::settings::AppSettings,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("settings.read")?;

        let settings = state.settings.get().await?;

        ApiResponse::new_serialized(Response {
            settings: &settings,
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
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct PayloadApp {
        #[garde(length(chars, min = 1, max = 64))]
        name: Option<compact_str::CompactString>,
        #[garde(length(chars, min = 1, max = 255))]
        icon: Option<compact_str::CompactString>,
        #[garde(length(chars, min = 1, max = 255))]
        #[serde(default, with = "::serde_with::rust::double_option")]
        banner: Option<Option<compact_str::CompactString>>,
        #[garde(url)]
        url: Option<compact_str::CompactString>,
        #[garde(
            length(chars, min = 2, max = 15),
            inner(custom(shared::utils::validate_language))
        )]
        language: Option<compact_str::CompactString>,
        #[garde(skip)]
        two_factor_requirement: Option<shared::settings::app::TwoFactorRequirement>,
        #[garde(skip)]
        telemetry_enabled: Option<bool>,
        #[garde(skip)]
        registration_enabled: Option<bool>,
        #[garde(skip)]
        language_change_enabled: Option<bool>,
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct PayloadWebauthn {
        #[garde(length(chars, min = 1, max = 255))]
        rp_id: Option<compact_str::CompactString>,
        #[garde(url)]
        rp_origin: Option<compact_str::CompactString>,
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct PayloadServer {
        #[garde(skip)]
        max_file_manager_view_size: Option<u64>,
        #[garde(skip)]
        max_file_manager_content_search_size: Option<u64>,
        #[garde(skip)]
        max_file_manager_search_results: Option<u64>,
        #[garde(skip)]
        max_schedules_step_count: Option<u64>,

        #[garde(skip)]
        allow_overwriting_custom_docker_image: Option<bool>,
        #[garde(skip)]
        allow_editing_startup_command: Option<bool>,
        #[garde(skip)]
        allow_viewing_installation_logs: Option<bool>,
        #[garde(skip)]
        allow_viewing_transfer_progress: Option<bool>,
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct PayloadActivity {
        #[garde(range(min = 1, max = 3650))]
        admin_log_retention_days: Option<u16>,
        #[garde(range(min = 1, max = 3650))]
        user_log_retention_days: Option<u16>,
        #[garde(range(min = 1, max = 3650))]
        server_log_retention_days: Option<u16>,

        #[garde(skip)]
        server_log_admin_activity: Option<bool>,
        #[garde(skip)]
        server_log_schedule_activity: Option<bool>,
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct PayloadRatelimits {
        #[garde(dive)]
        auth_register: Option<shared::settings::ratelimits::RatelimitConfiguration>,
        #[garde(dive)]
        auth_login: Option<shared::settings::ratelimits::RatelimitConfiguration>,
        #[garde(dive)]
        auth_login_checkpoint: Option<shared::settings::ratelimits::RatelimitConfiguration>,
        #[garde(dive)]
        auth_login_security_key: Option<shared::settings::ratelimits::RatelimitConfiguration>,
        #[garde(dive)]
        auth_password_forgot: Option<shared::settings::ratelimits::RatelimitConfiguration>,
        #[garde(dive)]
        client: Option<shared::settings::ratelimits::RatelimitConfiguration>,
        #[garde(dive)]
        client_servers_backups_create: Option<shared::settings::ratelimits::RatelimitConfiguration>,
        #[garde(dive)]
        client_servers_files_pull: Option<shared::settings::ratelimits::RatelimitConfiguration>,
        #[garde(dive)]
        client_servers_files_pull_query:
            Option<shared::settings::ratelimits::RatelimitConfiguration>,
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        #[serde(default, with = "::serde_with::rust::double_option")]
        oobe_step: Option<Option<compact_str::CompactString>>,

        #[garde(dive)]
        storage_driver: Option<shared::settings::StorageDriver>,
        #[garde(dive)]
        mail_mode: Option<shared::settings::MailMode>,
        #[garde(dive)]
        captcha_provider: Option<shared::settings::CaptchaProvider>,

        #[schema(inline)]
        #[garde(dive)]
        app: Option<PayloadApp>,
        #[schema(inline)]
        #[garde(dive)]
        webauthn: Option<PayloadWebauthn>,
        #[schema(inline)]
        #[garde(dive)]
        server: Option<PayloadServer>,
        #[schema(inline)]
        #[garde(dive)]
        activity: Option<PayloadActivity>,
        #[schema(inline)]
        #[garde(dive)]
        ratelimits: Option<PayloadRatelimits>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {}

    #[utoipa::path(put, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&data) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("settings.update")?;

        let mut settings = state.settings.get_mut().await?;

        if let Some(oobe_step) = data.oobe_step {
            settings.oobe_step = oobe_step;
        }
        if let Some(storage_driver) = data.storage_driver {
            settings.storage_driver = storage_driver;
        }
        if let Some(mail_mode) = data.mail_mode {
            settings.mail_mode = mail_mode;
        }
        if let Some(captcha_provider) = data.captcha_provider {
            settings.captcha_provider = captcha_provider;
        }
        if let Some(app) = data.app {
            if let Some(name) = app.name {
                settings.app.name = name;
            }
            if let Some(icon) = app.icon {
                settings.app.icon = icon;
            }
            if let Some(banner) = app.banner {
                settings.app.banner = banner;
            }
            if let Some(url) = app.url {
                settings.app.url = url;
            }
            if let Some(language) = app.language {
                settings.app.language = language;
            }
            if let Some(two_factor_requirement) = app.two_factor_requirement {
                settings.app.two_factor_requirement = two_factor_requirement;
            }
            if let Some(telemetry_enabled) = app.telemetry_enabled {
                settings.app.telemetry_enabled = telemetry_enabled;
            }
            if let Some(registration_enabled) = app.registration_enabled {
                settings.app.registration_enabled = registration_enabled;
            }
            if let Some(language_change_enabled) = app.language_change_enabled {
                settings.app.language_change_enabled = language_change_enabled;
            }
        }
        if let Some(webauthn) = data.webauthn {
            if let Some(rp_id) = webauthn.rp_id {
                settings.webauthn.rp_id = rp_id;
            }
            if let Some(rp_origin) = webauthn.rp_origin {
                settings.webauthn.rp_origin = rp_origin;
            }
        }
        if let Some(server) = data.server {
            if let Some(max_file_manager_view_size) = server.max_file_manager_view_size {
                settings.server.max_file_manager_view_size = max_file_manager_view_size;
            }
            if let Some(max_file_manager_content_search_size) =
                server.max_file_manager_content_search_size
            {
                settings.server.max_file_manager_content_search_size =
                    max_file_manager_content_search_size;
            }
            if let Some(max_file_manager_search_results) = server.max_file_manager_search_results {
                settings.server.max_file_manager_search_results = max_file_manager_search_results;
            }
            if let Some(max_schedules_step_count) = server.max_schedules_step_count {
                settings.server.max_schedules_step_count = max_schedules_step_count;
            }
            if let Some(allow_overwriting_custom_docker_image) =
                server.allow_overwriting_custom_docker_image
            {
                settings.server.allow_overwriting_custom_docker_image =
                    allow_overwriting_custom_docker_image;
            }
            if let Some(allow_editing_startup_command) = server.allow_editing_startup_command {
                settings.server.allow_editing_startup_command = allow_editing_startup_command;
            }
            if let Some(allow_viewing_installation_logs) = server.allow_viewing_installation_logs {
                settings.server.allow_viewing_installation_logs = allow_viewing_installation_logs;
            }
            if let Some(allow_viewing_transfer_progress) = server.allow_viewing_transfer_progress {
                settings.server.allow_viewing_transfer_progress = allow_viewing_transfer_progress;
            }
        }
        if let Some(activity) = data.activity {
            if let Some(admin_log_retention_days) = activity.admin_log_retention_days {
                settings.activity.admin_log_retention_days = admin_log_retention_days;
            }
            if let Some(user_log_retention_days) = activity.user_log_retention_days {
                settings.activity.user_log_retention_days = user_log_retention_days;
            }
            if let Some(server_log_retention_days) = activity.server_log_retention_days {
                settings.activity.server_log_retention_days = server_log_retention_days;
            }
            if let Some(server_log_admin_activity) = activity.server_log_admin_activity {
                settings.activity.server_log_admin_activity = server_log_admin_activity;
            }
            if let Some(server_log_schedule_activity) = activity.server_log_schedule_activity {
                settings.activity.server_log_schedule_activity = server_log_schedule_activity;
            }
        }
        if let Some(ratelimits) = data.ratelimits {
            if let Some(auth_register) = ratelimits.auth_register {
                settings.ratelimits.auth_register = auth_register;
            }
            if let Some(auth_login) = ratelimits.auth_login {
                settings.ratelimits.auth_login = auth_login;
            }
            if let Some(auth_login_checkpoint) = ratelimits.auth_login_checkpoint {
                settings.ratelimits.auth_login_checkpoint = auth_login_checkpoint;
            }
            if let Some(auth_login_security_key) = ratelimits.auth_login_security_key {
                settings.ratelimits.auth_login_security_key = auth_login_security_key;
            }
            if let Some(auth_password_forgot) = ratelimits.auth_password_forgot {
                settings.ratelimits.auth_password_forgot = auth_password_forgot;
            }
            if let Some(client) = ratelimits.client {
                settings.ratelimits.client = client;
            }
            if let Some(client_servers_backups_create) = ratelimits.client_servers_backups_create {
                settings.ratelimits.client_servers_backups_create = client_servers_backups_create;
            }
            if let Some(client_servers_files_pull) = ratelimits.client_servers_files_pull {
                settings.ratelimits.client_servers_files_pull = client_servers_files_pull;
            }
            if let Some(client_servers_files_pull_query) =
                ratelimits.client_servers_files_pull_query
            {
                settings.ratelimits.client_servers_files_pull_query =
                    client_servers_files_pull_query;
            }
        }

        let settings_json = settings.censored();
        settings.save().await?;

        activity_logger.log("settings:update", settings_json).await;

        ApiResponse::new_serialized(Response {}).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(put::route))
        .with_state(state.clone())
}
