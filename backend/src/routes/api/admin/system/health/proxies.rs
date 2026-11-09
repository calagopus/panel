use super::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use compact_str::ToCompactString;
    use serde::{Deserialize, Serialize};
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };
    use utoipa::ToSchema;

    #[derive(ToSchema, Serialize, Deserialize)]
    struct ResponseSharedIp {
        ip: compact_str::CompactString,
        users: i64,
        sessions: i64,
        trusted: bool,
    }

    #[derive(ToSchema, Serialize, Deserialize)]
    struct Response {
        active_users: i64,
        #[schema(inline)]
        suspicious_ips: Vec<ResponseSharedIp>,
    }

    #[utoipa::path(get, path = "/", responses(
        (status = OK, body = inline(Response)),
    ))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("stats.read")?;

        let response = state
            .cache
            .cached("health::proxies", 60, || async {
                let (active_users, shared_ips) = tokio::try_join!(
                    sqlx::query_scalar!(
                        r#"SELECT COUNT(DISTINCT user_sessions.user_uuid) AS "count!"
                        FROM user_sessions
                        WHERE user_sessions.last_used > NOW() - INTERVAL '7 days'"#
                    )
                    .fetch_one(state.database.read()),
                    sqlx::query!(
                        r#"SELECT user_sessions.ip, COUNT(DISTINCT user_sessions.user_uuid) AS "users!", COUNT(*) AS "sessions!"
                        FROM user_sessions
                        WHERE user_sessions.last_used > NOW() - INTERVAL '7 days'
                        GROUP BY user_sessions.ip
                        HAVING COUNT(DISTINCT user_sessions.user_uuid) >= 2
                        ORDER BY 2 DESC
                        LIMIT 50"#
                    )
                    .fetch_all(state.database.read()),
                )?;

                let suspicious_ips = shared_ips
                    .into_iter()
                    .filter_map(|row| {
                        let ip = row.ip.ip();
                        let loopback = ip.to_canonical().is_loopback();

                        let suspicious = (row.users >= 3 && row.users * 2 >= active_users)
                            || loopback;
                        if !suspicious {
                            return None;
                        }

                        Some(ResponseSharedIp {
                            ip: ip.to_compact_string(),
                            users: row.users,
                            sessions: row.sessions,
                            trusted: state
                                .env
                                .app_trusted_proxies
                                .iter()
                                .any(|cidr| cidr.contains(&ip)),
                        })
                    })
                    .collect();

                Ok::<_, anyhow::Error>(Response {
                    active_users,
                    suspicious_ips,
                })
            })
            .await?;

        ApiResponse::new_serialized(response).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .routes(routes!(get::route))
        .with_state(state.clone())
}
