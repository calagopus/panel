use crate::response::ApiResponse;
use axum::http::StatusCode;
use std::{
    ops::{Deref, DerefMut},
    sync::{Arc, LazyLock},
};

#[derive(Clone)]
pub enum AuthMethod {
    Session(crate::models::user_session::UserSession),
    ApiKey(crate::models::user_api_key::UserApiKey),
}

impl AuthMethod {
    #[inline]
    pub fn api_key_uuid(&self) -> Option<uuid::Uuid> {
        match self {
            Self::Session(_) => None,
            Self::ApiKey(api_key) => Some(api_key.uuid),
        }
    }
}

#[derive(Clone)]
pub struct UserImpersonator(pub super::User);

impl Deref for UserImpersonator {
    type Target = super::User;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for UserImpersonator {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

pub type GetUser = crate::extract::ConsumingExtension<super::User>;
pub type GetUserImpersonator = crate::extract::ConsumingExtension<Option<UserImpersonator>>;
pub type GetAuthMethod = axum::extract::Extension<Arc<AuthMethod>>;
pub type GetPermissionManager = axum::extract::Extension<PermissionManager>;

static NO_PERMISSIONS: LazyLock<Arc<Vec<compact_str::CompactString>>> =
    LazyLock::new(|| Arc::new(Vec::new()));

#[derive(Clone)]
pub enum CredentialScope {
    Session,
    ApiKey {
        user: Arc<Vec<compact_str::CompactString>>,
        admin: Arc<Vec<compact_str::CompactString>>,
        server: Arc<Vec<compact_str::CompactString>>,
    },
}

impl From<&AuthMethod> for CredentialScope {
    fn from(auth: &AuthMethod) -> Self {
        match auth {
            AuthMethod::Session(_) => Self::Session,
            AuthMethod::ApiKey(api_key) => Self::ApiKey {
                user: Arc::clone(&api_key.user_permissions),
                admin: Arc::clone(&api_key.admin_permissions),
                server: Arc::clone(&api_key.server_permissions),
            },
        }
    }
}

impl CredentialScope {
    /// The server permissions this credential is limited to, or [`None`] when it is unscoped.
    #[inline]
    pub fn server_permissions(&self) -> Option<&[compact_str::CompactString]> {
        match self {
            Self::Session => None,
            Self::ApiKey { server, .. } => Some(server),
        }
    }

    #[inline]
    fn allows(scope: Option<&[compact_str::CompactString]>, permission: &str) -> bool {
        scope.is_none_or(|scope| scope.iter().any(|p| p == permission))
    }

    #[inline]
    fn allows_user(&self, permission: &str) -> bool {
        match self {
            Self::Session => true,
            Self::ApiKey { user, .. } => Self::allows(Some(user), permission),
        }
    }

    #[inline]
    fn allows_admin(&self, permission: &str) -> bool {
        match self {
            Self::Session => true,
            Self::ApiKey { admin, .. } => Self::allows(Some(admin), permission),
        }
    }

    #[inline]
    fn allows_server(&self, permission: &str) -> bool {
        Self::allows(self.server_permissions(), permission)
    }
}

#[derive(Clone)]
pub struct PermissionManager {
    user_uuid: uuid::Uuid,
    user_admin: bool,
    role_admin_permissions: Arc<Vec<compact_str::CompactString>>,
    role_server_permissions: Arc<Vec<compact_str::CompactString>>,
    server_owner: bool,
    server_subuser_permissions: Arc<Vec<compact_str::CompactString>>,
    scope: CredentialScope,
}

impl PermissionManager {
    pub fn new(user: &super::User, auth: &AuthMethod) -> Self {
        Self {
            user_uuid: user.uuid,
            user_admin: user.admin,
            role_admin_permissions: user.role.as_ref().map_or_else(
                || Arc::clone(&NO_PERMISSIONS),
                |role| Arc::clone(&role.admin_permissions),
            ),
            role_server_permissions: user.role.as_ref().map_or_else(
                || Arc::clone(&NO_PERMISSIONS),
                |role| Arc::clone(&role.server_permissions),
            ),
            server_owner: false,
            server_subuser_permissions: Arc::clone(&NO_PERMISSIONS),
            scope: CredentialScope::from(auth),
        }
    }

    /// Resolves the grants the user has on a specific server, replacing those of any server this
    /// manager was previously scoped to.
    pub fn for_server(&self, server: &crate::models::server::Server) -> Self {
        Self {
            server_owner: self.user_uuid == server.owner.uuid,
            server_subuser_permissions: server
                .subuser_permissions
                .as_ref()
                .map_or_else(|| Arc::clone(&NO_PERMISSIONS), Arc::clone),
            ..self.clone()
        }
    }

    #[inline]
    pub fn scope(&self) -> &CredentialScope {
        &self.scope
    }

    #[inline]
    fn check(allowed: bool, permission: &str) -> Result<(), ApiResponse> {
        if allowed {
            return Ok(());
        }

        Err(ApiResponse::error(format!(
            "you do not have permission to perform this action: {permission}"
        ))
        .with_status(StatusCode::FORBIDDEN))
    }

    /// User permissions cover self-service on one's own account, which every account holds
    /// unconditionally, so the credential scope is the only thing that can withhold them.
    pub fn has_user_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        Self::check(self.scope.allows_user(permission), permission)
    }

    pub fn has_admin_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        let granted =
            self.user_admin || self.role_admin_permissions.iter().any(|p| p == permission);

        Self::check(granted && self.scope.allows_admin(permission), permission)
    }

    pub fn has_server_permission(&self, permission: &str) -> Result<(), ApiResponse> {
        let granted = self.user_admin
            || self.server_owner
            || self.role_server_permissions.iter().any(|p| p == permission)
            || self
                .server_subuser_permissions
                .iter()
                .any(|p| p == permission);

        Self::check(granted && self.scope.allows_server(permission), permission)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn permissions(permissions: &[&str]) -> Arc<Vec<compact_str::CompactString>> {
        Arc::new(permissions.iter().map(|p| (*p).into()).collect())
    }

    fn manager(scope: CredentialScope) -> PermissionManager {
        PermissionManager {
            user_uuid: uuid::Uuid::nil(),
            user_admin: false,
            role_admin_permissions: Arc::clone(&NO_PERMISSIONS),
            role_server_permissions: Arc::clone(&NO_PERMISSIONS),
            server_owner: false,
            server_subuser_permissions: Arc::clone(&NO_PERMISSIONS),
            scope,
        }
    }

    fn api_key(user: &[&str], admin: &[&str], server: &[&str]) -> CredentialScope {
        CredentialScope::ApiKey {
            user: permissions(user),
            admin: permissions(admin),
            server: permissions(server),
        }
    }

    #[test]
    fn api_key_scope_constrains_a_full_admin() {
        let mut manager = manager(api_key(&[], &["users.impersonate"], &[]));
        manager.user_admin = true;

        assert!(manager.has_admin_permission("users.impersonate").is_ok());
        assert!(manager.has_admin_permission("roles.read").is_err());
        assert!(manager.has_admin_permission("extensions.manage").is_err());
    }

    #[test]
    fn an_unconfigured_api_key_denies_everything() {
        let mut manager = manager(api_key(&[], &[], &[]));
        manager.user_admin = true;
        manager.server_owner = true;

        assert!(manager.has_user_permission("account.infos").is_err());
        assert!(manager.has_admin_permission("roles.read").is_err());
        assert!(manager.has_server_permission("files.read").is_err());
    }

    #[test]
    fn a_session_holds_every_user_permission() {
        let manager = manager(CredentialScope::Session);

        assert!(manager.has_user_permission("account.infos").is_ok());
        assert!(manager.has_user_permission("api-keys.create").is_ok());
    }

    #[test]
    fn a_session_still_defers_to_account_grants() {
        let manager = manager(CredentialScope::Session);

        assert!(manager.has_admin_permission("roles.read").is_err());
        assert!(manager.has_server_permission("files.read").is_err());
    }

    #[test]
    fn a_grant_and_a_scope_are_intersected() {
        let mut manager = manager(api_key(&[], &["roles.read"], &[]));
        manager.role_admin_permissions = permissions(&["roles.read", "nodes.read"]);

        assert!(manager.has_admin_permission("roles.read").is_ok());
        assert!(manager.has_admin_permission("nodes.read").is_err());
        assert!(manager.has_admin_permission("users.read").is_err());
    }

    #[test]
    fn a_scope_alone_grants_nothing() {
        let manager = manager(api_key(&[], &["roles.read"], &["files.read"]));

        assert!(manager.has_admin_permission("roles.read").is_err());
        assert!(manager.has_server_permission("files.read").is_err());
    }

    #[test]
    fn subuser_grants_are_scoped_too() {
        let mut manager = manager(api_key(&[], &[], &["files.read"]));
        manager.server_subuser_permissions = permissions(&["files.read", "files.delete"]);

        assert!(manager.has_server_permission("files.read").is_ok());
        assert!(manager.has_server_permission("files.delete").is_err());
    }

    #[test]
    fn server_ownership_is_scoped_too() {
        let mut manager = manager(api_key(&[], &[], &["files.read"]));
        manager.server_owner = true;

        assert!(manager.has_server_permission("files.read").is_ok());
        assert!(manager.has_server_permission("files.delete").is_err());
    }
}
