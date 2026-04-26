use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod _server_;
mod deploy;
mod external;

mod get {
    use axum::{extract::Query, http::StatusCode};
    use serde::Serialize;
    use shared::{
        ApiError, GetState,
        models::{
            IntoAdminApiObject, Pagination, PaginationParamsWithSearch, server::Server,
            user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize)]
    struct Response {
        #[schema(inline)]
        servers: Pagination<shared::models::server::AdminApiServer>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ), params(
        (
            "page" = i64, Query,
            description = "The page number",
            example = "1",
        ),
        (
            "per_page" = i64, Query,
            description = "The number of items per page",
            example = "10",
        ),
        (
            "search" = Option<String>, Query,
            description = "Search term for items",
        ),
    ))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        Query(params): Query<PaginationParamsWithSearch>,
    ) -> ApiResponseResult {
        if let Err(errors) = shared::utils::validate_data(&params) {
            return ApiResponse::new_serialized(ApiError::new_strings_value(errors))
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        permissions.has_admin_permission("servers.read")?;

        let servers = Server::all_with_pagination(
            &state.database,
            params.page,
            params.per_page,
            params.search.as_deref(),
        )
        .await?;

        let storage_url_retriever = state.storage.retrieve_urls().await?;

        ApiResponse::new_serialized(Response {
            servers: servers
                .try_async_map(|server| {
                    server.into_admin_api_object(&state, &storage_url_retriever)
                })
                .await?,
        })
        .ok()
    }
}

mod post {
    use axum::http::StatusCode;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            CreatableModel, IntoAdminApiObject, admin_activity::GetAdminActivityLogger,
            nest_egg_variable::NestEggVariable, server::Server, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashMap;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Serialize, Deserialize)]
    pub struct PayloadVariable {
        #[garde(length(chars, min = 1, max = 255))]
        #[schema(min_length = 1, max_length = 255)]
        env_variable: String,
        #[garde(length(max = 4096))]
        #[schema(max_length = 4096)]
        value: String,
    }

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        node_uuid: uuid::Uuid,
        #[garde(skip)]
        owner_uuid: uuid::Uuid,
        #[garde(skip)]
        egg_uuid: uuid::Uuid,
        #[garde(skip)]
        backup_configuration_uuid: Option<uuid::Uuid>,

        #[garde(skip)]
        allocation_uuid: Option<uuid::Uuid>,
        #[garde(skip)]
        allocation_uuids: Vec<uuid::Uuid>,

        #[garde(skip)]
        start_on_completion: bool,
        #[garde(skip)]
        skip_installer: bool,

        #[garde(length(max = 255))]
        #[schema(max_length = 255)]
        external_id: Option<compact_str::CompactString>,
        #[garde(length(chars, min = 3, max = 255))]
        #[schema(min_length = 3, max_length = 255)]
        name: compact_str::CompactString,
        #[garde(length(max = 1024))]
        #[schema(max_length = 1024)]
        description: Option<compact_str::CompactString>,

        #[garde(dive)]
        limits: shared::models::server::AdminApiServerLimits,
        #[garde(inner(range(min = 0)))]
        pinned_cpus: Vec<i16>,

        #[garde(length(chars, min = 1, max = 8192))]
        #[schema(min_length = 1, max_length = 8192)]
        startup: compact_str::CompactString,
        #[garde(length(chars, min = 2, max = 255))]
        #[schema(min_length = 2, max_length = 255)]
        image: compact_str::CompactString,
        #[garde(skip)]
        #[schema(value_type = Option<String>)]
        timezone: Option<chrono_tz::Tz>,

        #[garde(skip)]
        hugepages_passthrough_enabled: bool,
        #[garde(skip)]
        kvm_passthrough_enabled: bool,

        #[garde(dive)]
        feature_limits: shared::models::server::ApiServerFeatureLimits,
        #[schema(inline)]
        #[garde(dive)]
        variables: Vec<PayloadVariable>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        server: shared::models::server::AdminApiServer,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = BAD_REQUEST, body = ApiError),
        (status = NOT_FOUND, body = ApiError),
        (status = CONFLICT, body = ApiError),
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

        permissions.has_admin_permission("servers.create")?;

        let variables = NestEggVariable::all_by_egg_uuid(&state.database, data.egg_uuid).await?;

        let mut validator_variables = HashMap::new();
        validator_variables.reserve(variables.len());

        for variable in variables.iter() {
            validator_variables.insert(
                variable.env_variable.as_str(),
                (
                    variable.rules.as_slice(),
                    if let Some(value) = data
                        .variables
                        .iter()
                        .find(|v| v.env_variable == variable.env_variable)
                    {
                        value.value.as_str()
                    } else {
                        variable.default_value.as_ref().map_or("", |v| v.as_str())
                    },
                ),
            );
        }

        let validator = match rule_validator::Validator::new(validator_variables) {
            Ok(validator) => validator,
            Err(error) => {
                return ApiResponse::error(&error)
                    .with_status(StatusCode::BAD_REQUEST)
                    .ok();
            }
        };

        if let Err(error) = validator.validate() {
            return ApiResponse::error(&error)
                .with_status(StatusCode::BAD_REQUEST)
                .ok();
        }

        let mut server_variables = HashMap::new();
        server_variables.reserve(variables.len());

        for data_variable in &data.variables {
            let variable_uuid = match variables
                .iter()
                .find(|v| v.env_variable == data_variable.env_variable)
            {
                Some(variable) => variable.uuid,
                None => continue,
            };

            server_variables.insert(variable_uuid, data_variable.value.clone().into());
        }

        let options = shared::models::server::CreateServerOptions {
            node_uuid: data.node_uuid,
            owner_uuid: data.owner_uuid,
            egg_uuid: data.egg_uuid,
            backup_configuration_uuid: data.backup_configuration_uuid,
            allocation_uuid: data.allocation_uuid,
            allocation_uuids: data.allocation_uuids.clone(),
            start_on_completion: data.start_on_completion,
            skip_installer: data.skip_installer,
            external_id: data.external_id,
            name: data.name,
            description: data.description,
            limits: data.limits,
            pinned_cpus: data.pinned_cpus,
            startup: data.startup,
            image: data.image,
            timezone: data.timezone,
            hugepages_passthrough_enabled: data.hugepages_passthrough_enabled,
            kvm_passthrough_enabled: data.kvm_passthrough_enabled,
            feature_limits: data.feature_limits.clone(),
            variables: server_variables,
        };
        let server = match Server::create(&state, options).await {
            Ok(server) => server,
            Err(err) if err.is_unique_violation() => {
                return ApiResponse::error(
                    "server with allocation(s) or external id already exists",
                )
                .with_status(StatusCode::CONFLICT)
                .ok();
            }
            Err(err) => return ApiResponse::from(err).ok(),
        };

        activity_logger
            .log(
                "server:create",
                serde_json::json!({
                    "uuid": server.uuid,
                    "node_uuid": server.node.uuid,
                    "owner_uuid": server.owner.uuid,
                    "egg_uuid": server.egg.uuid,

                    "allocation_uuid": data.allocation_uuid,
                    "allocation_uuids": data.allocation_uuids,
                    "external_id": server.external_id,

                    "start_on_completion": data.start_on_completion,
                    "skip_installer": data.skip_installer,

                    "name": server.name,
                    "description": server.description,
                    "limits": data.limits,
                    "pinned_cpus": server.pinned_cpus,
                    "startup": server.startup,
                    "image": server.image,
                    "timezone": server.timezone,

                    "hugepages_passthrough_enabled": server.hugepages_passthrough_enabled,
                    "kvm_passthrough_enabled": server.kvm_passthrough_enabled,

                    "feature_limits": data.feature_limits,
                    "variables": data.variables,
                }),
            )
            .await;

        ApiResponse::new_serialized(Response {
            server: server
                .into_admin_api_object(&state, &state.storage.retrieve_urls().await?)
                .await?,
        })
        .ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .routes(routes!(post::route))
        .nest("/{server}", _server_::router(state))
        .nest("/external", external::router(state))
        .nest("/deploy", deploy::router(state))
        .with_state(state.clone())
}
