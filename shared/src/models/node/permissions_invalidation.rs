use super::Node;
use crate::models::ByUuid;
use futures_util::StreamExt;
use sqlx::Row;
use std::{collections::HashSet, sync::Arc, time::Duration};

const INVALIDATE_TIMEOUT: Duration = Duration::from_secs(5);
const INLINE_RETRY_DELAYS: [Duration; 3] = [
    Duration::from_secs(1),
    Duration::from_secs(2),
    Duration::from_secs(4),
];
const MAX_RETRY_BACKOFF_SECS: f64 = 300.0;
const MAX_MERGED_IDS: usize = 1000;
const REVOCATION_RELEVANCE_MS: i64 = 15 * 60 * 1000;

#[derive(Default, Clone)]
pub struct PermissionsInvalidation {
    pub users: Vec<uuid::Uuid>,
    pub servers: Option<wings_api::ServerSelector>,
    pub revoke_users: Vec<uuid::Uuid>,
    pub revoke_credentials: Vec<uuid::Uuid>,
}

impl PermissionsInvalidation {
    pub fn is_empty(&self) -> bool {
        self.users.is_empty()
            && self.servers.is_none()
            && self.revoke_users.is_empty()
            && self.revoke_credentials.is_empty()
    }

    fn revokes(&self) -> bool {
        !self.revoke_users.is_empty() || !self.revoke_credentials.is_empty()
    }

    fn all_servers(&self) -> bool {
        matches!(self.servers, Some(wings_api::ServerSelector::All))
    }

    fn server_uuids(&self) -> Vec<uuid::Uuid> {
        match &self.servers {
            Some(wings_api::ServerSelector::Uuids { uuids }) => uuids.iter().copied().collect(),
            _ => Vec::new(),
        }
    }

    fn without_revocations(mut self) -> Self {
        self.users.append(&mut self.revoke_users);
        self.revoke_credentials.clear();
        self
    }

    fn merge(&mut self, other: Self) {
        self.users.extend(other.users);
        self.revoke_users.extend(other.revoke_users);
        self.revoke_credentials.extend(other.revoke_credentials);

        self.servers = match (self.servers.take(), other.servers) {
            (servers, None) | (None, servers) => servers,
            (
                Some(wings_api::ServerSelector::Uuids { mut uuids }),
                Some(wings_api::ServerSelector::Uuids { uuids: other }),
            ) => {
                uuids.extend(other);
                Some(wings_api::ServerSelector::Uuids { uuids })
            }
            _ => Some(wings_api::ServerSelector::All),
        };

        for ids in [
            &mut self.users,
            &mut self.revoke_users,
            &mut self.revoke_credentials,
        ] {
            let mut seen = HashSet::with_capacity(ids.len());
            ids.retain(|id| seen.insert(*id));
        }
    }

    fn collapsed(mut self) -> Self {
        let too_many_servers = match &self.servers {
            Some(wings_api::ServerSelector::Uuids { uuids }) => uuids.len() > MAX_MERGED_IDS,
            _ => false,
        };

        if self.all_servers() || too_many_servers || self.users.len() > MAX_MERGED_IDS {
            self.servers = Some(wings_api::ServerSelector::All);
            self.users.clear();
        }

        self
    }

    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        let servers: Vec<uuid::Uuid> = row.try_get("servers")?;

        Ok(Self {
            users: row.try_get("users")?,
            servers: if row.try_get("all_servers")? {
                Some(wings_api::ServerSelector::All)
            } else if servers.is_empty() {
                None
            } else {
                Some(wings_api::ServerSelector::Uuids {
                    uuids: servers.into_iter().collect(),
                })
            },
            revoke_users: row.try_get("revoke_users")?,
            revoke_credentials: row.try_get("revoke_credentials")?,
        })
    }
}

enum Delivery {
    Delivered,
    Failed {
        remaining: PermissionsInvalidation,
        transient: bool,
    },
}

impl Node {
    /// Tells wings that permissions changed: live sessions continue with their new
    /// permissions and only those that lost access end. Must run after the change is
    /// committed. Nodes that predate invalidation end the affected users' sessions instead.
    /// Runs in the background; what cannot be delivered is queued and retried until it is.
    pub fn invalidate_permissions(
        &self,
        database: &Arc<crate::database::Database>,
        invalidation: PermissionsInvalidation,
    ) {
        if invalidation.is_empty() {
            return;
        }

        let as_of = chrono::Utc::now().timestamp_millis();
        let node = self.clone();
        let database = database.clone();

        tokio::spawn(async move {
            node.invalidate_permissions_as_of(&database, invalidation, as_of)
                .await;
        });
    }

    /// [`Self::invalidate_permissions`] on every node.
    pub fn invalidate_permissions_everywhere(
        database: &Arc<crate::database::Database>,
        invalidation: PermissionsInvalidation,
    ) {
        if invalidation.is_empty() {
            return;
        }

        let as_of = chrono::Utc::now().timestamp_millis();
        let database = database.clone();

        tokio::spawn(async move {
            let mut nodes = Vec::new();
            let mut node_page = 1;
            loop {
                match Self::all_with_pagination(&database, node_page, 50, None).await {
                    Ok(page) if page.data.is_empty() => break,
                    Ok(page) => nodes.extend(page.data),
                    Err(err) => {
                        tracing::error!(
                            "failed to list nodes to invalidate permissions, queueing for every node: {:?}",
                            err
                        );

                        if let Err(err) = Self::queue_permissions_invalidation(
                            database.write(),
                            None,
                            &invalidation,
                            as_of,
                        )
                        .await
                        {
                            tracing::error!("failed to queue permissions invalidation: {:?}", err);
                        }

                        return;
                    }
                }

                node_page += 1;
            }

            let mut futures = Vec::with_capacity(nodes.len());
            for node in &nodes {
                futures.push(node.invalidate_permissions_as_of(
                    &database,
                    invalidation.clone(),
                    as_of,
                ));
            }

            let mut results_stream = futures_util::stream::iter(futures).buffer_unordered(10);
            while results_stream.next().await.is_some() {}
        });
    }

    async fn invalidate_permissions_as_of(
        &self,
        database: &crate::database::Database,
        mut invalidation: PermissionsInvalidation,
        as_of: i64,
    ) {
        let mut delays = INLINE_RETRY_DELAYS.iter();
        loop {
            match self
                .deliver_permissions_invalidation(database, &invalidation, as_of)
                .await
            {
                Delivery::Delivered => return,
                Delivery::Failed {
                    remaining,
                    transient,
                } => {
                    invalidation = remaining;

                    match delays.next() {
                        Some(delay) if transient => tokio::time::sleep(*delay).await,
                        _ => break,
                    }
                }
            }
        }

        tracing::warn!(node = %self.uuid, "queueing permissions invalidation for retry");

        if let Err(err) = Self::queue_permissions_invalidation(
            database.write(),
            Some(self.uuid),
            &invalidation,
            as_of,
        )
        .await
        {
            tracing::error!(node = %self.uuid, "failed to queue permissions invalidation: {:?}", err);
        }
    }

    async fn deliver_permissions_invalidation(
        &self,
        database: &crate::database::Database,
        invalidation: &PermissionsInvalidation,
        as_of: i64,
    ) -> Delivery {
        let failed = |transient| Delivery::Failed {
            remaining: invalidation.clone(),
            transient,
        };

        let api_client = match self.api_client(database).await {
            Ok(api_client) => api_client,
            Err(err) => {
                tracing::error!(node = %self.uuid, "failed to invalidate permissions in wings: {:?}", err);
                return failed(true);
            }
        };

        let response = tokio::time::timeout(
            INVALIDATE_TIMEOUT,
            api_client.post_permissions_invalidate(
                &wings_api::permissions_invalidate::post::RequestBody {
                    as_of,
                    revoke_credentials: invalidation.revoke_credentials.clone(),
                    revoke_users: invalidation.revoke_users.clone(),
                    servers: invalidation.servers.clone(),
                    users: invalidation.users.clone(),
                },
            ),
        )
        .await;

        let err = match response {
            Ok(Ok(_)) => return Delivery::Delivered,
            Ok(Err(wings_api::client::ApiHttpError::Http(reqwest::StatusCode::NOT_FOUND, _))) => {
                return self.deauthorize_users(&api_client, invalidation).await;
            }
            Ok(Err(err)) => err,
            Err(_) => {
                tracing::error!(node = %self.uuid, "timed out invalidating permissions in wings");
                return failed(true);
            }
        };

        let transient = match &err {
            wings_api::client::ApiHttpError::Http(status, _) => {
                status.is_server_error() || *status == reqwest::StatusCode::TOO_MANY_REQUESTS
            }
            wings_api::client::ApiHttpError::Reqwest(_) => true,
            _ => false,
        };

        tracing::error!(node = %self.uuid, "failed to invalidate permissions in wings: {:?}", anyhow::Error::from(err));

        failed(transient)
    }

    async fn deauthorize_users(
        &self,
        api_client: &wings_api::client::WingsClient,
        invalidation: &PermissionsInvalidation,
    ) -> Delivery {
        let mut failed_users = Vec::new();
        for &user in invalidation.users.iter().chain(&invalidation.revoke_users) {
            let deauthorized = tokio::time::timeout(
                INVALIDATE_TIMEOUT,
                api_client.post_deauthorize_user(&wings_api::deauthorize_user::post::RequestBody {
                    servers: Vec::new(),
                    user,
                }),
            )
            .await;

            match deauthorized {
                Ok(Ok(_)) => {}
                Ok(Err(err)) => {
                    tracing::error!(node = %self.uuid, user = %user, "failed to deauthorize user in wings: {:?}", anyhow::Error::from(err));
                    failed_users.push(user);
                }
                Err(_) => {
                    tracing::error!(node = %self.uuid, user = %user, "timed out deauthorizing user in wings");
                    failed_users.push(user);
                }
            }
        }

        if failed_users.is_empty() {
            return Delivery::Delivered;
        }

        Delivery::Failed {
            remaining: PermissionsInvalidation {
                users: failed_users,
                ..Default::default()
            },
            transient: true,
        }
    }

    async fn queue_permissions_invalidation(
        executor: impl sqlx::PgExecutor<'_>,
        node_uuid: Option<uuid::Uuid>,
        invalidation: &PermissionsInvalidation,
        as_of: i64,
    ) -> Result<(), sqlx::Error> {
        if invalidation.is_empty() {
            return Ok(());
        }

        let all_servers = invalidation.all_servers();
        let (users, servers) = if all_servers {
            (Vec::new(), Vec::new())
        } else {
            (invalidation.users.clone(), invalidation.server_uuids())
        };

        let query = if invalidation.revokes() {
            r#"
            INSERT INTO node_permission_invalidations (node_uuid, as_of, users, servers, all_servers, revoke_users, revoke_credentials)
            SELECT nodes.uuid, $2, $3, $4, $5, $6, $7
            FROM nodes
            WHERE $1::uuid IS NULL OR nodes.uuid = $1
            "#
        } else {
            r#"
            INSERT INTO node_permission_invalidations (node_uuid, as_of, users, servers, all_servers, revoke_users, revoke_credentials)
            SELECT nodes.uuid, $2, $3, $4, $5, $6, $7
            FROM nodes
            WHERE $1::uuid IS NULL OR nodes.uuid = $1
            ON CONFLICT (node_uuid) WHERE cardinality(revoke_users) = 0 AND cardinality(revoke_credentials) = 0
            DO UPDATE SET
                as_of = GREATEST(node_permission_invalidations.as_of, EXCLUDED.as_of),
                all_servers = node_permission_invalidations.all_servers OR EXCLUDED.all_servers,
                users = CASE
                    WHEN node_permission_invalidations.all_servers OR EXCLUDED.all_servers THEN '{}'
                    ELSE ARRAY(SELECT DISTINCT UNNEST(node_permission_invalidations.users || EXCLUDED.users))
                END,
                servers = CASE
                    WHEN node_permission_invalidations.all_servers OR EXCLUDED.all_servers THEN '{}'
                    ELSE ARRAY(SELECT DISTINCT UNNEST(node_permission_invalidations.servers || EXCLUDED.servers))
                END
            "#
        };

        sqlx::query(query)
            .bind(node_uuid)
            .bind(as_of)
            .bind(users)
            .bind(servers)
            .bind(all_servers)
            .bind(&invalidation.revoke_users)
            .bind(&invalidation.revoke_credentials)
            .execute(executor)
            .await?;

        Ok(())
    }

    pub async fn flush_permission_invalidations(
        database: &crate::database::Database,
        node_uuid: uuid::Uuid,
    ) -> Result<(), anyhow::Error> {
        let mut transaction = database.write().begin().await?;

        let rows = sqlx::query(
            r#"
            SELECT
                node_permission_invalidations.uuid,
                node_permission_invalidations.as_of,
                node_permission_invalidations.users,
                node_permission_invalidations.servers,
                node_permission_invalidations.all_servers,
                node_permission_invalidations.revoke_users,
                node_permission_invalidations.revoke_credentials,
                node_permission_invalidations.attempts
            FROM node_permission_invalidations
            WHERE node_permission_invalidations.node_uuid = $1
            ORDER BY node_permission_invalidations.created
            FOR UPDATE SKIP LOCKED
            "#,
        )
        .bind(node_uuid)
        .fetch_all(&mut *transaction)
        .await?;

        if rows.is_empty() {
            return Ok(());
        }

        let Some(node) = Self::by_uuid_optional(database, node_uuid).await? else {
            return Ok(());
        };

        let revocation_cutoff = chrono::Utc::now().timestamp_millis() - REVOCATION_RELEVANCE_MS;
        let mut attempts = 0;
        let mut batches: Vec<(Vec<uuid::Uuid>, PermissionsInvalidation, i64)> = Vec::new();
        let mut merged: Option<(Vec<uuid::Uuid>, PermissionsInvalidation, i64)> = None;

        for row in &rows {
            let uuid: uuid::Uuid = row.try_get("uuid")?;
            let as_of: i64 = row.try_get("as_of")?;
            let invalidation = PermissionsInvalidation::from_row(row)?;
            attempts = attempts.max(row.try_get::<i32, _>("attempts")?);

            if invalidation.revokes() && as_of > revocation_cutoff {
                batches.push((vec![uuid], invalidation, as_of));
                continue;
            }

            let invalidation = invalidation.without_revocations();
            match &mut merged {
                Some((uuids, merged, merged_as_of)) => {
                    uuids.push(uuid);
                    merged.merge(invalidation);
                    *merged_as_of = (*merged_as_of).max(as_of);
                }
                None => merged = Some((vec![uuid], invalidation, as_of)),
            }
        }
        batches.extend(merged);

        let mut failed = false;
        for (uuids, invalidation, as_of) in batches {
            let invalidation = invalidation.collapsed();
            let delivery = node
                .deliver_permissions_invalidation(database, &invalidation, as_of)
                .await;

            sqlx::query("DELETE FROM node_permission_invalidations WHERE uuid = ANY($1)")
                .bind(&uuids)
                .execute(&mut *transaction)
                .await?;

            if let Delivery::Failed { remaining, .. } = delivery {
                failed = true;
                Self::queue_permissions_invalidation(
                    &mut *transaction,
                    Some(node_uuid),
                    &remaining,
                    as_of,
                )
                .await?;
            }
        }

        if failed {
            let attempts = attempts + 1;
            let backoff = (5.0 * 2f64.powi(attempts.min(16))).min(MAX_RETRY_BACKOFF_SECS);

            sqlx::query(
                r#"
                UPDATE node_permission_invalidations
                SET attempts = $2, next_attempt = NOW() + make_interval(secs => $3)
                WHERE node_permission_invalidations.node_uuid = $1
                "#,
            )
            .bind(node_uuid)
            .bind(attempts)
            .bind(backoff)
            .execute(&mut *transaction)
            .await?;

            tracing::warn!(node = %node_uuid, attempts, "failed to deliver queued permissions invalidations, retrying in {backoff}s");
        }

        transaction.commit().await?;

        Ok(())
    }

    pub async fn flush_due_permission_invalidations(
        database: &crate::database::Database,
    ) -> Result<usize, anyhow::Error> {
        let node_uuids: Vec<uuid::Uuid> = sqlx::query_scalar(
            r#"
            SELECT DISTINCT node_permission_invalidations.node_uuid
            FROM node_permission_invalidations
            WHERE node_permission_invalidations.next_attempt <= NOW()
            LIMIT 64
            "#,
        )
        .fetch_all(database.read())
        .await?;

        let flushed = node_uuids.len();
        let mut results_stream = futures_util::stream::iter(node_uuids.into_iter().map(|node_uuid| async move {
            if let Err(err) = Self::flush_permission_invalidations(database, node_uuid).await {
                tracing::error!(node = %node_uuid, "failed to flush permissions invalidations: {:?}", err);
            }
        }))
        .buffer_unordered(8);
        while results_stream.next().await.is_some() {}

        Ok(flushed)
    }
}
