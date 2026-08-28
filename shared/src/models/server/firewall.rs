use compact_str::ToCompactString;
use garde::Validate;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use utoipa::ToSchema;

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FirewallRuleAction {
    Allow,
    Deny,
}

#[derive(ToSchema, Serialize, Deserialize, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum FirewallRuleProtocol {
    Tcp,
    Udp,
}

#[derive(ToSchema, Validate, Serialize, Deserialize, Clone)]
pub struct FirewallRule {
    #[garde(skip)]
    pub action: FirewallRuleAction,
    #[garde(skip)]
    #[serde(default)]
    pub protocols: HashSet<FirewallRuleProtocol>,
    #[garde(skip)]
    #[schema(value_type = Vec<String>)]
    #[serde(default)]
    pub sources: Vec<cidr::IpCidr>,
    #[garde(inner(length(min = 1, max = 1024), inner(range(min = 1))))]
    #[schema(min_items = 1, max_items = 1024)]
    #[serde(default)]
    pub ports: Option<Vec<u16>>,
}

impl From<FirewallRule> for wings_api::FirewallRule {
    fn from(value: FirewallRule) -> Self {
        Self {
            action: match value.action {
                FirewallRuleAction::Allow => wings_api::FirewallRuleAction::Allow,
                FirewallRuleAction::Deny => wings_api::FirewallRuleAction::Deny,
            },
            protocols: value
                .protocols
                .into_iter()
                .map(|protocol| match protocol {
                    FirewallRuleProtocol::Tcp => wings_api::FirewallRuleProtocol::Tcp,
                    FirewallRuleProtocol::Udp => wings_api::FirewallRuleProtocol::Udp,
                })
                .collect(),
            sources: value
                .sources
                .iter()
                .map(|source| source.to_compact_string())
                .collect(),
            ports: value
                .ports
                .map(|ports| ports.into_iter().map(|port| port as u32).collect()),
        }
    }
}

pub(super) async fn fetch_raw_rules(
    database: &crate::database::Database,
    server_uuid: uuid::Uuid,
) -> Result<Option<serde_json::Value>, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT server_firewalls.rules
        FROM server_firewalls
        WHERE server_firewalls.server_uuid = $1
        "#,
    )
    .bind(server_uuid)
    .fetch_optional(database.read())
    .await
}

pub(super) fn decode_rules(
    rules: Option<serde_json::Value>,
) -> Result<Vec<FirewallRule>, serde_json::Error> {
    match rules {
        Some(rules) => serde_json::from_value(rules),
        None => Ok(Vec::new()),
    }
}

impl super::Server {
    pub async fn firewall_rules(
        &self,
        database: &crate::database::Database,
    ) -> Result<Vec<FirewallRule>, crate::database::DatabaseError> {
        Ok(decode_rules(fetch_raw_rules(database, self.uuid).await?)?)
    }

    pub async fn allocation_ports(
        &self,
        database: &crate::database::Database,
    ) -> Result<Vec<u16>, crate::database::DatabaseError> {
        let ports: Vec<i32> = sqlx::query_scalar(
            r#"
            SELECT node_allocations.port
            FROM server_allocations
            JOIN node_allocations ON node_allocations.uuid = server_allocations.allocation_uuid
            WHERE server_allocations.server_uuid = $1
            ORDER BY node_allocations.port
            "#,
        )
        .bind(self.uuid)
        .fetch_all(database.read())
        .await?;

        Ok(ports.into_iter().map(|port| port as u16).collect())
    }

    pub async fn set_firewall_rules(
        &self,
        database: &crate::database::Database,
        rules: &[FirewallRule],
    ) -> Result<(), crate::database::DatabaseError> {
        sqlx::query(
            r#"
            INSERT INTO server_firewalls (server_uuid, rules)
            VALUES ($1, $2)
            ON CONFLICT (server_uuid) DO UPDATE SET rules = EXCLUDED.rules
            "#,
        )
        .bind(self.uuid)
        .bind(serde_json::to_value(rules)?)
        .execute(database.write())
        .await?;

        Ok(())
    }
}
