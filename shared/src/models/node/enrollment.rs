use super::Node;
use crate::models::ByUuid;
use rand::distr::SampleString;
use serde::{Deserialize, Serialize};

const ENROLLMENT_TTL_SECONDS: u64 = 30 * 60;

#[derive(Serialize, Deserialize)]
struct StoredEnrollment {
    node_uuid: uuid::Uuid,
    token_id: compact_str::CompactString,
    remote: Option<compact_str::CompactString>,
}

pub struct NodeEnrollment {
    pub node: Node,
    pub remote: Option<compact_str::CompactString>,
    pub token_id: String,
    pub token: String,
}

fn cache_key(code: &str) -> String {
    format!("node_enrollment::{}", crate::crypt::token_digest(code))
}

impl NodeEnrollment {
    /// Mints a single-use code that lets Wings fetch its identity from the panel. The
    /// code is bound to the node's current token id; redeeming rotates the token, so a
    /// second redemption (or any older join command) stops working.
    pub async fn create(
        state: &crate::State,
        node: &Node,
        remote: Option<&str>,
    ) -> Result<(String, chrono::DateTime<chrono::Utc>), anyhow::Error> {
        let code = rand::distr::Alphanumeric.sample_string(&mut rand::rng(), 32);

        state
            .cache
            .set(
                &cache_key(&code),
                ENROLLMENT_TTL_SECONDS,
                &StoredEnrollment {
                    node_uuid: node.uuid,
                    token_id: node.token_id.clone(),
                    remote: remote.map(Into::into),
                },
            )
            .await?;

        Ok((
            code,
            chrono::Utc::now() + chrono::Duration::seconds(ENROLLMENT_TTL_SECONDS as i64),
        ))
    }

    pub async fn redeem(state: &crate::State, code: &str) -> Result<Option<Self>, anyhow::Error> {
        let key = cache_key(code);
        let Some(stored) = state.cache.get::<StoredEnrollment>(&key).await? else {
            return Ok(None);
        };
        state.cache.invalidate(&key).await?;

        let Some(node) = Node::by_uuid_optional(&state.database, stored.node_uuid).await? else {
            return Ok(None);
        };

        let Some((token_id, token)) = node
            .reset_token_if_unchanged(state, &stored.token_id)
            .await?
        else {
            return Ok(None);
        };

        Ok(Some(Self {
            node,
            remote: stored.remote,
            token_id,
            token,
        }))
    }
}
