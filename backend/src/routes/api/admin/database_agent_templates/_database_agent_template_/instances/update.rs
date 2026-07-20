use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod post {
    use crate::routes::api::admin::database_agent_templates::_database_agent_template_::GetDatabaseAgentTemplate;
    use futures_util::StreamExt;
    use garde::Validate;
    use serde::{Deserialize, Serialize};
    use shared::{
        ApiError, GetState,
        models::{
            admin_activity::GetAdminActivityLogger,
            server_database_instance::ServerDatabaseInstance, user::GetPermissionManager,
        },
        response::{ApiResponse, ApiResponseResult},
    };
    use std::collections::HashSet;
    use utoipa::ToSchema;

    #[derive(ToSchema, Validate, Deserialize)]
    pub struct Payload {
        #[garde(skip)]
        instance_uuids: HashSet<uuid::Uuid>,
    }

    #[derive(ToSchema, Serialize)]
    struct Response {
        updated: usize,
    }

    #[utoipa::path(post, path = "/", responses(
        (status = OK, body = inline(Response)),
        (status = NOT_FOUND, body = ApiError),
    ), params(
        (
            "database_agent_template" = uuid::Uuid,
            description = "The database agent template ID",
            example = "123e4567-e89b-12d3-a456-426614174000",
        ),
    ), request_body = inline(Payload))]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        database_agent_template: GetDatabaseAgentTemplate,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(data): shared::Payload<Payload>,
    ) -> ApiResponseResult {
        permissions.has_admin_permission("database-agent-templates.update")?;

        let deployment_lock = state
            .cache
            .lock("database_agent_hosts::deployment", Some(30), Some(5))
            .await?;

        let version = database_agent_template.version;

        let update_instance = async |instance_uuid: uuid::Uuid| {
            let mut instance = match ServerDatabaseInstance::by_database_agent_template_uuid_uuid(
                &state.database,
                database_agent_template.uuid,
                instance_uuid,
            )
            .await?
            {
                Some(instance) => instance,
                None => return Ok(false),
            };

            if instance.locked
                || instance.database_agent_host.maintenance_enabled
                || instance.r#type.as_str() != database_agent_template.r#type.as_str()
            {
                return Ok(false);
            }

            let spec = match instance.resolve_spec(Some(&database_agent_template)) {
                Some(spec) => spec,
                None => return Ok(false),
            };

            let timezone = instance
                .server
                .fetch_cached(&state.database)
                .await?
                .timezone
                .clone();

            let patch_result = async {
                instance
                    .database_agent_host
                    .api_client(&state.database)
                    .await?
                    .patch_instances_instance(
                        instance.uuid,
                        &db_agent_api::instances_instance::patch::RequestBody {
                            suspended: None,
                            memory: Some(spec.memory),
                            swap: Some(spec.swap),
                            disk: Some(spec.disk),
                            io_weight: spec.io_weight.map(i64::from),
                            cpu: Some(spec.cpu as i64),
                            image: Some(spec.image),
                            image_uid: spec.image_uid.map(|uid| uid as u32),
                            image_gid: spec.image_gid.map(|gid| gid as u32),
                            volumes: spec.volumes,
                            socket_path: spec.socket_path,
                            timezone,
                            env: Some(spec.env),
                            cmd: spec.cmd,
                        },
                    )
                    .await?;

                Ok::<_, anyhow::Error>(())
            };

            if let Err(err) = patch_result.await {
                tracing::warn!(
                    instance = %instance.uuid,
                    template = %database_agent_template.uuid,
                    "failed to apply database agent template update: {:?}",
                    err
                );

                return Ok(false);
            }

            instance
                .set_template_version(&state.database, version)
                .await?;

            activity_logger
                .log(
                    "database-agent-template:instance.update",
                    serde_json::json!({
                        "uuid": instance.uuid,
                        "template_uuid": database_agent_template.uuid,
                        "name": instance.name,
                        "version": version,
                    }),
                )
                .await;

            Ok::<_, anyhow::Error>(true)
        };

        let mut instance_uuids: Vec<uuid::Uuid> = data.instance_uuids.into_iter().collect();

        if instance_uuids.is_empty() {
            let mut page = 1;
            loop {
                let instances =
                    ServerDatabaseInstance::by_database_agent_template_uuid_with_pagination(
                        &state.database,
                        database_agent_template.uuid,
                        page,
                        50,
                        None,
                    )
                    .await?;
                if instances.data.is_empty() {
                    break;
                }

                for instance in instances.data {
                    if instance.template_version.is_some_and(|v| v < version) {
                        instance_uuids.push(instance.uuid);
                    }
                }

                page += 1;
            }
        }

        let mut futures = Vec::new();

        for instance_uuid in instance_uuids {
            futures.push(update_instance(instance_uuid));
        }

        let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(5);

        let mut updated = 0;
        while let Some(result) = results_stream.next().await {
            match result {
                Ok(true) => updated += 1,
                Ok(false) => {}
                Err(err) => return ApiResponse::from(err).ok(),
            }
        }

        drop(deployment_lock);

        ApiResponse::new_serialized(Response { updated }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(post::route))
        .with_state(state.clone())
}
